# Sprinkler - Web3 Workshop Platform

An interactive platform for hosting Web3 workshops with real-time collaboration, milestone tracking, and batch test funds distribution.

## Features

✅ **Session Management**

- Create workshop sessions with unique codes
- Generate QR codes for easy attendee onboarding
- Real-time attendee tracking

✅ **Attendee Onboarding**

- Join via session code or QR scan
- Optional email and display name
- Wallet address required

✅ **Milestone Tracking**

- Hosts can create micro-milestones/tasks
- Attendees mark milestones as complete
- Real-time progress tracking for all participants

✅ **Live Chat**

- Real-time messaging between host and attendees
- System notifications for joins and milestone completions

🟡 **Test Funds Distribution** (Under development)

- Distribute test ETH and ERC-20 tokens easily to all attendees

## Tech Stack

- **Framework:** Next.js 14.2.35 (App Router)
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL + Realtime)
- **Styling:** Tailwind CSS
- **QR Codes:** qrcode library
- **State Management:** Zustand (planned)

## Prerequisites

- Node.js 18+ and npm/yarn/pnpm (tested on 22.19.0)
- Supabase account (free tier works)

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
cd sprinkler
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://app.supabase.com)
2. Go to the SQL Editor in your Supabase dashboard
3. Copy and paste the contents of `supabase/schema.sql`
4. Execute the SQL to create all tables and indexes

### 3. Configure Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
BASE_URL=http://localhost:3000
```

**Where to find these:**

- Go to your Supabase project settings
- Navigate to API section
- Copy the URL and anon key

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
sprinkler/
├── app/                      # Next.js app directory
│   ├── api/                 # API routes (your backend)
│   │   ├── workshop/        # Workshop CRUD operations
│   │   ├── milestone/       # Milestone management
│   │   └── chat/           # Chat messaging
│   ├── workshop/           # Workshop pages (coming next)
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home page
│   └── globals.css         # Global styles
├── lib/                     # Shared utilities
│   ├── supabase.ts         # Supabase client
│   ├── types.ts            # TypeScript types
│   └── utils.ts            # Helper functions
├── supabase/               # Database
│   └── schema.sql          # Database schema
└── components/             # React components (coming next)
```

## API Endpoints

### Workshop Management

**POST** `/api/workshop/create`

```json
{
  "title": "Intro to DeFi",
  "description": "Learn DeFi basics",
  "hostWallet": "0x..."
}
```

**POST** `/api/workshop/join`

```json
{
  "sessionCode": "ABC123",
  "walletAddress": "0x...",
  "email": "optional@email.com",
  "displayName": "Optional Name"
}
```

### Milestones

**POST** `/api/milestone`

```json
{
  "workshopId": "workshop_id",
  "title": "Set up MetaMask",
  "description": "Install and configure MetaMask",
  "hostWallet": "0x..."
}
```

**POST** `/api/milestone/complete`

```json
{
  "milestoneId": "milestone_id",
  "attendeeId": "attendee_id",
  "notes": "Optional notes"
}
```

### Chat

**POST** `/api/chat`

```json
{
  "workshopId": "workshop_id",
  "senderWallet": "0x...",
  "senderName": "Optional Name",
  "message": "Hello everyone!"
}
```

**GET** `/api/chat?workshopId=xxx&limit=50`

## Database Schema

### Tables

- **workshops** - Workshop sessions
- **attendees** - Participants in workshops
- **milestones** - Tasks/checkpoints for workshops
- **milestone_completions** - Tracking who completed what
- **chat_messages** - Real-time chat messages

See `supabase/schema.sql` for complete schema with indexes and constraints.

## Contributing

This is a hobby project, a rather useful one for Devrels in Web3. Feel free to explore and experiment!

## License

MIT
