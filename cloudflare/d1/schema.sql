CREATE TABLE IF NOT EXISTS demo_requests (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  name TEXT,
  organization TEXT,
  role TEXT,
  organization_type TEXT,
  interest TEXT,
  message TEXT,
  callback_interest INTEGER NOT NULL DEFAULT 0,
  code_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at INTEGER NOT NULL,
  max_redemptions INTEGER NOT NULL DEFAULT 3,
  redemption_count INTEGER NOT NULL DEFAULT 0,
  verify_attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_sent_at INTEGER,
  source_ip_hash TEXT,
  user_agent_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_demo_requests_email
ON demo_requests(email_normalized);

CREATE INDEX IF NOT EXISTS idx_demo_requests_expires
ON demo_requests(expires_at);

CREATE INDEX IF NOT EXISTS idx_demo_requests_source_ip_created
ON demo_requests(source_ip_hash, created_at);

CREATE TABLE IF NOT EXISTS demo_sessions (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_seen_at INTEGER,
  user_agent_hash TEXT,
  ip_prefix_hash TEXT,
  revoked_at INTEGER,
  FOREIGN KEY (request_id) REFERENCES demo_requests(id)
);

CREATE INDEX IF NOT EXISTS idx_demo_sessions_request
ON demo_sessions(request_id);

CREATE INDEX IF NOT EXISTS idx_demo_sessions_expires
ON demo_sessions(expires_at);

CREATE TABLE IF NOT EXISTS demo_events (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  request_id TEXT,
  event_type TEXT NOT NULL,
  payload_json TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_demo_events_session
ON demo_events(session_id);

CREATE INDEX IF NOT EXISTS idx_demo_events_request
ON demo_events(request_id);

CREATE INDEX IF NOT EXISTS idx_demo_events_created
ON demo_events(created_at);

CREATE TABLE IF NOT EXISTS callback_requests (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  request_id TEXT,
  email_normalized TEXT,
  name TEXT,
  organization TEXT,
  message TEXT,
  requested_time TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_callback_requests_created
ON callback_requests(created_at);

CREATE TABLE IF NOT EXISTS demo_rate_limits (
  key TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  identifier_hash TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_demo_rate_limits_expires
ON demo_rate_limits(expires_at);
