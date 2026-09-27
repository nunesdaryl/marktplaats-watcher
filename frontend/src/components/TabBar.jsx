import { go } from "../lib/router.js";
import Icon from "./Icon.jsx";

/** Phone navigation, Apple-style: a frosted tab bar at the bottom. */
export default function TabBar({ route, newAlerts }) {
  const tab = route.section === "w" || route.section === "watches" ? "watches" : route.section === "alerts" ? "alerts" : "chat";
  const item = (key, label, icon, path, badge) => (
    <button className={tab === key ? "active" : ""} aria-current={tab === key ? "page" : undefined} onClick={() => go(path)}>
      <span className="icon"><Icon name={icon} size={22} />{badge ? <span className="badge">{badge}</span> : null}</span>
      <span>{label}</span>
    </button>
  );
  return (
    <nav className="tabbar" aria-label="Main">
      {item("chat", "Chat", "chat", route.section === "c" ? `/c/${route.id}` : "/")}
      {item("watches", "Watches", "eye", "/watches")}
      {item("alerts", "Alerts", "bell", "/alerts", newAlerts)}
    </nav>
  );
}
