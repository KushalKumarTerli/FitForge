    -- supabase automatically creates a user table goes under auth.users which is not shown in public
    create table IF NOT EXISTS profiles (
        id uuid primary key references auth.users(id) on delete cascade, 
        full_name text not null,
        weight_kg numeric not null,
        height_cm numeric not null,
        phone_number text null,
        avatar_url text null,
        created_at timestamptz default now()
    ) ;


    create table if not exists exercises(
        id uuid primary key default gen_random_uuid() ,
        name text not null,
        muscle_group text not null,
        met_value numeric not null,
        created_at timestamptz default now()
    );



    create table if not exists workout_plans(
        id uuid primary key default gen_random_uuid(),
        user_id uuid references auth.users(id) on delete cascade,
        sequence_order int,
        name text not null,
        type text not null,
        created_at timestamptz default now()    

    );

    create table if not exists plan_exercises(
        plan_id uuid references workout_plans(id) on delete cascade,
        exercise_id uuid references exercises(id) on delete cascade,
        sets int not null,  
        target_reps int[]  not null default '{}',
        exercise_order int not null,
        primary key(plan_id, exercise_id),
        created_at timestamptz default now()
        
    );
create table if not exists workout_sessions(
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id)  on delete cascade ,
    plan_id uuid references workout_plans(id) on delete cascade,
    date date not null,
    started_at timestamptz not null,
    completed_at timestamptz null,
    total_calories numeric ,
    total_duration_seconds int,
    created_at timestamptz default now()
);

create table if not exists session_exercises(
    id uuid primary key default gen_random_uuid(),
    session_id uuid references workout_sessions(id) on delete cascade not null,
    exercise_id uuid references exercises(id) on delete cascade not null,
    sets int not null,
    -- reps int not null,
    -- completed boolean default false,
    -- completed_at timestamptz null,
    created_at timestamptz default now()
);

create table if not exists meals(
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references auth.users(id) on delete cascade,
        users_raw_text text not null,
        logged_at timestamptz default now(),
        calories numeric,
        protein_g numeric,
        carbs_g numeric,
        fat_g numeric,
        parse_status text not null default 'pending' check (parse_status in ('pending', 'success', 'failed'))

);

create table if not exists  session_sets(
    id uuid primary key default gen_random_uuid(),
    session_exercise_id uuid not null references session_exercises(id) on delete cascade ,
    set_number int not null,
    target_reps int not null,
    status text not null default 'pending' check (status in ('pending', 'completed', 'skipped','failed')),
    completed_at timestamptz null,
    unique(session_exercise_id, set_number),
    created_at timestamptz default now()

);

create table if not exists health_chat(
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    topic text,
    role text not null check (role in ('user', 'assistant')),
    content text not null,
    created_at timestamptz default now()
);




-- create policy "Users can update own profile"
-- on profiles for update
-- using (auth.uid() = id);





