-- Koenigsburg - separate the public signup code from the private login key.
-- Run once in the Supabase SQL editor. Safe to run repeatedly.
--
-- Why: a manual signup posts their code publicly in #immigration to prove
-- ownership. That made the code public — and it was ALSO the login key, so
-- anyone reading the channel could sign in as them. Now the code is rotated
-- the moment they're approved: the posted one dies, and they are issued a
-- fresh private key which they must acknowledge saving.

ALTER TABLE players
    ADD COLUMN IF NOT EXISTS key_saved BOOLEAN DEFAULT FALSE NOT NULL;

-- Existing members have never been shown the "save your key" warning, so they
-- should see it once on their next visit.
UPDATE players SET key_saved = FALSE WHERE key_saved IS NULL;
