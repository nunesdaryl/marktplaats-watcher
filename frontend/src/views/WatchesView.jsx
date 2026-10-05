import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import Icon from "../components/Icon.jsx";
import RowMenu from "../components/RowMenu.jsx";
import { go } from "../lib/router.js";
import { scoreLevel } from "../../convex/schedule";

/** The phone's Watches tab: inset grouped lists like iOS Settings, pinned first, folders, and the archive. */
export default function WatchesView({ watches: watchesOrLoading, actions, onNew }) {
  const watches = watchesOrLoading ?? [];
  const folders = useQuery(api.folders.list) ?? [];
  const budget = useQuery(api.aiBudget.mine);
  const row = (w) => {
    const best = w.alerts[0];
    return (
      <li key={w._id} className="grouped-row">
        <button onClick={() => go(`/w/${w._id}`)}>
          {w.pinned && <Icon name="pin" size={18} />}
          <span className="text">
            <span className="primary-text">{w.title}</span>
            <span className="secondary-text">{w.active ? w.summary : "Paused"}</span>
          </span>
          {best?.score !== undefined && <span className={`pill score-pill ${scoreLevel(best.score)}`}>{best.score}/10 · {scoreLevel(best.score)}</span>}
        </button>
        <RowMenu items={actions.watchItems(w)} label={`Options for ${w.title}`} />
      </li>
    );
  };
  const loose = watches.filter((w) => !w.folderId);
  return (
    <section className="page" aria-labelledby="watches-title">
      <header className="page-head row-head">
        <h1 id="watches-title">Watches</h1>
        {(watchesOrLoading === undefined || watches.length > 0) && <button className="button tinted" onClick={onNew}><Icon name="plus" size={18} />New</button>}
      </header>
      {budget && !budget.allowed && <p className="empty-note" role="status">Your free AI budget for these 30 days is used up. Your watches and chat resume on {new Date(budget.resetsAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" })}.</p>}
      {watchesOrLoading === undefined ? <p className="muted" role="status">Loading…</p> : watches.length === 0 ? (
        <div className="empty-state">
          <p className="empty-note">Your watches appear here after you create them.</p>
          <button className="button tinted" onClick={onNew}>Create a watch</button>
        </div>
      ) : (
        <>
          {loose.length > 0 && <ul className="grouped">{loose.map(row)}</ul>}
          {folders.map((f) => {
            const inside = watches.filter((w) => w.folderId === f._id);
            return inside.length ? (
              <div key={f._id}>
                <h3 className="group-title"><Icon name="folder" size={14} /> {f.name}</h3>
                <ul className="grouped">{inside.map(row)}</ul>
              </div>
            ) : null;
          })}
        </>
      )}
      <ul className="grouped">
        <li><button onClick={() => go("/archived")}><Icon name="archive" size={18} />
          <span className="text"><span className="primary-text">Archived</span></span><Icon name="chevron" size={18} /></button></li>
      </ul>
    </section>
  );
}
