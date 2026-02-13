-- Migration: Improve duplicate join handling
-- Run this in Supabase SQL Editor

-- The UNIQUE constraint already exists and should remain:
-- UNIQUE(workshop_id, wallet_address)

-- This prevents the same wallet from creating multiple attendee records
-- in the same workshop, which is the correct behavior.

-- Optional: Add a helpful comment to the schema
COMMENT ON CONSTRAINT attendees_workshop_id_wallet_address_key ON attendees 
IS 'Ensures one wallet can only join a workshop once. Prevents duplicate attendees.';

-- Optional: Add an index for faster duplicate detection
-- (This might already exist from idx_attendees_wallet, but let's be explicit)
CREATE INDEX IF NOT EXISTS idx_attendees_workshop_wallet ON attendees(workshop_id, wallet_address);
