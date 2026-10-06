import { useClerk, useUser } from "@clerk/clerk-react";
import { useEffect, useRef, useState } from "react";
import { go } from "../lib/router.js";
import { useTheme } from "../lib/theme.js";
import { track } from "../lib/track.js";
import Icon from "./Icon.jsx";

export function accountMenuItems({ clerk, onPrivacy, showArchive, pref, reset }) {
  return [
    { label: "Manage account", description: "Profile, email and security", icon: "edit", action: () => clerk.openUserProfile() },
    onPrivacy && { label: "Privacy and your data", description: "Review how your data is used", icon: "shield", action: onPrivacy },
    showArchive && { label: "Archived", description: "Find saved watches, chats and alerts", icon: "archive", action: () => go("/archived") },
    pref !== "system" && { label: "Match device theme", description: "Follow your device's light or dark mode", icon: "refresh", action: () => { reset(); track("theme_changed", { value: "system" }); } },
    { label: "Sign out", description: "End this session", action: () => clerk.signOut(clerk.session?.id) },
  ].filter(Boolean);
}

/** Described account destinations; Clerk still owns profile/security and session sign-out. */
export default function AccountButton({ email, budget, onPrivacy, showArchive = true, sidebar = false }) {
  const clerk = useClerk();
  const { user } = useUser();
  const { pref, reset } = useTheme();
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const menu = useRef(null);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector("button")?.focus();
    const outside = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  const items = accountMenuItems({ clerk, onPrivacy, showArchive, pref, reset });

  const choose = (action) => { setOpen(false); action(); };
  const onKeyDown = (event) => {
    const buttons = [...(menu.current?.querySelectorAll("button") ?? [])];
    const at = buttons.indexOf(document.activeElement);
    if (event.key === "Escape") { event.stopPropagation(); setOpen(false); root.current?.querySelector(".account-button")?.focus(); }
    else if (!open && event.key === "ArrowDown") { event.preventDefault(); setOpen(true); }
    else if (event.key === "ArrowDown") { event.preventDefault(); buttons[(at + 1) % buttons.length]?.focus(); }
    else if (event.key === "ArrowUp") { event.preventDefault(); buttons[(at - 1 + buttons.length) % buttons.length]?.focus(); }
  };

  return (
    <div className={`account-control ${sidebar ? "account-control-sidebar" : ""}`} ref={root} onKeyDown={onKeyDown}>
      <button type="button" className={`account-button ${sidebar ? "account-button-row" : ""}`}
              aria-label="Account menu" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {user?.imageUrl ? <img className="account-avatar" src={user.imageUrl} alt="" /> : <span className="account-avatar account-avatar-empty" aria-hidden="true">{(user?.firstName ?? email ?? "A").charAt(0).toUpperCase()}</span>}
        {sidebar && <><span className="account-details"><span className="email" data-private aria-hidden="true">{email}</span>
          {budget && !budget.owner && <small>AI budget: €{budget.spentEur.toFixed(2)} of €{budget.limitEur.toFixed(2)} used</small>}</span>
          <span className="account-chevron" aria-hidden="true"><Icon name="chevron" size={16} /></span></>}
      </button>
      {open && <div className="account-menu" ref={menu} role="menu" aria-label="Account choices">
        {items.map(({ label, description, icon, action }) => <button key={label} type="button" role="menuitem" onClick={() => choose(action)}>
          {icon && <Icon name={icon} size={18} />}
          <span className="account-menu-text"><span>{label}</span><small>{description}</small></span>
        </button>)}
      </div>}
    </div>
  );
}
