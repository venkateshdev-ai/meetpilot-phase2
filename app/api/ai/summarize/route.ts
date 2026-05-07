import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Phase 2b: Real AI Summary via OpenRouter (Gemini Flash - FREE)
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { transcript, meetingId } = await request.json()
  if (!transcript) return NextResponse.json({ error: 'Transcript required' }, { status: 400 })

  const prompt = `You are an expert meeting analyst. Analyze this meeting transcript and return a JSON response.

Transcript:
${transcript}

Return ONLY valid JSON in this exact format:
{
  "summary": "2-3 sentence executive summary of the meeting",
  "key_decisions": ["decision 1", "decision 2", "decision 3"],
  "action_items": [
    { "title": "action item", "assignee": "person name or null", "priority": "high|medium|low" }
  ]
}`

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://meetpilot.vercel.app',
      'X-Title': 'MeetPilot'
    },
    body: JSON.stringify({
      model: 'google/gemini-flash-1.5',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    })
  })

  const aiData = await response.json()
  const result = JSON.parse(aiData.choices[0].message.content)

  // Save summary back to meeting in Supabase
  if (meetingId) {
    await supabase
      .from('meetings')
      .update({
        ai_summary: result.summary,
        key_decisions: result.key_decisions,
        status: 'done'
      })
      .eq('id', meetingId)
      .eq('user_id', user.id)

    // Save action items
    if (result.action_items?.length > 0) {
      await supabase.from('action_items').insert(
        result.action_items.map((item: any) => ({
          ...item,
          meeting_id: meetingId,
          user_id: user.id
        }))
      )
    }
  }

  return NextResponse.json(result)
}
