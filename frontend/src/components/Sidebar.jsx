import { UserButton } from "@clerk/clerk-react";
import { go } from "../lib/router.js";
import Icon from "./Icon.jsx";
import Logo from "./Logo.jsx";

/** Desktop navigation, ChatGPT-style: new chat, alerts, watches and saved chats. */
export default function Sidebar({ route, watches, chats, email, onNewWatch, onPrivacy }) {
  const at = (section, id) => route.section === section && (id === undefined || route.id === id);
  return (
    <nav className="sidebar" aria-label="Main">
      <div className="brand"><Logo /><span>Marktplaats Watcher</span></div>
      <button className={`nav-item strong ${at("") ? "active" : ""}`} onClick={() => go("/")}>
        <Icon name="compose" size={18} />New chat
      </button>
      <button className={`nav-item ${at("alerts") ? "active" : ""}`} onClick={() => go("/alerts")}>
        <Icon name="bell" size={18} />Alerts
      </button>

      <div className="nav-section">
        <span>Watches</span>
        <button className="icon-button small" onClick={onNewWatch} aria-label="New watch"><Icon name="plus" size={16} /></button>
      </div>
      {watches.length === 0 && <p className="nav-empty">None yet</p>}
      {watches.map((w) => (
        <button key={w._id} className={`nav-item watch ${at("w", w._id) ? "active" : ""}`} onClick={() => go(`/w/${w._id}`)}>
          <span className={`dot ${w.active ? "on" : ""}`} aria-hidden="true" />
          <span className="text"><span>{w.label}</span><small>{w.active ? w.summary : "Paused"}</small></span>
        </button>
      ))}

      <div className="nav-section"><span>Chats</span></div>
      <div className="chat-list">
        {chats.map((c) => (
          <button key={c._id} className={`nav-item ${at("c", c._id) ? "active" : ""}`} onClick={() => go(`/c/${c._id}`)}>
            <span className="text"><span>{c.title}</span></span>
          </button>
        ))}
      </div>

      <div className="account">
        <UserButton />
        <span className="email">{email}</span>
        <button className="icon-button small" onClick={onPrivacy} aria-label="Privacy and your data"><Icon name="shield" size={16} /></button>
      </div>
    </nav>
  );
}
