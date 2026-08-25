import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

function getSpeechRecognitionCtor(): (new () => any) | undefined {
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
}

export function VoiceInputButton({ onResult }: { onResult: (text: string) => void }) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    setSupported(!!getSpeechRecognitionCtor())
  }, [])

  function handleClick() {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }

    const SpeechRecognitionCtor = getSpeechRecognitionCtor()
    if (!SpeechRecognitionCtor) return

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      onResult(transcript)
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  if (!supported) return null

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      onClick={handleClick}
      aria-label={listening ? 'Stop voice input' : 'Start voice input'}
      className={listening ? 'border-destructive text-destructive' : undefined}
    >
      {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
    </Button>
  )
}
