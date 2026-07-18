-- Koenigsburg - member self-assignable teams.
-- Run once in the Supabase SQL editor. Safe to run repeatedly.
--
-- Marks which teams a citizen may join themselves (from the portal) versus
-- teams only an admin can place people in. Everything else about teams is
-- unchanged.

ALTER TABLE teams
    ADD COLUMN IF NOT EXISTS self_assignable BOOLEAN DEFAULT false NOT NULL;
