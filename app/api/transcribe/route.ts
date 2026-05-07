import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Phase 2d: Upload audio and transcribe via AssemblyAI
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('audio') as File
  const meetingId = formData.get('meetingId') as string

  if (!file) return NextResponse.json({ error: 'Audio file required' }, { status: 400 })

  const apiKey = process.env.ASSEMBLYAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AssemblyAI not configured' }, { status: 500 })

  // Step 1: Upload audio to AssemblyAI
  const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: { 'authorization': apiKey },
    body: file
  })
  const { upload_url } = await uploadResponse.json()

  // Step 2: Request transcription
  const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: { 'authorization': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      audio_url: upload_url,
      speaker_labels: true,
      auto_chapters: true
    })
  })
  const { id: transcriptId } = await transcriptResponse.json()

  // Step 3: Poll for completion
  let transcript = null
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 3000))
    const pollResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
      headers: { 'authorization': apiKey }
    })
    const pollData = await pollResponse.json()

    if (pollData.status === 'completed') {
      transcript = pollData.text
      break
    } else if (pollData.status === 'error') {
      return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
    }
  }

  if (!transcript) return NextResponse.json({ error: 'Transcription timed out' }, { status: 504 })

  // Step 4: Save transcript to Supabase
  if (meetingId) {
    await supabase
      .from('meetings')
      .update({ transcript, status: 'processing' })
      .eq('id', meetingId)
      .eq('user_id', user.id)
  }

  return NextResponse.json({ transcript, meetingId })
}
