import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useDateFilters, when } from "./nav.js";
import FilterBar from "./FilterBar.jsx";
import Table from "./Table.jsx";

const money = (n, symbol = "€") => `${symbol}${n.toFixed(2)}`;
const kinds = { watch: "Watch checks", chat: "Chat questions", estimate: "Watch estimates", owner: "Owner admin and audit", embedding: "Embeddings", "offer help": "Offer help" };
export function spendState(usd, cap) {
  if (!cap) return "uncapped";
  return usd / cap >= 0.95 ? "danger" : usd / cap >= 0.8 ? "warning" : "normal";
}

export function OpenAiSpendCard({ open }) {
  const data = useQuery(api.openaiSpend.month, {});
  if (!data || typeof data.measuredEur !== "number") return null;
  const usd = data.billed?.usd ?? data.measuredUsd;
  const left = data.capUsd === null ? null : Math.max(0, data.capUsd - usd);
  const ratio = data.capUsd ? Math.min(1, usd / data.capUsd) : 0;
  const tone = spendState(usd, data.capUsd);
  return <section className={`panel openai-spend ${tone}`} aria-label="OpenAI spend this month">
    <h2><button className="link-button strong" onClick={() => open("spend", "OpenAI spend this month")}>OpenAI this month →</button></h2>
    <p className="spend-value">{money(usd, "$")}{data.capUsd ? ` of ${money(data.capUsd, "$")} · ${money(left, "$")} left (${Math.round(usd / data.capUsd * 100)}%)` : " · monthly cap not set"}</p>
    {data.capUsd && <div className="spend-track" role="progressbar" aria-label="Monthly OpenAI cap used" aria-valuenow={Math.round(ratio * 100)} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${ratio * 100}%` }} /></div>}
    <p className="hint">Measured by the app: {money(data.measuredEur)} (about {money(data.measuredUsd, "$")}). {data.billed ? `Billed by OpenAI: ${money(data.billed.usd, "$")} · updated ${when(data.billed.updatedAt)}.` : data.connected ? "OpenAI billing figure is waiting for its first update." : "OpenAI billing figure not connected."}</p>
    {data.backfillPending && <p className="hint">The monthly summary is checking earlier app usage.</p>}
    <p className="hint">The real hard cap lives in OpenAI settings. App measurements use estimated prices and an approximate exchange rate.</p>
    <button className="link-button" onClick={() => open("spend", "Where the money goes")}>Where the money goes →</button>
  </section>;
}

export function OpenAiSpendView({ params, update, open }) {
  const dates = useDateFilters(params);
  const data = useQuery(api.openaiSpend.month, { userId: params.userId, watchId: params.watchId, kind: params.kind,
    since: dates.since, until: dates.until });
  if (data === undefined) return <p className="hint">Loading…</p>;
  if (!data) return null;
  const amount = { key: "cost", label: "Spend", align: "right", mono: true,
    render: (r) => money(r.cost), sort: (r) => r.cost, csv: (r) => r.cost.toFixed(4) };
  const map = (record, make) => Object.entries(record).map(([id, value]) => ({ _id: id, ...make(id, value) }));
  const kindRows = Object.entries(kinds).map(([id, name]) => ({ _id: id, name, cost: data.kinds[id] ?? 0 }));
  const dayRows = map(data.days, (id, cost) => ({ day: id, cost,
    ...Object.fromEntries(Object.keys(kinds).map((kind) => [kind, data.dailyKinds[id]?.[kind] ?? 0])) }));
  const userRows = map(data.users, (id, value) => ({ email: data.userLabels[id]?.email ?? "Deleted account",
    cost: value.totalEur, budget: data.userLabels[id]?.limitEur ?? 1,
    ...Object.fromEntries(Object.keys(kinds).map((kind) => [kind, value.kinds[kind] ?? 0])) }));
  const watchRows = map(data.watches, (id, value) => ({ title: data.watchLabels[id]?.title ?? "Deleted watch", ...value, cost: value.totalEur }));
  const chatRows = map(data.chats, (id, value) => ({ title: data.chatLabels[id]?.title ?? "Deleted chat", ...value, cost: value.totalEur }));
  const questionRows = map(data.questionCosts, (id, value) => ({ title: data.chatLabels[value.chatId]?.title ?? "Deleted chat",
    chatId: value.chatId, at: value.at, cost: value.totalEur }));
  const openUser = (r) => open({ view: "spend", title: `AI spend · ${r.email}`, params: { userId: r._id } });
  return <div className="stack">
    <FilterBar params={params} update={update} watch status={{ key: "kind", label: "AI work", options: Object.entries(kinds) }} />
    <p className="hint">Measured by the app, this calendar month: {money(data.measuredEur)}. A watch alert has no separate AI charge; cost per alert divides the check cost by alerts sent.</p>
    {data.backfillPending && <p className="hint">The hourly update is checking earlier app usage.</p>}
    <section><h3>Spend by kind</h3><Table name="openai-by-kind" rows={kindRows} columns={[{ key: "name", label: "AI work" }, amount]} initialSort={{ key: "cost", dir: -1 }} /></section>
    <section><h3>Spend per day</h3><Table name="openai-by-day" rows={dayRows} columns={[{ key: "day", label: "Day" }, amount,
      ...Object.entries(kinds).map(([key, label]) => ({ key, label, render: (r) => money(r[key]), sort: (r) => r[key] }))]} /></section>
    <section><h3>Spend per user</h3><Table name="openai-by-user" rows={userRows} initialSort={{ key: "cost", dir: -1 }} onOpen={openUser}
      columns={[{ key: "email", label: "Account" }, amount, { key: "budget", label: "Budget used", render: (r) => `${money(r.cost)} of ${money(r.budget)}`, sort: (r) => r.cost / r.budget },
        ...Object.entries(kinds).map(([key, label]) => ({ key, label, render: (r) => money(r[key]), sort: (r) => r[key] }))]} /></section>
    {!params.userId && !params.watchId && <p className="hint">Choose a user to see their watches, chats, and questions.</p>}
    {(params.userId || params.watchId) && <section><h3>Per watch</h3><Table name="openai-by-watch" rows={watchRows} onOpen={(r) => open({ view: "watch", title: r.title, params: { id: r._id } })}
      columns={[{ key: "title", label: "Watch" }, amount, { key: "checks", label: "Checks" }, { key: "listingsScored", label: "Listings scored" },
        { key: "alertsSent", label: "Alerts sent" }, { key: "costPerAlertEur", label: "€ per alert", render: (r) => r.alertsSent ? money(r.costPerAlertEur) : "–" }]} /></section>}
    {(params.userId || params.watchId) && <section><h3>Per chat</h3><Table name="openai-by-chat" rows={chatRows} onOpen={(r) => open({ view: "chat", title: r.title, params: { id: r._id } })}
      columns={[{ key: "title", label: "Conversation" }, amount, { key: "questions", label: "Questions" },
        { key: "costPerQuestionEur", label: "€ per question", render: (r) => money(r.costPerQuestionEur) }]} /></section>}
    {(params.userId || params.watchId) && <section><h3>Per question</h3><Table name="openai-by-question" rows={questionRows} onOpen={(r) => open({ view: "chat", title: r.title, params: { id: r.chatId } })}
      columns={[{ key: "title", label: "Conversation" }, { key: "at", label: "Asked", render: (r) => when(r.at) }, amount]} /></section>
    }
  </div>;
}
