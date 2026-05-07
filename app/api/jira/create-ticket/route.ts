import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Phase 2c: Create Jira ticket from action item
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { actionItemId, title, description, priority, assignee } = await request.json()

  const jiraBaseUrl = process.env.JIRA_BASE_URL
  const jiraEmail = process.env.JIRA_EMAIL
  const jiraToken = process.env.JIRA_API_TOKEN
  const jiraProject = process.env.JIRA_PROJECT_KEY

  if (!jiraBaseUrl || !jiraEmail || !jiraToken || !jiraProject) {
    return NextResponse.json({ error: 'Jira not configured' }, { status: 500 })
  }

  const priorityMap: Record<string, string> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low'
  }

  const jiraResponse = await fetch(`${jiraBaseUrl}/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${jiraEmail}:${jiraToken}`).toString('base64')}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      fields: {
        project: { key: jiraProject },
        summary: title,
        description: {
          type: 'doc',
          version: 1,
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: description || `Action item from MeetPilot: ${title}` }]
          }]
        },
        issuetype: { name: 'Task' },
        priority: { name: priorityMap[priority] || 'Medium' }
      }
    })
  })

  const jiraData = await jiraResponse.json()

  if (!jiraResponse.ok) {
    return NextResponse.json({ error: jiraData.errorMessages || 'Jira error' }, { status: 500 })
  }

  // Save Jira ticket reference back to Supabase action item
  if (actionItemId) {
    await supabase
      .from('action_items')
      .update({
        jira_ticket_id: jiraData.key,
        jira_ticket_url: `${jiraBaseUrl}/browse/${jiraData.key}`,
        status: 'in_progress'
      })
      .eq('id', actionItemId)
      .eq('user_id', user.id)
  }

  return NextResponse.json({
    ticketId: jiraData.key,
    ticketUrl: `${jiraBaseUrl}/browse/${jiraData.key}`
  })
}
