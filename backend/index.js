require('dotenv').config();
const express = require('express');

const cors = require('cors');

const app = express();

app.use(cors());            // Middleware to enable CORS
app.use(express.json());    // Middleware to parse JSON request bodies
 
// Health check endpoint
app.get("/health", (req, res) => {
    res.json({status: "ok"});
});


// API endpoint to parse meal descriptions and estimate nutritional information
app.post("/api/meals/parse" , async (req, res) => {

    const {raw_text} = req.body;

    if (!raw_text || typeof(raw_text) !== 'string' ){
        return res.status(400).json({error: "valid raw_text is required"});
    }
try{
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const minstralResponse = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method : "POST",
        headers : {
            "Content-Type" : "application/json",
            "Authorization" : `Bearer ${process.env.MISTRAL_API_KEY}`
        },
        body: JSON.stringify({
            model : "mistral-small-latest",
            messages: [
                {
                    role : 'system',
                    content : 'You are a nutrition estimator. Given a meal description, respond with ONLY a JSON object with keys calories, protein_g, carbs_g, fat_g (all numbers). No explanation, no markdown.',

                },
                {
                    role : 'user',
                    content : raw_text
                }
            ],
            response_format : {type : 'json_object'}
        }),
        signal: controller.signal
    })

    clearTimeout(timeoutId);

if (!minstralResponse.ok) {
  throw new  Error(`Minstral responded with ${minstralResponse.status}`);
}

const data  =  await minstralResponse.json();

console.log("Mistral Raw API Response Structure:", JSON.stringify(data, null, 2));

const nutrients = JSON.parse(data.choices[0].message.content);

res.json(nutrients);    
}  catch (error){
    console.error(error) ;
    return res.status(500).json({error : "Failed to estimate nutrition information", details : error.message});
}

})


const { createClient } = require('@supabase/supabase-js');

//API endpoint to handle chat messages with context from Supabase
app.post("/api/chat", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }
    const token = authHeader.split(' ')[1];

    const { message, topic, today_start, today_end, today_date, thread_id } = req.body;
    if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "valid message is required" });
    }
    if (!thread_id || typeof thread_id !== 'string') {
        return res.status(400).json({ error: "valid thread_id is required" });
    }

    try {
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY,
            { global: { headers: { Authorization: `Bearer ${token}` } } }
        );

        // "Today" bounds come from the client (the same getTodayBounds()/toDateStr() helpers
        // the Nutrition page uses), not recomputed here — this server has no idea what
        // timezone the user is actually in, so deriving its own "today" would silently drift
        // from what the Nutrition page shows near midnight. Falls back to this server's UTC
        // day only if a client is missing them for some reason.
        const fallbackStart = new Date(); fallbackStart.setUTCHours(0, 0, 0, 0);
        const fallbackEnd = new Date(fallbackStart); fallbackEnd.setUTCDate(fallbackEnd.getUTCDate() + 1);
        const startIso = today_start || fallbackStart.toISOString();
        const endIso = today_end || fallbackEnd.toISOString();
        const dateStr = today_date || fallbackStart.toISOString().slice(0, 10);

        // Prior turns in this thread, oldest first, so the model actually has memory of the
        // conversation instead of treating every message as a fresh one-shot question. This
        // request's own `message` isn't inserted into health_chat until after we reply (the
        // frontend does that), so it's naturally excluded here — no duplication risk.
        const { data: priorMessages } = await supabase
            .from('health_chat')
            .select('role, content')
            .eq('thread_id', thread_id)
            .order('created_at', { ascending: true });
        const conversationHistory = (priorMessages ?? []).map((m) => ({ role: m.role, content: m.content }));

        const { data: profile } = await supabase.from('profiles').select('weight_kg, height_cm').single();
        const { data: todaySessions } = await supabase
            .from('workout_sessions')
            .select('date, total_calories, total_duration_seconds')
            .eq('date', dateStr)
            .order('started_at', { ascending: false });
        const { data: todayMeals } = await supabase
            .from('meals')
            .select('logged_at, calories, protein_g, carbs_g, fat_g')
            .gte('logged_at', startIso)
            .lt('logged_at', endIso)
            .order('logged_at', { ascending: false });

        const sessions = todaySessions ?? [];
        const meals = todayMeals ?? [];
        const caloriesBurnedToday = sessions.reduce((sum, s) => sum + (s.total_calories ?? 0), 0);
        const caloriesEatenToday = meals.reduce((sum, m) => sum + (m.calories ?? 0), 0);
        const proteinEatenToday = meals.reduce((sum, m) => sum + (m.protein_g ?? 0), 0);

        const contextSummary = `User stats: weight ${profile?.weight_kg}kg, height ${profile?.height_cm}cm. ` +
            `Today's workouts (${dateStr}): ${JSON.stringify(sessions)}. Total calories burned today: ${Math.round(caloriesBurnedToday)}. ` +
            `Today's meals (${dateStr}): ${JSON.stringify(meals)}. Today's totals: ${Math.round(caloriesEatenToday)} kcal, ${Math.round(proteinEatenToday)}g protein. ` +
            `Topic focus: ${topic || 'general'}.`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const mistralResponse = await fetch("https://api.mistral.ai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.MISTRAL_API_KEY}` },
            body: JSON.stringify({
                model: "mistral-small-latest",
                messages: [
                    { role: 'system', content: `You are a supportive fitness and health assistant. Use this context to personalize your answer:\n${contextSummary}\nWhen asked about today's calories, protein, or calories burned, quote the precomputed "Today's totals" / "Total calories burned today" figures above exactly — do not recompute or re-sum them yourself from the raw workout/meal lists.` },
                    ...conversationHistory,
                    { role: 'user', content: message }
                ]
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        if (!mistralResponse.ok) throw new Error(`Mistral responded with ${mistralResponse.status}`);

        const data = await mistralResponse.json();
        res.json({ content: data.choices[0].message.content });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "chat_failed", details: error.message });
    }
});

// Start the server
const PORT = process.env.PORT || 3003;

app.listen(PORT, () =>{ 
    console.log(`Server is running on port http://localhost:${PORT}`);
})



