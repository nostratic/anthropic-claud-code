# ConflictPath — Conflict Resolution Tool

A full-stack collaborative conflict resolution platform with visual roadmaps, AI-powered step suggestions, and real-time progress tracking.

## Features

### Conflict Management
- Create conflicts with title and description
- Add participants by email (admin/member roles)
- Track conflict status (open → in_progress → resolved)

### Resolution Roadmaps
- **AI Suggestion** — Claude generates a structured roadmap with steps, KPIs, costs, and time estimates
- **Manual Creation** — Build your own linear or multi-path roadmap
- **Visual Canvas** — Left-to-right flow diagram powered by React Flow + dagre layout
- **Multi-path Support** — Branching decision nodes for complex scenarios

### Step Details (per node)
- Status: Pending / In Progress / Completed / Stuck / Blocked / Skipped
- Cost estimate
- Time estimate
- Prerequisites
- Assumptions
- KPIs / Success criteria
- Consequences if skipped
- Points score (impact metric)

### Collaboration
- Share roadmap proposals with other participants
- Recipients can accept (activates roadmap) or decline
- Personal private roadmaps (visible only to creator)
- Shared and personal notes per conflict

### Progress Tracking
- Status changes with required comment
- Full status history per step
- Progress bar and points summary on roadmap canvas
- Sub-tasks for each step

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: SQLite via Prisma ORM
- **Auth**: NextAuth.js (credentials + JWT)
- **Roadmap Visualization**: @xyflow/react (React Flow) + dagre layout
- **AI**: Anthropic Claude API
- **Styling**: Tailwind CSS

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and fill in values
cp .env.example .env
# Set ANTHROPIC_API_KEY to your Claude API key
# NEXTAUTH_SECRET can be any random string

# 3. Create the database
npx prisma db push

# 4. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and register an account.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | SQLite path — `file:./dev.db` for local dev |
| `NEXTAUTH_SECRET` | Random secret for JWT signing |
| `NEXTAUTH_URL` | App URL — `http://localhost:3000` for local dev |
| `ANTHROPIC_API_KEY` | Your Anthropic API key for AI roadmap suggestions |

## User Flow

1. **Register / Login**
2. **Create a Conflict** — fill in title + detailed description
3. **Add Participants** by email on the conflict detail page
4. **Generate a Roadmap** — click "AI Suggest" (instant) or create manually
5. **View the Roadmap** — visual canvas with all steps left-to-right
6. **Click any step** to open the detail panel: edit fields, change status, add sub-steps
7. **Track Progress** — mark steps as completed/stuck/blocked with comments
8. **Share as Proposal** — send your roadmap to another participant; they accept → it becomes active
