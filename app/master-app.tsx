"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createMaster, deleteRow, importRows, saveRow } from "./actions";
import { CSV_MAX_BYTES, exportCsv, fieldTypeLabels, parseCsv, type ActionResult, type Field, type FieldType, type HistoryEntry, type Master, type MasterRow, type Values } from "@/lib/master";

type DraftField = { name: string; type: FieldType; required: boolean; options: string };
const newField = (): DraftField => ({ name: "", type: "text", required: false, options: "" });
const actionLabels: Record<HistoryEntry["action"], string> = { master: "マスター作成", create: "追加", update: "変更", delete: "削除", import: "CSV取込" };

function Dialog({ title, onClose, busy, children }: { title: string; onClose: () => void; busy: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); opener?.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby="dialog-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="dialog-head"><h2 id="dialog-title">{title}</h2><button type="button" className="quiet" onClick={onClose} disabled={busy} aria-label="閉じる">閉じる</button></div>
    {children}
  </dialog>;
}

export default function MasterApp({ masters, master, rows, history }: { masters: Master[]; master: Master; rows: MasterRow[]; history: HistoryEntry[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"rows" | "history">("rows");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("");
  const [descending, setDescending] = useState(false);
  const [panel, setPanel] = useState<"row" | "master" | "import" | "delete" | null>(null);
  const [editing, setEditing] = useState<MasterRow | null>(null);
  const [values, setValues] = useState<Values>({});
  const [actor, setActor] = useState("");
  const [masterName, setMasterName] = useState("");
  const [fields, setFields] = useState<DraftField[]>([{ ...newField(), required: true }]);
  const [csv, setCsv] = useState("");
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, number | "">>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, startTransition] = useTransition();
  useEffect(() => { try { setActor(localStorage.getItem("master:actor") ?? ""); } catch { /* Storage is optional. */ } }, []);
  const updateActor = (value: string) => {
    setActor(value);
    try { localStorage.setItem("master:actor", value); } catch { /* The name remains usable without storage. */ }
  };
  const open = (next: typeof panel, row: MasterRow | null = null) => {
    setEditing(row); setValues(row?.values ?? {}); setError(""); setNotice("");
    if (next === "import") { setCsv(""); setCsvRows([]); setMapping({}); }
    if (next === "master") { setMasterName(""); setFields([{ ...newField(), required: true }]); }
    setPanel(next);
  };
  const submit = (action: (data: FormData) => Promise<ActionResult>, data: FormData) => {
    data.set("actor", actor);
    data.set("masterId", master.id);
    setError("");
    startTransition(async () => {
      try {
        const result = await action(data);
        if (!result.ok) { setError(result.message); return; }
        setPanel(null); setNotice(result.message);
        if (result.masterId) router.push(`/?master=${result.masterId}`);
        else router.refresh();
      } catch {
        setError("通信できませんでした。入力内容は残っています。接続を確認してもう一度お試しください。");
      }
    });
  };
  const keyword = query.trim().toLocaleLowerCase("ja");
  const visibleRows = rows.filter((row) => Object.values(row.values).some((value) => String(value).toLocaleLowerCase("ja").includes(keyword)));
  const sortField = master.fields.find((field) => field.id === sort);
  if (sortField) visibleRows.sort((a, b) => {
    const left = a.values[sort] ?? "", right = b.values[sort] ?? "";
    const comparison = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right), "ja", { numeric: true });
    return descending ? -comparison : comparison;
  });
  const download = () => {
    const url = URL.createObjectURL(new Blob([exportCsv(master.fields, visibleRows)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = `${master.name}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`表示中の${visibleRows.length}件を書き出しました。`);
  };
  const actorInput = <label>記録する名前 <span className="required">必須</span><input name="actor" value={actor} onChange={(event) => updateActor(event.target.value)} required maxLength={80} autoComplete="name" /><small>変更履歴に残す名前です（自己申告）。</small></label>;
  const formEnd = (label: string, disabled = false) => <>
    {error && <p role="alert" className="error">{error}</p>}
    <div className="form-actions"><button type="button" onClick={() => setPanel(null)} disabled={busy}>キャンセル</button><button className={panel === "delete" ? "danger" : "primary"} disabled={busy || disabled}>{busy ? "保存中…" : label}</button></div>
  </>;

  return <div className="app-shell">
    <a href="#content" className="skip-link">本文へ移動</a>
    <aside className="sidebar">
      <a className="brand" href="/"><span className="brand-mark" aria-hidden="true">M</span><span>マスター管理</span></a>
      <p className="nav-label">マスター</p>
      <nav aria-label="マスターを選ぶ">{masters.map((item) => <a key={item.id} className="master-link" href={`/?master=${item.id}`} aria-current={item.id === master.id ? "page" : undefined}><span>{item.name}</span><span className="count">{item.count}</span></a>)}</nav>
      <button className="add-master" onClick={() => open("master")}>＋ マスターを追加</button>
      <p className="sidebar-note">業務の基本情報を、<br />ひとつの場所に。</p>
    </aside>
    <main id="content" className="workspace">
      <header className="page-head"><div><p className="eyebrow">マスター管理</p><h1>{master.name}</h1><p className="muted">基本情報をそろえて、日々の仕事をスムーズに。</p></div><button className="primary" onClick={() => open("row")}>＋ 行を追加</button></header>
      <div className="tabs" aria-label="表示を切り替える"><button aria-pressed={tab === "rows"} onClick={() => setTab("rows")}>一覧 <span>{rows.length}</span></button><button aria-pressed={tab === "history"} onClick={() => setTab("history")}>変更履歴</button></div>
      {notice && <p className="notice" role="status">{notice}</p>}
      {tab === "rows" ? <section aria-label={`${master.name}の一覧`}>
        <div className="toolbar"><label className="search"><span className="sr-only">一覧を検索</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`${master.name}を検索`} /></label><div className="toolbar-actions"><button onClick={() => open("import")}>CSV取込</button><button onClick={download} disabled={!visibleRows.length}>CSV書き出し</button></div></div>
        <div className="list-info"><p aria-live="polite">{visibleRows.length}件{query && ` / 全${rows.length}件`}</p><div className="sort-controls"><label htmlFor="sort">並び順</label><select id="sort" value={sort} onChange={(event) => setSort(event.target.value)}><option value="">追加した順</option>{master.fields.map((field) => <option value={field.id} key={field.id}>{field.name}</option>)}</select>{sort && <button onClick={() => setDescending(!descending)} aria-label={descending ? "昇順にする" : "降順にする"}>{descending ? "降順 ↓" : "昇順 ↑"}</button>}</div></div>
        {visibleRows.length ? <div className="table-wrap"><table className="records"><thead><tr>{master.fields.map((field) => <th key={field.id} scope="col" aria-sort={sort === field.id ? descending ? "descending" : "ascending" : "none"}>{field.name}</th>)}<th scope="col">操作</th></tr></thead><tbody>{visibleRows.map((row) => <tr key={row.id}>{master.fields.map((field) => <td key={field.id} data-label={field.name}>{field.type === "select" && row.values[field.id] ? <span className="tag">{row.values[field.id]}</span> : String(row.values[field.id] ?? "") || <span className="muted">—</span>}</td>)}<td data-label="操作" className="row-actions"><button className="quiet" onClick={() => open("row", row)} aria-label={`${row.values[master.fields[0].id] || "この行"}を編集`}>編集</button><button className="quiet danger-text" onClick={() => open("delete", row)} aria-label={`${row.values[master.fields[0].id] || "この行"}を削除`}>削除</button></td></tr>)}</tbody></table></div> : <div className="empty"><h2>{query ? "条件に合う行がありません" : "まだデータがありません"}</h2><p>{query ? "別の言葉で検索するか、検索を解除してください。" : "最初の1件を追加するか、CSVからまとめて取り込めます。"}</p>{query ? <button onClick={() => setQuery("")}>検索を解除</button> : <button onClick={() => open("row")}>行を追加</button>}</div>}
        <p className="footnote">CSV書き出しには、検索結果と並び順が反映されます。</p>
        <details className="field-summary"><summary>登録項目を見る · {master.fields.length}項目</summary><dl>{master.fields.map((field) => <div key={field.id}><dt>{field.name}</dt><dd>{fieldTypeLabels[field.type]}{field.required && "・必須"}{field.type === "select" && `（${field.options.join(" / ")}）`}</dd></div>)}</dl></details>
      </section> : <section className="history" aria-label="変更履歴"><div className="section-head"><h2>いつ、誰が、何を変えたか</h2><p className="muted">直近100件 · 日時は日本時間 · 名前は自己申告</p></div>{history.length ? <ol>{history.map((entry) => <li key={entry.id}><div className="history-meta"><span className="tag">{actionLabels[entry.action]}</span><strong>{entry.actor}</strong><time dateTime={new Date(entry.at).toISOString()}>{new Date(entry.at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</time></div><dl className="changes">{entry.action === "master" ? Object.entries(entry.after ?? {}).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{String(value)}</dd></div>) : master.fields.filter((field) => !entry.before || !entry.after || entry.before[field.id] !== entry.after[field.id]).map((field) => <div key={field.id}><dt>{field.name}</dt><dd>{entry.before && <><span className={entry.after ? "old-value" : ""}>{String(entry.before[field.id] ?? "") || "未入力"}</span>{entry.after && <span className="muted"> → </span>}</>}{entry.after && <span>{String(entry.after[field.id] ?? "") || "未入力"}</span>}</dd></div>)}</dl></li>)}</ol> : <div className="empty"><h2>変更履歴はまだありません</h2><p>追加・変更・削除した内容がここに残ります。</p></div>}</section>}
      <footer>マスター管理<span>取引先・商品・部署、必要な情報を自由に。</span></footer>
    </main>

    {panel === "row" && <Dialog title={editing ? "行を編集" : `${master.name}に行を追加`} busy={busy} onClose={() => setPanel(null)}><form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); data.set("values", JSON.stringify(values)); if (editing) { data.set("rowId", editing.id); data.set("version", String(editing.version)); } submit(saveRow, data); }}><div className="form-body">{master.fields.map((field) => <label key={field.id}>{field.name} {field.required && <span className="required">必須</span>}{field.type === "select" ? <select required={field.required} value={values[field.id] ?? ""} onChange={(event) => setValues({ ...values, [field.id]: event.target.value })}><option value="">選んでください</option>{field.options.map((option) => <option key={option}>{option}</option>)}</select> : <input required={field.required} type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} step={field.type === "number" ? "any" : undefined} maxLength={2000} value={values[field.id] ?? ""} onChange={(event) => setValues({ ...values, [field.id]: event.target.value })} />}</label>)}<hr />{actorInput}</div>{formEnd(editing ? "変更を保存" : "追加する")}</form></Dialog>}

    {panel === "delete" && editing && <Dialog title="この行を削除しますか？" busy={busy} onClose={() => setPanel(null)}><form onSubmit={(event) => { event.preventDefault(); const data = new FormData(); data.set("rowId", editing.id); data.set("version", String(editing.version)); submit(deleteRow, data); }}><div className="form-body"><p><strong>{String(editing.values[master.fields[0].id] ?? "") || "選択した行"}</strong></p><p className="muted">一覧から削除されます。削除前の内容は変更履歴に残ります。</p>{actorInput}</div>{formEnd("削除する")}</form></Dialog>}

    {panel === "master" && <Dialog title="マスターを追加" busy={busy} onClose={() => setPanel(null)}><form onSubmit={(event) => { event.preventDefault(); const data = new FormData(); data.set("name", masterName); data.set("fields", JSON.stringify(fields.map((field) => ({ ...field, options: field.type === "select" ? field.options.split("\n").map((option) => option.trim()).filter(Boolean) : [] })))); submit(createMaster, data); }}><div className="form-body"><label>マスター名 <span className="required">必須</span><input required value={masterName} onChange={(event) => setMasterName(event.target.value)} maxLength={80} placeholder="例：拠点、設備、契約種別" /></label><div className="section-head"><h3>登録する項目</h3><p className="muted">名前と種類を決めます。最大20項目。</p></div>{fields.map((field, index) => <fieldset className="field-editor" key={index}><legend>項目 {index + 1}</legend><div className="field-grid"><label>項目名<input required aria-label={`項目${index + 1}の名前`} maxLength={40} value={field.name} onChange={(event) => setFields(fields.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} /></label><label>種類<select aria-label={`項目${index + 1}の種類`} value={field.type} onChange={(event) => setFields(fields.map((item, i) => i === index ? { ...item, type: event.target.value as FieldType } : item))}>{Object.entries(fieldTypeLabels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label></div>{field.type === "select" && <label>選択肢（1行に1つ）<textarea required rows={3} value={field.options} onChange={(event) => setFields(fields.map((item, i) => i === index ? { ...item, options: event.target.value } : item))} /></label>}<div className="field-bottom"><label className="checkbox"><input type="checkbox" checked={field.required} onChange={(event) => setFields(fields.map((item, i) => i === index ? { ...item, required: event.target.checked } : item))} />必須にする</label><button type="button" className="quiet danger-text" disabled={fields.length === 1} onClick={() => setFields(fields.filter((_, i) => i !== index))} aria-label={`項目${index + 1}を外す`}>項目を外す</button></div></fieldset>)}<button type="button" disabled={fields.length >= 20} onClick={() => setFields([...fields, newField()])}>＋ 項目を追加</button><hr />{actorInput}</div>{formEnd("マスターを作成")}</form></Dialog>}

    {panel === "import" && <Dialog title="CSVから取り込む" busy={busy} onClose={() => setPanel(null)}><form onSubmit={(event) => { event.preventDefault(); const data = new FormData(); data.set("csv", csv); data.set("mapping", JSON.stringify(mapping)); submit(importRows, data); }}><div className="form-body"><p className="muted">新しい行として追加します。既存の行は上書きしません。エラーがあれば1件も取り込みません。</p><label>CSVファイル<input type="file" accept=".csv,text/csv" disabled={busy} onChange={async (event) => {
      const file = event.target.files?.[0]; setCsv(""); setCsvRows([]); setError(""); if (!file) return;
      try {
        if (file.size > CSV_MAX_BYTES) throw new Error("CSVは200KB以内にしてください。");
        const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
        const parsed = parseCsv(text);
        setCsv(text); setCsvRows(parsed);
        setMapping(Object.fromEntries(master.fields.map((field) => { const index = parsed[0].findIndex((name) => name.trim() === field.name); return [field.id, index < 0 ? "" : index]; })));
      } catch (cause) { setError(cause instanceof TypeError ? "文字コードがUTF-8のCSVを選んでください。" : cause instanceof Error ? cause.message : "ファイルを読み取れませんでした。"); }
    }} /><small>UTF-8 / 先頭行は列名 / 200KB・1000件まで</small></label>{csvRows.length > 0 && <><h3>列の対応を確認</h3><p className="muted">{csvRows.length - 1}件を取り込みます。必須項目には列を割り当ててください。</p><div className="mapping">{master.fields.map((field) => <label key={field.id}>{field.name} {field.required && <span className="required">必須</span>}<select required={field.required} value={mapping[field.id] ?? ""} onChange={(event) => setMapping({ ...mapping, [field.id]: event.target.value === "" ? "" : Number(event.target.value) })}><option value="">取り込まない</option>{csvRows[0].map((header, index) => <option value={index} key={index}>{index + 1}列目：{header}</option>)}</select></label>)}</div><h3>取込前の確認（先頭3件）</h3><div className="table-wrap"><table className="preview"><thead><tr>{master.fields.map((field) => <th key={field.id}>{field.name}</th>)}</tr></thead><tbody>{csvRows.slice(1, 4).map((row, index) => <tr key={index}>{master.fields.map((field) => <td key={field.id}>{typeof mapping[field.id] === "number" ? row[mapping[field.id] as number] : "—"}</td>)}</tr>)}</tbody></table></div></>}<hr />{actorInput}</div>{formEnd("取り込む", !csv)}</form></Dialog>}
  </div>;
}
