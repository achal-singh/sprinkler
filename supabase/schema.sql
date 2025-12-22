-- Sprinkler Workshop Platform Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Workshops table
CREATE TABLE workshops (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  host_wallet TEXT NOT NULL,
  session_code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attendees table
CREATE TABLE attendees (
  id TEXT PRIMARY KEY,
  workshop_id TEXT NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  email TEXT,
  display_name TEXT,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workshop_id, wallet_address)
);

-- Milestones table
CREATE TABLE milestones (
  id TEXT PRIMARY KEY,
  workshop_id TEXT NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT NOT NULL
);

-- Milestone completions table
CREATE TABLE milestone_completions (
  id TEXT PRIMARY KEY,
  milestone_id TEXT NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  attendee_id TEXT NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  UNIQUE(milestone_id, attendee_id)
);

-- Chat messages table
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  workshop_id TEXT NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  sender_wallet TEXT NOT NULL,
  sender_name TEXT,
  message TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'system', 'milestone_created', 'milestone_completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX idx_workshops_session_code ON workshops(session_code);
CREATE INDEX idx_workshops_host ON workshops(host_wallet);
CREATE INDEX idx_workshops_status ON workshops(status);

CREATE INDEX idx_attendees_workshop ON attendees(workshop_id);
CREATE INDEX idx_attendees_wallet ON attendees(wallet_address);

CREATE INDEX idx_milestones_workshop ON milestones(workshop_id);
CREATE INDEX idx_milestones_order ON milestones(workshop_id, order_index);

CREATE INDEX idx_completions_milestone ON milestone_completions(milestone_id);
CREATE INDEX idx_completions_attendee ON milestone_completions(attendee_id);

CREATE INDEX idx_messages_workshop ON chat_messages(workshop_id);
CREATE INDEX idx_messages_created ON chat_messages(created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for workshops updated_at
CREATE TRIGGER update_workshops_updated_at
  BEFORE UPDATE ON workshops
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestone_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Allow all for now, you can make them more restrictive later)
CREATE POLICY "Allow all operations on workshops" ON workshops FOR ALL USING (true);
CREATE POLICY "Allow all operations on attendees" ON attendees FOR ALL USING (true);
CREATE POLICY "Allow all operations on milestones" ON milestones FOR ALL USING (true);
CREATE POLICY "Allow all operations on milestone_completions" ON milestone_completions FOR ALL USING (true);
CREATE POLICY "Allow all operations on chat_messages" ON chat_messages FOR ALL USING (true);

-- Enable realtime for chat messages (for live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE attendees;
ALTER PUBLICATION supabase_realtime ADD TABLE milestones;
ALTER PUBLICATION supabase_realtime ADD TABLE milestone_completions;

-- To include full row data for UPDATE/DELETE operations
ALTER TABLE attendees REPLICA IDENTITY FULL;
