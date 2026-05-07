export type Meeting = {
  id: string
  user_id: string
  title: string
  date: string
  duration_minutes: number
  status: 'processing' | 'done' | 'failed'
  transcript: string | null
  ai_summary: string | null
  key_decisions: string[]
  participants: string[]
  audio_url: string | null
  created_at: string
  updated_at: string
}

export type ActionItem = {
  id: string
  meeting_id: string
  user_id: string
  title: string
  assignee: string | null
  priority: 'low' | 'medium' | 'high'
  status: 'ready' | 'in_progress' | 'done'
  jira_ticket_id: string | null
  jira_ticket_url: string | null
  created_at: string
  updated_at: string
}
