import { createMessage } from "./actions";
import { loadDemoMessages } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const database = await loadDemoMessages();
  const runtimeVersion =
    process.env.VERSION?.trim() ||
    process.env.APTH_COMPONENT_VERSION?.trim() ||
    "unset";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">
              AppThrust sample
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">
              Managed PostgreSQL messages
            </h1>
          </div>
          <StatusBadge status={database.status} />
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <Metric label="Connection" value={databaseStatusLabel(database.status)} />
          <Metric label="Database" value={database.databaseName ?? "unavailable"} />
          <Metric label="Messages" value={String(database.messages.length)} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-medium">Recent messages</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {database.messages.length > 0 ? (
                database.messages.map((message) => (
                  <article key={message.id} className="px-5 py-4">
                    <p className="text-sm text-slate-950">{message.body}</p>
                    <p className="mt-1 font-mono text-xs text-slate-500">
                      #{message.id} · {message.createdAt}
                    </p>
                  </article>
                ))
              ) : (
                <div className="px-5 py-10 text-sm text-slate-500">
                  {emptyStateMessage(database.status)}
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <form
              action={createMessage}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <label
                htmlFor="body"
                className="text-sm font-medium text-slate-900"
              >
                New message
              </label>
              <textarea
                id="body"
                name="body"
                rows={4}
                maxLength={280}
                placeholder="Write a database-backed message"
                className="mt-2 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
              <button
                type="submit"
                disabled={database.status !== "ready"}
                className="mt-3 w-full rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Save message
              </button>
            </form>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-medium">Runtime</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <InfoRow
                  label="DATABASE_URL"
                  value={database.databaseUrlPresent ? "provided" : "missing"}
                />
                <InfoRow label="Host" value={database.host ?? "unavailable"} />
                <InfoRow
                  label="Migration"
                  value={
                    database.status === "migration-pending"
                      ? "pending"
                      : database.status === "ready"
                        ? "applied"
                        : "unknown"
                  }
                />
              </dl>
            </div>
          </aside>
        </section>

        <footer className="border-t border-slate-200 pt-4 text-xs text-slate-500">
          <span>Runtime version</span>
          <span className="ml-2 font-mono text-slate-700">
            VERSION={runtimeVersion}
          </span>
        </footer>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const ready = status === "ready";

  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-sm font-medium ${
        ready
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-amber-200 bg-amber-50 text-amber-800"
      }`}
    >
      {databaseStatusLabel(status)}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-2 truncate text-lg font-semibold">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 truncate font-mono text-xs text-slate-900">
        {value}
      </dd>
    </div>
  );
}

function databaseStatusLabel(status: string) {
  switch (status) {
    case "ready":
      return "Connected";
    case "migration-pending":
      return "Migration pending";
    case "missing-url":
      return "Not connected";
    default:
      return "Unavailable";
  }
}

function emptyStateMessage(status: string) {
  switch (status) {
    case "migration-pending":
      return "The database is reachable, but the initial schema has not been applied yet.";
    case "missing-url":
      return "DATABASE_URL is not configured for this runtime.";
    case "unavailable":
      return "The database could not be reached from this runtime.";
    default:
      return "No messages have been saved yet.";
  }
}
