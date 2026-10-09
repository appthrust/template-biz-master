-- データタブに表示する表・列の日本語名。
COMMENT ON TABLE appthrust_demo_messages IS 'メッセージ';
COMMENT ON COLUMN appthrust_demo_messages.id IS '番号';
COMMENT ON COLUMN appthrust_demo_messages.body IS '@long 本文';
COMMENT ON COLUMN appthrust_demo_messages.created_at IS '登録日時';

COMMENT ON TABLE master_kinds IS 'マスター';
COMMENT ON COLUMN master_kinds.id IS '番号';
COMMENT ON COLUMN master_kinds.name IS 'マスター名';
COMMENT ON COLUMN master_kinds.fields IS '登録項目';
COMMENT ON COLUMN master_kinds.created_at IS '登録日時';

COMMENT ON TABLE master_rows IS '登録内容';
COMMENT ON COLUMN master_rows.id IS '番号';
COMMENT ON COLUMN master_rows.master_id IS 'マスター';
COMMENT ON COLUMN master_rows."values" IS '内容';
COMMENT ON COLUMN master_rows.version IS '@hidden';
COMMENT ON COLUMN master_rows.created_at IS '登録日時';
COMMENT ON COLUMN master_rows.updated_at IS '更新日時';

COMMENT ON TABLE master_history IS '変更履歴';
COMMENT ON COLUMN master_history.id IS '番号';
COMMENT ON COLUMN master_history.master_id IS 'マスター';
COMMENT ON COLUMN master_history.row_id IS '登録内容';
COMMENT ON COLUMN master_history.action IS '操作';
COMMENT ON COLUMN master_history.actor IS '記録者';
COMMENT ON COLUMN master_history.before_values IS '変更前の内容';
COMMENT ON COLUMN master_history.after_values IS '変更後の内容';
COMMENT ON COLUMN master_history.created_at IS '登録日時';
