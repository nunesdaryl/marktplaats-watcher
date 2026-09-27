import Icon from "../components/Icon.jsx";
import { go } from "../lib/router.js";

/** The phone's Watches tab: an inset grouped list, like iOS Settings. */
export default function WatchesView({ watches, onNew }) {
  return (
    <section className="page" aria-labelledby="watches-title">
      <header className="page-head row-head">
        <h1 id="watches-title">Watches</h1>
        <button className="button tinted" onClick={onNew}><Icon name="plus" size={16} />New</button>
      </header>
      {watches.length === 0 ? (
        <p className="empty-note">Nothing watched yet. Ask the chat to keep an eye on something, or tap New.</p>
      ) : (
        <ul className="grouped">
          {watches.map((w) => {
            const best = w.alerts[0];
            return (
              <li key={w._id}>
                <button onClick={() => go(`/w/${w._id}`)}>
                  <span className="text">
                    <span className="primary-text">{w.label}</span>
                    <span className="secondary-text">{w.active ? w.summary : "Paused"}</span>
                  </span>
                  {best?.score !== undefined && <span className="pill">{best.score}/10</span>}
                  <Icon name="chevron" size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
