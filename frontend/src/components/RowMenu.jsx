import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";

/**
 * The "…" menu on a chat, watch or folder: a button plus a small menu. Arrow keys move, Esc and an outside
 * click close it. Items marked `confirm` ask once more ("Delete for good?") before doing anything.
 * items: [{ label, icon, onSelect, danger?, confirm? } | "divider"]
 */
export default function RowMenu({ items, label = "More options", className = "" }) {
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(null);
  const root = useRef(null);
  const menu = useRef(null);

  useEffect(() => {
    if (!open) { setAsking(null); return; }
    menu.current?.querySelector(".menu-actions button")?.focus();
    const outside = (e) => { if (!root.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function onKeyDown(e) {
    const buttons = [...(menu.current?.querySelectorAll(".menu-actions button") ?? [])];
    const at = buttons.indexOf(document.activeElement);
    if (e.key === "Escape") { e.stopPropagation(); setOpen(false); root.current.querySelector(".row-menu-trigger").focus(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); buttons[(at + 1) % buttons.length]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); buttons[(at - 1 + buttons.length) % buttons.length]?.focus(); }
  }

  function choose(item, index) {
    if (item.confirm && asking !== index) { setAsking(index); return; }
    setOpen(false);
    item.onSelect();
  }

  return (
    <div className={`row-menu ${open ? "open" : ""} ${className}`} ref={root} onKeyDown={onKeyDown}
         onClick={(e) => e.stopPropagation()}>
      <button type="button" className="row-menu-trigger" aria-label={label} aria-haspopup="menu" aria-expanded={open}
              onClick={() => setOpen(!open)}>
        <Icon name="more" size={16} />
      </button>
      {open && (
        <div className="menu" ref={menu}>
          <div className="menu-actions" role="menu">
          {items.filter(Boolean).map((item, i) => item === "divider"
            ? <div key={i} className="menu-divider" role="separator" />
            : (
              <button key={i} type="button" role="menuitem" className={item.danger ? "danger" : ""} onClick={() => choose(item, i)}>
                {item.icon && <Icon name={item.icon} size={18} />}
                {asking === i ? (item.confirm === true ? `${item.label} for good?` : item.confirm) : item.label}
              </button>
            ))}
          </div>
          <button type="button" className="menu-cancel" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
