CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL,
  school TEXT NOT NULL,
  best_score INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(nickname, school)
);

CREATE INDEX IF NOT EXISTS idx_scores_ranking
  ON scores(best_score DESC, updated_at ASC);
