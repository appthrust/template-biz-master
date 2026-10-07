BEGIN;

CREATE TABLE IF NOT EXISTS master_kinds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 80),
  fields JSONB NOT NULL CHECK (jsonb_typeof(fields) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS master_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id UUID NOT NULL REFERENCES master_kinds(id),
  values JSONB NOT NULL CHECK (jsonb_typeof(values) = 'object'),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS master_rows_master_idx ON master_rows(master_id, created_at);

CREATE TABLE IF NOT EXISTS master_history (
  id BIGSERIAL PRIMARY KEY,
  master_id UUID NOT NULL REFERENCES master_kinds(id),
  row_id UUID,
  action TEXT NOT NULL CHECK (action IN ('master', 'create', 'update', 'delete', 'import')),
  actor TEXT NOT NULL,
  before_values JSONB,
  after_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS master_history_master_idx ON master_history(master_id, id DESC);

-- Rows are seeded only for newly inserted master kinds. Re-applying never restores deleted rows.
WITH seeds(name, fields, records) AS (
  VALUES
  ('取引先',
   '[{"id":"f1","name":"取引先名","type":"text","required":true,"options":[]},{"id":"f2","name":"区分","type":"select","required":true,"options":["顧客","仕入先","協力会社"]},{"id":"f3","name":"担当者","type":"text","required":false,"options":[]},{"id":"f4","name":"取引開始日","type":"date","required":false,"options":[]}]'::jsonb,
   '[{"f1":"青葉商事","f2":"顧客","f3":"佐藤 花子","f4":"2026-04-01"},{"f1":"みなと製作所","f2":"仕入先","f3":"田中 太郎","f4":"2026-05-15"},{"f1":"山吹デザイン","f2":"協力会社","f3":"鈴木 葵","f4":"2026-06-10"}]'::jsonb),
  ('商品',
   '[{"id":"f1","name":"商品名","type":"text","required":true,"options":[]},{"id":"f2","name":"商品コード","type":"text","required":true,"options":[]},{"id":"f3","name":"単価","type":"number","required":true,"options":[]},{"id":"f4","name":"販売状態","type":"select","required":true,"options":["販売中","準備中","販売終了"]}]'::jsonb,
   '[{"f1":"コットンノート A5","f2":"ST-001","f3":480,"f4":"販売中"},{"f1":"真鍮ボールペン","f2":"ST-002","f3":2400,"f4":"販売中"},{"f1":"デスクトレー","f2":"ST-003","f3":1800,"f4":"準備中"}]'::jsonb),
  ('部署',
   '[{"id":"f1","name":"部署名","type":"text","required":true,"options":[]},{"id":"f2","name":"部署コード","type":"text","required":true,"options":[]},{"id":"f3","name":"責任者","type":"text","required":false,"options":[]},{"id":"f4","name":"人数","type":"number","required":false,"options":[]}]'::jsonb,
   '[{"f1":"営業部","f2":"SALES","f3":"佐藤 花子","f4":12},{"f1":"管理部","f2":"ADMIN","f3":"田中 太郎","f4":6},{"f1":"企画部","f2":"PLAN","f3":"鈴木 葵","f4":8}]'::jsonb)
), inserted_kinds AS (
  INSERT INTO master_kinds (name, fields)
  SELECT name, fields FROM seeds
  ON CONFLICT (name) DO NOTHING
  RETURNING id, name
), inserted_rows AS (
  INSERT INTO master_rows(master_id, values)
  SELECT kinds.id, record
  FROM inserted_kinds kinds JOIN seeds ON kinds.name = seeds.name
  CROSS JOIN LATERAL jsonb_array_elements(seeds.records) record
  RETURNING id, master_id, values
)
INSERT INTO master_history(master_id, row_id, action, actor, after_values)
SELECT master_id, id, 'create', '初期サンプル', values FROM inserted_rows;

COMMIT;
