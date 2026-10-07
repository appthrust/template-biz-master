"use server";

import { revalidatePath } from "next/cache";
import type { PoolClient } from "pg";
import { recordHistory, transaction } from "@/lib/db";
import { InputError, fieldTypeLabels, mapCsv, requiredText, validateFields, validateValues, type ActionResult, type Master, type MasterRow } from "@/lib/master";

function parseJson(value: FormDataEntryValue | null): unknown {
  try { return JSON.parse(String(value ?? "")); }
  catch { throw new InputError("入力内容を読み取れませんでした。画面を開き直してください。"); }
}

function identifier(value: FormDataEntryValue | null): string {
  const id = String(value ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new InputError("対象が見つかりません。画面を開き直してください。");
  return id;
}

async function loadMaster(client: PoolClient, formData: FormData): Promise<Master> {
  const result = await client.query<Master>("SELECT id, name, fields FROM master_kinds WHERE id = $1", [identifier(formData.get("masterId"))]);
  if (!result.rows[0]) throw new InputError("マスターが見つかりません。画面を開き直してください。");
  return result.rows[0];
}

async function perform(operation: (client: PoolClient) => Promise<ActionResult>): Promise<ActionResult> {
  try {
    const result = await transaction(operation);
    revalidatePath("/");
    return result;
  } catch (error) {
    if (error instanceof InputError) return { ok: false, message: error.message };
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return { ok: false, message: "同じ名前のマスターがあります。別の名前を入力してください。" };
    console.error("Master operation failed", error instanceof Error ? error.message : "Unknown error");
    return { ok: false, message: "保存できませんでした。入力内容は残っています。しばらくしてからもう一度お試しください。" };
  }
}

export async function createMaster(formData: FormData): Promise<ActionResult> {
  return perform(async (client) => {
    const name = requiredText(formData.get("name"), "マスター名");
    const actor = requiredText(formData.get("actor"), "記録する名前");
    const fields = validateFields(parseJson(formData.get("fields")));
    const result = await client.query<{ id: string }>("INSERT INTO master_kinds (name, fields) VALUES ($1, $2) RETURNING id", [name, JSON.stringify(fields)]);
    const masterId = result.rows[0].id;
    await recordHistory(client, masterId, null, "master", actor, null, { "マスター名": name, "項目": fields.map((field) => `${field.name}（${fieldTypeLabels[field.type]}${field.required ? "・必須" : ""}）`).join("、") });
    return { ok: true, message: `「${name}」を作成しました。`, masterId };
  });
}

export async function saveRow(formData: FormData): Promise<ActionResult> {
  return perform(async (client) => {
    const master = await loadMaster(client, formData);
    const actor = requiredText(formData.get("actor"), "記録する名前");
    const values = validateValues(master.fields, parseJson(formData.get("values")));
    const rowId = formData.get("rowId");
    if (rowId) {
      const id = identifier(rowId);
      const current = await client.query<MasterRow>("SELECT id, values, version FROM master_rows WHERE id = $1 AND master_id = $2 FOR UPDATE", [id, master.id]);
      const before = current.rows[0];
      if (!before) throw new InputError("この行は削除されています。一覧を開き直してください。");
      if (before.version !== Number(formData.get("version"))) throw new InputError("ほかの人がこの行を変更しました。編集を閉じ、一覧を再読み込みしてからやり直してください。");
      await client.query("UPDATE master_rows SET values = $1, version = version + 1, updated_at = NOW() WHERE id = $2", [JSON.stringify(values), id]);
      await recordHistory(client, master.id, id, "update", actor, before.values, values);
    } else {
      const result = await client.query<{ id: string }>("INSERT INTO master_rows (master_id, values) VALUES ($1, $2) RETURNING id", [master.id, JSON.stringify(values)]);
      await recordHistory(client, master.id, result.rows[0].id, "create", actor, null, values);
    }
    return { ok: true, message: rowId ? "変更を保存しました。" : "新しい行を追加しました。" };
  });
}

export async function deleteRow(formData: FormData): Promise<ActionResult> {
  return perform(async (client) => {
    const master = await loadMaster(client, formData);
    const actor = requiredText(formData.get("actor"), "記録する名前");
    const id = identifier(formData.get("rowId"));
    const result = await client.query<MasterRow>("SELECT id, values, version FROM master_rows WHERE id = $1 AND master_id = $2 FOR UPDATE", [id, master.id]);
    const row = result.rows[0];
    if (!row) throw new InputError("この行はすでに削除されています。一覧を開き直してください。");
    if (row.version !== Number(formData.get("version"))) throw new InputError("ほかの人がこの行を変更しました。一覧を再読み込みして内容を確認してください。");
    await client.query("DELETE FROM master_rows WHERE id = $1", [id]);
    await recordHistory(client, master.id, id, "delete", actor, row.values, null);
    return { ok: true, message: "行を削除しました。変更履歴から削除前の内容を確認できます。" };
  });
}

export async function importRows(formData: FormData): Promise<ActionResult> {
  return perform(async (client) => {
    const master = await loadMaster(client, formData);
    const actor = requiredText(formData.get("actor"), "記録する名前");
    const rows = mapCsv(master.fields, String(formData.get("csv") ?? ""), parseJson(formData.get("mapping")));
    for (const values of rows) {
      const result = await client.query<{ id: string }>("INSERT INTO master_rows (master_id, values) VALUES ($1, $2) RETURNING id", [master.id, JSON.stringify(values)]);
      await recordHistory(client, master.id, result.rows[0].id, "import", actor, null, values);
    }
    return { ok: true, message: `${rows.length}件を取り込みました。` };
  });
}
