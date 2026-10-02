import { createContext, useContext, useRef } from "react";
import Icon from "../../components/Icon.jsx";

export const AdminOptionsContext = createContext(null);
export const filterParams = ["userId", "watchId", "when", "since", "until", "minScore", "status", "feedbackSource", "emailStatus", "kind", "verdict", "handled", "stage", "stuck", "name", "scheduleKey", "notify", "wouldPay", "band", "reason", "requestId", "behind", "activeSince", "createdSince", "createdUntil", "section", "mode", "device", "value", "q"];
const dateValue = (value) => value && Number.isFinite(Number(value)) ? new Date(Number(value)).toISOString().slice(0, 10) : "";
const dateNumber = (value, end = false) => value ? Date.parse(`${value}T00:00:00Z`) + (end ? 86_400_000 : 0) : undefined;

export default function FilterBar({ params, update, user = true, watch = false, score = false, status, search = true }) {
  const options = useContext(AdminOptionsContext);
  const users = user ? options?.users : undefined;
  const watches = watch ? options?.watches?.filter((w) => !params.userId || w.userId === params.userId) : undefined;
  const sheet = useRef(null);
  const set = (key, value) => update({ [key]: value || undefined, ...(key === "userId" ? { watchId: undefined } : {}) });
  const chipValue = (key) => {
    if (key === "userId") return users?.find((u) => u._id === params.userId)?.email ?? params.userId;
    if (key === "watchId") return watches?.find((w) => w._id === params.watchId)?.title ?? params.watchId;
    if (["since", "until", "activeSince", "createdSince", "createdUntil"].includes(key)) return dateValue(params[key]);
    return params[key];
  };
  const chipLabel = (key) => ({ userId: "User", watchId: "Watch", when: "When", since: "Since", until: "Until",
    minScore: "Score ≥", q: "Search", emailStatus: "E-mail", kind: "Kind", verdict: "Verdict",
    requestId: "Request ID", activeSince: "Active since", createdSince: "Created since", createdUntil: "Created until",
  })[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
  const controls = <>
    {user && <label>User<select aria-label="User" value={params.userId ?? ""} onChange={(e) => set("userId", e.target.value)}>
      <option value="">All users</option>{users?.map((u) => <option key={u._id} value={u._id}>{u.email}</option>)}
    </select></label>}
    {watch && <label>Watch<select aria-label="Watch" value={params.watchId ?? ""} onChange={(e) => set("watchId", e.target.value)}>
      <option value="">All watches</option>{watches?.map((w) => <option key={w._id} value={w._id}>{w.title}</option>)}
    </select></label>}
    <label>When<select aria-label="When" value={params.when ?? (params.since || params.until ? "custom" : "")} onChange={(e) => {
      const when = e.target.value;
      update({ when: when || undefined, since: undefined, until: undefined });
    }}>
      <option value="">Any time</option><option value="today">Today</option><option value="7d">7 d</option>
      <option value="30d">30 d</option><option value="custom">Custom</option>
    </select></label>
    {(params.when === "custom" || params.since || params.until) && <>
      <label>Since<input aria-label="Since" type="date" value={dateValue(params.since)} onChange={(e) => update({ when: "custom", since: dateNumber(e.target.value) })} /></label>
      <label>Until<input aria-label="Until" type="date" value={dateValue(params.until && Number(params.until) - 1)} onChange={(e) => update({ when: "custom", until: dateNumber(e.target.value, true) })} /></label>
    </>}
    {score && <label>Score ≥<input aria-label="Minimum score" type="number" min="0" max="10" step="1" value={params.minScore ?? ""} onChange={(e) => set("minScore", e.target.value)} /></label>}
    {status && <label>{status.label}<select aria-label={status.label} value={params[status.key] ?? ""} onChange={(e) => set(status.key, e.target.value)}>
      <option value="">All</option>{status.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>}
    {search && <label className="filter-text"><Icon name="search" size={15} /><input aria-label="Search list" type="search" placeholder="Search" value={params.q ?? ""} onChange={(e) => set("q", e.target.value)} /></label>}
  </>;
  const active = filterParams.filter((key) => params[key] !== undefined && params[key] !== "");
  return <div className="filter-bar">
    <div className="filter-controls">{controls}</div>
    <button className="button filter-toggle" onClick={() => sheet.current?.showModal()}>Filters{active.length ? ` (${active.length})` : ""}</button>
    <dialog className="sheet filter-sheet" ref={sheet} onClick={(e) => { if (e.target === sheet.current) sheet.current.close(); }}>
      <div className="sheet-inner"><div className="sheet-head"><h2>Filters</h2><button className="icon-button" aria-label="Close filters" onClick={() => sheet.current?.close()}><Icon name="close" /></button></div>
        <div className="sheet-body filter-controls">{controls}</div></div>
    </dialog>
    {active.length > 0 && <div className="filter-chips">{active.map((key) => <button className="chip" key={key} onClick={() => update({ [key]: undefined })} aria-label={`Remove ${chipLabel(key)} filter`}>{chipLabel(key)}: {chipValue(key)} ×</button>)}
      <button className="link-button" onClick={() => update(Object.fromEntries(filterParams.map((key) => [key, undefined])))}>Clear all</button></div>}
  </div>;
}
