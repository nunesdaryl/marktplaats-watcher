import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { describeWhen } from "../../convex/schedule";
import Skeleton from "../components/Skeleton.jsx";
import RowMenu from "../components/RowMenu.jsx";
import { go, useNow } from "../lib/router.js";

/** Archived chats and watches: out of the way, restorable, or deletable for good. */
export default function ArchivedView({ actions }) {
  const watches = useQuery(api.watches.archived);
  const chats = useQuery(api.chats.archived);
  const now = useNow();
  const loading = watches === undefined || chats === undefined;
  return (
    <section className="page" aria-labelledby="archived-title">
      <header className="page-head">
        <h1 id="archived-title">Archived</h1>
        <p className="muted">Archived watches are paused: no checks, no e-mails. Restore one to bring it back.</p>
      </header>
      {loading ? <Skeleton /> : !watches.length && !chats.length ? (
        <p className="empty-note">Nothing archived. Use Archive in a chat's or watch's ••• menu to tidy up without deleting.</p>
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
        </>
      )}
    </section>
  );
}
