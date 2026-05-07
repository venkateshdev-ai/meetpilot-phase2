# MeetPilot Phase 2 🚀

AI-powered meeting intelligence platform built on Next.js + Vercel.

## Features

- **Phase 2a** 🗄️ Supabase DB + Auth — Real database for meetings & action items
- **Phase 2b** 🤖 AI Summaries — OpenRouter (Gemini Flash) for real AI summaries
- **Phase 2c** 🎫 Jira Integration — Push action items directly to Jira
- **Phase 2d** 🎙️ Audio Transcription — AssemblyAI for meeting audio → transcript

## Tech Stack

- **Frontend:** Next.js 14 (App Router)
- **Database:** Supabase (Postgres)
- **Auth:** Supabase Auth
- **AI:** OpenRouter (Gemini Flash free)
- **Transcription:** AssemblyAI
- **Tickets:** Jira REST API
- **Deployment:** Vercel

## Environment Variables

Create a `.env.local` file:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenRouter (free AI)
OPENROUTER_API_KEY=your_openrouter_key

# AssemblyAI
ASSEMBLYAI_API_KEY=your_assemblyai_key

# Jira
JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=your@email.com
JIRA_API_TOKEN=your_jira_token
JIRA_PROJECT_KEY=your_project_key
```

## Getting Started

```bash
npm install
npm run dev
```

## Database Setup

Run the SQL in `supabase/schema.sql` in your Supabase SQL editor.
