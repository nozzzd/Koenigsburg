-- Königsburg Web Portal — Phase 1 schema
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).

CREATE TYPE player_status AS ENUM ('pending', 'active');
CREATE TYPE player_role AS ENUM ('guest', 'citizen', 'admin');

CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    minecraft_ign VARCHAR(16) UNIQUE NOT NULL,
    discord_id VARCHAR(255) UNIQUE,
    discord_username VARCHAR(255) NOT NULL,
    verification_code VARCHAR(20) UNIQUE NOT NULL, -- Serves as the manual re-login key (KBRG-XXXXXXXX)
    status player_status DEFAULT 'pending' NOT NULL,
    role player_role DEFAULT 'guest' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX idx_players_login ON players(minecraft_ign, verification_code);

-- All access goes through the server with the service-role key.
-- RLS on with no policies = the anon/public key can never touch this table.
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
