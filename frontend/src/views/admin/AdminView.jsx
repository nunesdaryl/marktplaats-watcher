// The owner dashboard: the overview, with a drilldown panel on top when a number, bar or row was clicked.
// Only mounted for the owner (App.jsx); the server returns no data to anyone else (convex/admin.ts).
import { useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { api } from "../../../convex/_generated/api";
import Icon from "../../components/Icon.jsx";
import { useDrill } from "./nav.js";
import Overview from "./Overview.jsx";
import { VIEWS } from "./Views.jsx";

const KIND = { users: "Accounts", user: "Account", watches: "Watches", watch: "Watch", alerts: "Alerts", alert: "Alert",
  chats: "Chats", chat: "Chat", events: "Activity", feedback: "Feedback", day: "Day" };

function DrillPanel({ drill }) {
  const { current, open, crumb, close } = drill;
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current?.view, current?.params?.id, close]);
  const View = VIEWS[current.view];
  return (
    <>
      <div className="drill-scrim" onClick={close} aria-hidden="true" />
      <aside className="drill" role="dialog" aria-modal="true" aria-label={current.title || KIND[current.view]} tabIndex={-1} ref={ref}>
        <header className="drill-head">
          <nav className="crumbs" aria-label="Breadcrumbs">
            <button className="link-button" onClick={close}>Dashboard</button>
            {current.trail.map((t, i) => (
              <span key={i}><Icon name="chevron" size={12} /><button className="link-button" onClick={() => crumb(i)}>{t.title || KIND[t.view]}</button></span>
            ))}
          </nav>
          <button className="icon-button" onClick={close} aria-label="Close (Esc)" title="Close (Esc)"><Icon name="close" /></button>
        </header>
        <div className="drill-title">
          <span className="drill-kind">{KIND[current.view] ?? current.view}</span>
          <h2>{current.title || KIND[current.view]}</h2>
        </div>
        <div className="drill-body">
          {View ? <View params={current.params} open={open} /> : <p className="hint">Unknown view.</p>}
        </div>
      </aside>
    </>
  );
}

export default function AdminView() {
  const owner = useQuery(api.admin.amOwner);
  const drill = useDrill();
  if (owner === false) return null;   // App.jsx only mounts this for the owner; the server returns no data to anyone else
  return (
    <>
      <Overview open={drill.open} />
      {drill.current && <DrillPanel drill={drill} />}
    </>
  );
}
