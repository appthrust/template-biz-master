import test from "node:test";
import assert from "node:assert/strict";
import { validateFields, validateValues, parseCsv, mapCsv, exportCsv } from "./master.ts";

const fields = validateFields([
  { name: "名前", type: "text", required: true, options: [] },
  { name: "人数", type: "number", required: false, options: [] },
  { name: "開始日", type: "date", required: false, options: [] },
  { name: "状態", type: "select", required: true, options: ["有効", "無効"] },
]);

test("独自マスターの全4種類と必須設定を検証する", () => {
  assert.deepEqual(fields.map((field) => field.id), ["f1", "f2", "f3", "f4"]);
  assert.throws(() => validateFields([]), /1〜20/);
  assert.throws(() => validateFields([{ name: "名前", type: "toString", required: true }]), /種類/);
  assert.throws(() => validateFields([fields[0], fields[0]]), /重複/);
  assert.throws(() => validateFields([{ name: "状態", type: "select", required: true, options: ["有効", "有効"] }]), /重複/);
  assert.throws(() => validateFields([{ name: "状態", type: "select", required: true, options: [] }]), /選択肢/);
});

test("行は必須・有限数値・実在日付・定義済み選択肢で検証する", () => {
  assert.deepEqual(validateValues(fields, { f1: " 拠点A ", f2: "0", f3: "2024-02-29", f4: "有効" }), { f1: "拠点A", f2: 0, f3: "2024-02-29", f4: "有効" });
  for (const number of ["NaN", "Infinity", "1e400", "0x10", "1,000"]) assert.throws(() => validateValues(fields, { f1: "A", f2: number, f4: "有効" }), /数値/);
  for (const date of ["2025-02-29", "2026-02-31", "2026-13-01", "2026-1-1"]) assert.throws(() => validateValues(fields, { f1: "A", f3: date, f4: "有効" }), /日付/);
  assert.throws(() => validateValues(fields, { f1: " ", f4: "有効" }), /名前/);
  assert.throws(() => validateValues(fields, { f1: "A", f4: "その他" }), /選択肢/);
  assert.equal(validateValues(fields, { f1: "A", f4: "有効" }).f2, "");
});

test("CSVはBOM・引用符・カンマ・改行・CRLFを扱う", () => {
  assert.deepEqual(parseCsv('\uFEFF名前,説明\r\n"青葉,商事","改行\nと""引用"""\r\n'), [["名前", "説明"], ["青葉,商事", '改行\nと"引用"']]);
  assert.throws(() => parseCsv('a,b\n"未完,b'), /閉じられて/);
  assert.throws(() => parseCsv('a,b\n"値"x,b'), /引用符/);
  assert.throws(() => parseCsv('a,b\na'), /列数/);
  assert.throws(() => parseCsv('a,b'), /1件以上/);
  assert.throws(() => parseCsv('a\n' + 'x\n'.repeat(1001)), /1000/);
  assert.throws(() => parseCsv('a\n' + 'あ'.repeat(70000)), /200KB/);
});

test("CSVは列番号で並びを対応させ、全行を検証してから返す", () => {
  assert.deepEqual(mapCsv(fields, '状態,人,名称,日\n有効,2,拠点A,2026-10-07', { f1: 2, f2: 1, f3: 3, f4: 0 }), [{ f1: "拠点A", f2: 2, f3: "2026-10-07", f4: "有効" }]);
  assert.throws(() => mapCsv(fields, '名前,状態\nA,有効', { f1: "", f4: 1 }), /必須項目/);
  assert.throws(() => mapCsv(fields, '名前,状態\nA,有効', { f1: 0, f4: 0 }), /複数/);
  assert.throws(() => mapCsv(fields, '名前,状態\nA,有効\nB,その他', { f1: 0, f4: 1 }), /3行目/);
});

test("CSV書き出しは引用符をエスケープし数式を実行させない", () => {
  const result = exportCsv(fields, [{ id: "x", version: 1, updatedAt: "", values: { f1: '=HYPERLINK("bad")', f2: -5, f3: "", f4: "有効" } }]);
  assert.ok(result.startsWith("\uFEFF"));
  assert.ok(result.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(result.includes('"-5"'));
  assert.equal(parseCsv(result)[1][0], '\'=HYPERLINK("bad")');
});
