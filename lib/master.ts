export type FieldType = "text" | "number" | "date" | "select";
export type Field = { id: string; name: string; type: FieldType; required: boolean; options: string[] };
export type Values = Record<string, string | number>;
export type Master = { id: string; name: string; fields: Field[]; count: number };
export type MasterRow = { id: string; values: Values; version: number; updatedAt: string };
export type HistoryEntry = { id: string; action: "create" | "update" | "delete" | "import" | "master"; actor: string; at: string; before: Values | null; after: Values | null };
export type ActionResult = { ok: boolean; message: string; masterId?: string };
export const fieldTypeLabels: Record<FieldType, string> = { text: "文字", number: "数値", date: "日付", select: "選択肢" };
export const CSV_MAX_BYTES = 200_000;
export const CSV_MAX_ROWS = 1000;

export class InputError extends Error {}

export function requiredText(value: unknown, label: string, max = 80): string {
  if (typeof value !== "string" || !value.trim()) throw new InputError(`${label}を入力してください。`);
  if (value.trim().length > max) throw new InputError(`${label}は${max}文字以内で入力してください。`);
  return value.trim();
}

export function validateFields(input: unknown): Field[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 20) throw new InputError("項目は1〜20個で設定してください。");
  const names = new Set<string>();
  return input.map((item: unknown, index) => {
    if (!item || typeof item !== "object") throw new InputError("項目の設定を確認してください。");
    const raw = item as Record<string, unknown>;
    const name = requiredText(raw.name, `${index + 1}番目の項目名`, 40);
    if (names.has(name)) throw new InputError(`「${name}」が重複しています。項目名を変えてください。`);
    names.add(name);
    if (typeof raw.type !== "string" || !Object.hasOwn(fieldTypeLabels, raw.type)) throw new InputError(`「${name}」の種類を選んでください。`);
    if (typeof raw.required !== "boolean") throw new InputError(`「${name}」の必須設定を確認してください。`);
    const type = raw.type as FieldType;
    let options: string[] = [];
    if (type === "select") {
      if (!Array.isArray(raw.options) || raw.options.length < 1 || raw.options.length > 50) throw new InputError(`「${name}」の選択肢は1〜50個で設定してください。`);
      options = raw.options.map((option: unknown) => requiredText(option, `「${name}」の選択肢`, 80));
      if (new Set(options).size !== options.length) throw new InputError(`「${name}」の選択肢が重複しています。`);
    }
    return { id: `f${index + 1}`, name, type, required: raw.required, options };
  });
}

export function validateValues(fields: Field[], input: unknown): Values {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new InputError("入力内容を確認してください。");
  const raw = input as Record<string, unknown>;
  const values: Values = {};
  for (const field of fields) {
    const value = raw[field.id];
    if (value !== undefined && typeof value !== "string" && typeof value !== "number") throw new InputError(`「${field.name}」の入力内容を確認してください。`);
    const text = String(value ?? "").trim();
    if (!text) {
      if (field.required) throw new InputError(`「${field.name}」を入力してください。`);
      values[field.id] = "";
      continue;
    }
    if (text.length > 2000) throw new InputError(`「${field.name}」は2000文字以内で入力してください。`);
    if (field.type === "number") {
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text) || !Number.isFinite(Number(text))) throw new InputError(`「${field.name}」は数値で入力してください。`);
      values[field.id] = Number(text);
    } else {
      if (field.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(Date.parse(text)) || new Date(text).toISOString().slice(0, 10) !== text)) throw new InputError(`「${field.name}」は実在する日付で入力してください。`);
      if (field.type === "select" && !field.options.includes(text)) throw new InputError(`「${field.name}」は設定された選択肢から選んでください。`);
      values[field.id] = text;
    }
  }
  return values;
}

export function parseCsv(source: string): string[][] {
  if (new TextEncoder().encode(source).length > CSV_MAX_BYTES) throw new InputError("CSVは200KB以内にしてください。");
  const text = source.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false, closed = false;
  const finishRow = () => {
    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
    row = []; cell = ""; closed = false;
    if (rows.length > CSV_MAX_ROWS + 1) throw new InputError("一度に取り込めるのは1000件までです。");
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else { quoted = false; closed = true; }
      } else cell += char;
    } else if (char === ",") {
      row.push(cell); cell = ""; closed = false;
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      finishRow();
    } else if (char === '"' && cell === "" && !closed) quoted = true;
    else {
      if (closed || char === '"') throw new InputError("CSVの引用符が正しくありません。ダブルクォートの囲みを確認してください。");
      cell += char;
    }
  }
  if (quoted) throw new InputError("CSVの引用符が閉じられていません。");
  if (cell || row.length || closed) finishRow();
  if (rows.length < 2) throw new InputError("見出し行と1件以上のデータを含むCSVを選んでください。");
  if (rows[0].length > 100 || rows[0].some((header) => !header.trim())) throw new InputError("CSVの列名を入力し、列数を100列以内にしてください。");
  if (rows.some((record) => record.length !== rows[0].length)) throw new InputError("CSVの列数が行によって異なります。");
  return rows;
}

export function mapCsv(fields: Field[], source: string, mapping: unknown): Values[] {
  const [headers, ...records] = parseCsv(source);
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) throw new InputError("列の対応を設定してください。");
  const columns = mapping as Record<string, unknown>;
  const used = new Set<number>();
  for (const field of fields) {
    const column = columns[field.id];
    if (column === "" || column === undefined) {
      if (field.required) throw new InputError(`必須項目「${field.name}」にCSVの列を割り当ててください。`);
      continue;
    }
    if (typeof column !== "number" || !Number.isInteger(column) || column < 0 || column >= headers.length) throw new InputError(`「${field.name}」の列の対応を確認してください。`);
    if (used.has(column)) throw new InputError("同じCSV列を複数の項目には割り当てられません。");
    used.add(column);
  }
  return records.map((record, index) => {
    const values = Object.fromEntries(fields.map((field) => [field.id, typeof columns[field.id] === "number" ? record[columns[field.id] as number] : ""]));
    try { return validateValues(fields, values); }
    catch (error) { if (error instanceof InputError) throw new InputError(`${index + 2}行目: ${error.message}`); throw error; }
  });
}

export function exportCsv(fields: Field[], rows: MasterRow[]): string {
  const escape = (value: string | number) => {
    let text = String(value);
    // Spreadsheet applications must not execute text cells as formulas.
    if (typeof value === "string" && /^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return "\uFEFF" + [fields.map((field) => field.name), ...rows.map((row) => fields.map((field) => row.values[field.id] ?? ""))].map((row) => row.map(escape).join(",")).join("\r\n") + "\r\n";
}
