CREATE TABLE IF NOT EXISTS entries (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  msg   TEXT NOT NULL,
  color TEXT NOT NULL,
  at    INTEGER NOT NULL,
  token TEXT NOT NULL,   -- sha256 of the author's delete token
  ip    TEXT NOT NULL    -- sha256 of the poster's IP, for rate limiting only
);
CREATE INDEX IF NOT EXISTS entries_at ON entries (at);
CREATE INDEX IF NOT EXISTS entries_ip_at ON entries (ip, at);
