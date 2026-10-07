import MasterApp from "./master-app";
import { listHistory, listMasters, listRows } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ master?: string }> }) {
  const { master: selectedId } = await searchParams;
  let data;
  try {
    const masters = await listMasters();
    const master = masters.find((item) => item.id === selectedId) ?? masters[0];
    if (!master) throw new Error("Master schema has no initial masters");
    const [rows, history] = await Promise.all([listRows(master.id), listHistory(master.id)]);
    data = { masters, master, rows, history };
  } catch (error) {
    console.error("Master data unavailable", error instanceof Error ? error.message : "Unknown error");
    return <main className="unavailable"><span className="brand-mark" aria-hidden="true">M</span><h1>マスター管理を開けませんでした</h1><p>データの準備中か、一時的につながらない状態です。</p><p>しばらくしてから再読み込みしてください。続く場合は、基盤の担当者にご連絡ください。</p><a className="button primary" href="/">再読み込み</a></main>;
  }
  return <MasterApp key={data.master.id} {...data} />;
}
