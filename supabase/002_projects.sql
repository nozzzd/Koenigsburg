-- Koenigsburg - Great Works showcase, admin-managed.
-- Run once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- Safe to run repeatedly.

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(120) NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT,
    builder VARCHAR(120),
    tag VARCHAR(60),
    sort_order INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_order ON projects(sort_order, created_at);

-- Public page reads through the server's service-role key, same as players.
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Seed the three starter entries (only if the table is still empty).
INSERT INTO projects (title, description, builder, tag, sort_order)
SELECT * FROM (VALUES
    ('The Grand Cathedral',
     'The spiritual heart of the capital - flying buttresses, stained glass, and a bell tower that overlooks the whole valley.',
     'The Masons'' Guild', 'Landmark', 1),
    ('Königsburg Harbor',
     'A working port district with warehouses, a lighthouse, and berths for the merchant fleet that keeps the nation supplied.',
     'House Meridian', 'Infrastructure', 2),
    ('The Old Walls',
     'Kilometers of hand-laid battlements and gatehouses that trace the original founding borders of the free city.',
     'The Founders', 'Fortification', 3)
) AS seed(title, description, builder, tag, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM projects);
