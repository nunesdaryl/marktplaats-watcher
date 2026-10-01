import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { describeWhen } from "../../convex/schedule";
import Skeleton from "../components/Skeleton.jsx";
import RowMenu from "../components/RowMenu.jsx";
import { go, useNow } from "../lib/router.js";

/** Archived chats, watches and alerts, with their restore actions. */
export default function ArchivedView({ actions }) {
  const watches = useQuery(api.watches.archived);
  const chats = useQuery(api.chats.archived);
  const alerts = useQuery(api.alerts.archived);
  const now = useNow();
  const loading = watches === undefined || chats === undefined || alerts === undefined;
  return (
    <section className="page" aria-labelledby="archived-title">
      <header className="page-head">
        <h1 id="archived-title">Archived</h1>
        <p className="muted">Archived watches are paused: no checks, no e-mails. Restore watches, chats or alerts here.</p>
      </header>
      {loading ? <Skeleton /> : !watches.length && !chats.length && !alerts.length ? (
        <p className="empty-note">Nothing archived. Archive a watch, chat or alert to find it here later.</p>
      ) : (
        <>
          {watches.length > 0 && <h2 className="section-title">Watches</h2>}
          {watches.length > 0 && (
            <ul className="grouped">
              {watches.map((w) => (
                <li key={w._id} className="grouped-row">
                  <button onClick={() => go(`/w/${w._id}`)}>
                    <span className="text"><span className="primary-text">{w.title}</span>
                      <span className="secondary-text">Archived {describeWhen(w.archivedAt, now)}</span></span>
                  </button>
                  <RowMenu items={actions.watchItems(w)} label={`Options for ${w.title}`} />
                </li>
              ))}
            </ul>
          )}
          {chats.length > 0 && <h2 className="section-title">Chats</h2>}
          {chats.length > 0 && (
            <ul className="grouped">
              {chats.map((c) => (
                <li key={c._id} className="grouped-row">
                  <button onClick={() => go(`/c/${c._id}`)}>
                    <span className="text"><span className="primary-text">{c.title}</span>
                      <span className="secondary-text">Archived {describeWhen(c.archivedAt, now)}</span></span>
                  </button>
                  <RowMenu items={actions.chatItems(c)} label={`Options for ${c.title}`} />
                </li>
              ))}
            </ul>
          )}
          {alerts.length > 0 && <h2 className="section-title">Alerts</h2>}
          {alerts.length > 0 && (
            <ul className="grouped">
              {alerts.map((a) => (
                <li key={a._id} className="grouped-row">
                  <button onClick={() => window.open(a.url, "_blank", "noopener,noreferrer")}>
                    <span className="text"><span className="primary-text">{a.title}</span>
                      <span className="secondary-text">{a.watchLabel} · Archived {describeWhen(a.archivedAt, now)}</span></span>
                  </button>
                  <RowMenu items={actions.alertItems(a)} label={`Options for ${a.title}`} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
