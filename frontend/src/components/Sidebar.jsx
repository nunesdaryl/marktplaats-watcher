import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import { groupByDate } from "../lib/dates.js";
import { go, linkTo } from "../lib/router.js";
import AccountButton from "./AccountButton.jsx";
import Icon from "./Icon.jsx";
import InlineRename from "./InlineRename.jsx";
import Logo from "./Logo.jsx";
import RowMenu from "./RowMenu.jsx";

/** Desktop navigation, ChatGPT-style: search, new chat, alerts, pinned, folders, watches, chats by date, archive. */
export default function Sidebar({ route, watches, chats, email, actions, renaming, setRenaming, onNewWatch, onPrivacy, onFeedback, openSheet, toast, isOwner, newAlerts }) {
  const folders = useQuery(api.folders.list) ?? [];
  const renameChat = useMutation(api.chats.rename);
  const renameWatch = useMutation(api.watches.rename);
  const createFolder = useMutation(api.folders.create);
  const removeFolder = useMutation(api.folders.remove);
  const pinFolder = useMutation(api.folders.setPinned);
  const [search, setSearch] = useState(null);           // null = closed, "" = open and empty
  const [openFolders, setOpenFolders] = useState({});
  const [newFolder, setNewFolder] = useState(false);
  const searchRef = useRef(null);

  // ⌘K (from App) opens search
  useEffect(() => {
    const open = () => { setSearch((s) => s ?? ""); searchRef.current?.focus(); };   // new field: autoFocus
    window.addEventListener("mw:search", open);
    return () => window.removeEventListener("mw:search", open);
  }, []);

  const at = (section, id) => route.section === section && (id === undefined || route.id === id);
  const saveRename = (kind, id) => (value) => {
    setRenaming(null);
    const op = kind === "chat" ? renameChat({ chatId: id, title: value }) : renameWatch({ id, name: value });
    op.catch((e) => toast(e.data ?? "Renaming didn't work."));
  };

  const watchRow = (w) => (
    <div key={w._id} className={`nav-row ${at("w", w._id) ? "active" : ""}`}>
      {renaming === `watch:${w._id}` ? (
        <InlineRename value={w.title} onSave={saveRename("watch", w._id)} onCancel={() => setRenaming(null)} label="Watch name" />
      ) : (
        <button className="nav-item watch" onClick={() => go(`/w/${w._id}`)} onDoubleClick={() => setRenaming(`watch:${w._id}`)}>
          <span className={`dot ${w.active ? "on" : ""}`} aria-label={w.active ? "Active" : "Paused"} />
          <span className="text"><span>{w.title}</span><small>{w.active ? w.summary : "Paused"}</small></span>
        </button>
      )}
      <RowMenu items={actions.watchItems(w, { inline: true })} label={`Options for ${w.title}`} />
    </div>
  );

  const chatRow = (c) => (
    <div key={c._id} className={`nav-row ${at("c", c._id) ? "active" : ""}`}>
      {renaming === `chat:${c._id}` ? (
        <InlineRename value={c.title} onSave={saveRename("chat", c._id)} onCancel={() => setRenaming(null)} label="Chat name" />
      ) : (
        <button className="nav-item" onClick={() => go(`/c/${c._id}`)} onDoubleClick={() => setRenaming(`chat:${c._id}`)}>
          <span className="text"><span>{c.title}</span></span>
        </button>
      )}
      <RowMenu items={actions.chatItems(c, { inline: true })} label={`Options for ${c.title}`} />
    </div>
  );

  // Search: one flat list of matching watches and chats
  if (search !== null) {
    const q = search.trim().toLowerCase();
    const hits = (text) => !q || text.toLowerCase().includes(q);
    const foundWatches = watches.filter((w) => hits(`${w.title} ${w.label}`));
    const foundChats = chats.filter((c) => hits(c.title));
    return (
      <nav className="sidebar" aria-label="Main">
        <div className="search-bar">
          <Icon name="search" size={16} />
          <input ref={searchRef} autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats and watches"
                 aria-label="Search chats and watches" onKeyDown={(e) => { if (e.key === "Escape") setSearch(null); }} />
          <button className="icon-button small" onClick={() => setSearch(null)} aria-label="Close search"><Icon name="close" size={14} /></button>
        </div>
        {foundWatches.length > 0 && <div className="nav-section"><span>Watches</span></div>}
        {foundWatches.map(watchRow)}
        {foundChats.length > 0 && <div className="nav-section"><span>Chats</span></div>}
        {foundChats.map(chatRow)}
        {!foundWatches.length && !foundChats.length && <p className="nav-empty">Nothing matches "{search}".</p>}
      </nav>
    );
  }

  const inFolder = (folderId) => (item) => item.folderId === folderId;
  const loose = (item) => !item.folderId && !item.pinned;
  const pinnedWatches = watches.filter((w) => w.pinned && !w.folderId);
  const pinnedChats = chats.filter((c) => c.pinned && !c.folderId);

  return (
    <nav className="sidebar" aria-label="Main">
      {/* Logo, search and the main places stay on screen while the list below scrolls (as on Marktplaats) */}
      <div className="sidebar-top">
        <div className="brand">
          {/* The logo goes home (the start screen), as on Marktplaats */}
          <a className="home-link" aria-label="Marktplaats Watcher, home" {...linkTo("/")}>
            <Logo size={40} /><span className="wordmark">Marktplaats <b>Watcher</b></span>
          </a>
          <button className="icon-button small" onClick={() => window.dispatchEvent(new Event("mw:search"))}
                  aria-label="Search (⌘K)" title="Search (⌘K)"><Icon name="search" size={16} /></button>
        </div>
        <button className={`nav-item strong ${at("") ? "active" : ""}`} onClick={() => go("/")} title="New chat (⌘⇧O)">
          <Icon name="compose" size={18} />New chat
        </button>
        <button className={`nav-item ${at("alerts") ? "active" : ""}`} onClick={() => go("/alerts")}>
          <Icon name="bell" size={18} />Alerts
          {newAlerts && <span className="new-count" aria-label={`${newAlerts} new`}>{newAlerts}</span>}
        </button>
        {isOwner && (
          <button className={`nav-item ${at("admin") ? "active" : ""}`} onClick={() => go("/admin")}>
            <Icon name="chart" size={18} />Dashboard
          </button>
        )}
      </div>

      {(pinnedWatches.length > 0 || pinnedChats.length > 0) && (
        <>
          <div className="nav-section"><span>Pinned</span></div>
          {pinnedWatches.map(watchRow)}
          {pinnedChats.map(chatRow)}
        </>
      )}

      <div className="nav-section">
        <span>Folders</span>
        <button className="icon-button small" onClick={() => setNewFolder(true)} aria-label="New folder"><Icon name="plus" size={16} /></button>
      </div>
      {newFolder && (
        <div className="nav-row">
          <InlineRename value="" max={40} label="New folder name"
                        onSave={(name) => { setNewFolder(false); createFolder({ name }).catch((e) => toast(e.data ?? "That didn't work.")); }}
                        onCancel={() => setNewFolder(false)} />
        </div>
      )}
      {folders.length === 0 && !newFolder && <p className="nav-empty">Group chats and watches with + </p>}
      {folders.map((f) => {
        const open = openFolders[f._id];
        const items = [...watches.filter(inFolder(f._id)), ...chats.filter(inFolder(f._id))];
        return (
          <div key={f._id} className="folder">
            <div className="nav-row">
              <button className="nav-item" aria-expanded={!!open} onClick={() => setOpenFolders({ ...openFolders, [f._id]: !open })}>
                <Icon name="folder" size={16} />
                <span className="text"><span>{f.name}</span></span>
                <span className="count">{items.length}</span>
              </button>
              <RowMenu label={`Options for folder ${f.name}`} items={[
                { label: "Rename", icon: "edit", onSelect: () => openSheet({ type: "rename", kind: "folder", item: f }) },
                { label: f.pinned ? "Unpin" : "Pin to top", icon: "pin", onSelect: () => pinFolder({ folderId: f._id, pinned: !f.pinned }) },
                "divider",
                { label: "Delete folder", icon: "trash", danger: true, confirm: "Delete? Items move out", onSelect: () => removeFolder({ folderId: f._id }).catch((e) => toast(e.data ?? "That didn't work.")) },
              ]} />
            </div>
            {open && (
              <div className="folder-items">
                {watches.filter(inFolder(f._id)).map(watchRow)}
                {chats.filter(inFolder(f._id)).map(chatRow)}
                {items.length === 0 && <p className="nav-empty">Empty. Use "Move to folder…" in a chat or watch menu.</p>}
              </div>
            )}
          </div>
        );
      })}

      <div className="nav-section">
        <span>Watches</span>
        <button className="icon-button small" onClick={onNewWatch} aria-label="New watch"><Icon name="plus" size={16} /></button>
      </div>
      {watches.filter(loose).map(watchRow)}
      {watches.length === 0 && <p className="nav-empty">None yet</p>}

      {groupByDate(chats.filter(loose)).map(([name, list]) => (
        <div key={name} className="date-group">
          <div className="nav-section"><span>{name}</span></div>
          {list.map(chatRow)}
        </div>
      ))}

      <button className="nav-item feedback-item" onClick={onFeedback}>
        <Icon name="feedback" size={18} />Feedback &amp; suggestions
      </button>
      <div className="account">
        <AccountButton />
        <span className="email" data-private>{email}</span>
        <button className="icon-button small" onClick={() => go("/archived")} aria-label="Archived" title="Archived">
          <Icon name="archive" size={16} />
        </button>
        <button className="icon-button small" onClick={onPrivacy} aria-label="Privacy and your data" title="Privacy and your data">
          <Icon name="shield" size={16} />
        </button>
      </div>
      <p className="shortcuts" aria-label="Keyboard shortcuts">⌘K search · ⌘⇧O new chat · Esc close</p>
    </nav>
  );
}
