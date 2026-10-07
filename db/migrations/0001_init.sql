CREATE TABLE IF NOT EXISTS appthrust_demo_messages (
  id BIGSERIAL PRIMARY KEY,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO appthrust_demo_messages (body)
SELECT 'Hello from AppThrust managed PostgreSQL'
WHERE NOT EXISTS (SELECT 1 FROM appthrust_demo_messages);
