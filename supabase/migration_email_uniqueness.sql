-- Migration: Add email uniqueness constraint for non-NULL emails
-- This prevents the same email from joining a workshop multiple times
-- while still allowing multiple attendees without emails (NULL emails)

-- Run this in your Supabase SQL Editor

-- Step 1: Add a partial unique index for non-NULL emails
-- This ensures that IF an email is provided, it must be unique per workshop
-- But it allows multiple NULL emails (attendees who didn't provide email)
CREATE UNIQUE INDEX idx_attendees_workshop_email_unique 
ON attendees(workshop_id, email) 
WHERE email IS NOT NULL;

-- Step 2: Add comment explaining the constraints
COMMENT ON INDEX idx_attendees_workshop_email_unique IS 
'Prevents the same email from joining a workshop twice. Allows NULL emails (optional field).';

COMMENT ON CONSTRAINT attendees_workshop_id_wallet_address_key ON attendees IS 
'Prevents the same wallet from joining a workshop twice.';

-- Step 3: Add index for faster email lookups (optional, but recommended)
CREATE INDEX IF NOT EXISTS idx_attendees_email ON attendees(email) 
WHERE email IS NOT NULL;

-- Verification query to check constraints:
-- SELECT 
--   conname AS constraint_name,
--   contype AS constraint_type,
--   pg_get_constraintdef(oid) AS definition
-- FROM pg_constraint 
-- WHERE conrelid = 'attendees'::regclass;
