-- Add indexes for better query performance on tournament tables
CREATE INDEX IF NOT EXISTS tournament_status_idx ON tournaments(status);
CREATE INDEX IF NOT EXISTS matches_tournament_idx ON matches(tournament_id);
CREATE INDEX IF NOT EXISTS matches_created_at_idx ON matches(created_at);