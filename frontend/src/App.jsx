import { SignInButton, UserButton } from "@clerk/clerk-react";
import { AuthLoading, Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../convex/_generated/api";
import Icon from "./components/Icon.jsx";
import MoveSheet from "./components/MoveSheet.jsx";
import RenameSheet from "./components/RenameSheet.jsx";
import RowMenu from "./components/RowMenu.jsx";
import Sheet from "./components/Sheet.jsx";
import Sidebar from "./components/Sidebar.jsx";
import TabBar from "./components/TabBar.jsx";
import WatchSheet from "./components/WatchSheet.jsx";
import Boot from "./Boot.jsx";
import { useItemActions } from "./lib/actions.js";
import { SIGNED_IN_FLAG } from "./lib/boot.js";
import { groupByDate } from "./lib/dates.js";
import Landing from "./Landing.jsx";
import { go, useMediaQuery, useRoute } from "./lib/router.js";
import AlertsView from "./views/AlertsView.jsx";
import ArchivedView from "./views/ArchivedView.jsx";
import ChatView from "./views/ChatView.jsx";
import Onboarding from "./views/Onboarding.jsx";
import PrivacySheet from "./views/PrivacySheet.jsx";
import WatchesView from "./views/WatchesView.jsx";
import WatchView from "./views/WatchView.jsx";

/** Phone: saved chats, opened from the clock button (or ⌘K), with search, date groups and a ••• menu per chat. */
function HistorySheet({ chats, actions, onClose }) {
  const [search, setSearch] = useState("");
  const open = (path) => { onClose(); go(path); };
  const q = search.trim().toLowerCase();
  const found = chats.filter((c) => !q || c.title.toLowerCase().includes(q));
  const pinned = found.filter((c) => c.pinned);
  const groups = groupByDate(found.filter((c) => !c.pinned));
  const row = (c) => (
    <li key={c._id} className="grouped-row">
      <button onClick={() => open(`/c/${c._id}`)}><span className="text"><span className="primary-text">{c.title}</span></span></button>
      <RowMenu items={actions.chatItems(c)} label={`Options for ${c.title}`} />
    </li>
  );
  return (
    <Sheet title="Chats" onClose={onClose}>
      <button className="button tinted wide" onClick={() => open("/")}><Icon name="compose" size={16} />New chat</button>
      <input className="field" type="search" value={search} onChange={(e) => setSearch(e.target.value)}
             placeholder="Search chats" aria-label="Search chats" />
      {chats.length === 0 ? <p className="empty-note">Your chats will show up here.</p> : found.length === 0 ? (
        <p className="empty-note">No chat matches "{search}".</p>
      ) : (
        <>
          {pinned.length > 0 && <><h3 className="group-title">Pinned</h3><ul className="grouped">{pinned.map(row)}</ul></>}
          {groups.map(([name, list]) => (
            <div key={name}><h3 className="group-title">{name}</h3><ul className="grouped">{list.map(row)}</ul></div>
          ))}
        </>
      )}
    </Sheet>
  );
}

function Toast({ message, onDone }) {
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onDone, 3500);
    return () => clearTimeout(id);
  }, [message, onDone]);
  return message ? <div className="toast" role="status">{message}</div> : null;
}

function Workspace() {
  const storeUser = useMutation(api.users.store);
  const me = useQuery(api.users.me);
  const watchesOrLoading = useQuery(api.watches.list);
  const chats = useQuery(api.chats.list) ?? [];
  const archivedWatches = useQuery(api.watches.archived) ?? [];
  const route = useRoute();
  const desktop = useMediaQuery("(min-width: 900px)");
  const [sheet, setSheet] = useState(null);   // { type: "watch" | "privacy" | "history" | "rename" | "move", ... }
  const [renaming, setRenaming] = useState(null);   // "chat:<id>" | "watch:<id>" while renaming in the sidebar
  const [skippedOnboarding, setSkippedOnboarding] = useState(false);
  const [userError, setUserError] = useState("");
  const [toast, setToast] = useState("");
  const watches = watchesOrLoading ?? [];
  const desktopRef = useRef(desktop);
  desktopRef.current = desktop;

  useEffect(() => {
    storeUser().catch((e) => setUserError(e.data ?? "We couldn't load your account. Refresh to try again."));
    try { localStorage.setItem(SIGNED_IN_FLAG, "1"); } catch {}   // next visit: skip the landing-page flash
  }, [storeUser]);

  // Keyboard: ⌘K search, ⌘⇧O new chat (Esc is handled by menus and sheets themselves)
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (desktopRef.current) window.dispatchEvent(new Event("mw:search"));
        else setSheet({ type: "history" });
      } else if (e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        go("/");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const newWatch = (initial = {}) => setSheet({ type: "watch", mode: "create", initial });
  const closeSheet = () => setSheet(null);
  const actions = useItemActions({
    openSheet: setSheet, newWatch, toast: setToast, route,
    startRename: desktop ? (kind, id) => setRenaming(`${kind}:${id}`) : undefined,
  });
  const findWatch = (id) => watches.find((w) => w._id === id) ?? archivedWatches.find((w) => w._id === id);
  const watch = route.section === "w" ? (watchesOrLoading === undefined ? undefined : findWatch(route.id) ?? null) : null;
  const showOnboarding = me && !me.onboarded && watchesOrLoading?.length === 0 && !skippedOnboarding && !sheet;

  let content;
  if (route.section === "w") content = <WatchView watch={watch} actions={actions} onEdit={(w) => setSheet({ type: "watch", mode: "edit", initial: w, watchId: w._id })} />;
  else if (route.section === "alerts") content = <AlertsView />;
  else if (route.section === "archived") content = <ArchivedView actions={actions} />;
  else if (route.section === "watches") content = <WatchesView watches={watches} actions={actions} onNew={() => newWatch()} />;
  else content = <ChatView chatId={route.section === "c" ? route.id : undefined} watches={watches} onWatch={newWatch} onAdjust={newWatch} />;

  const sheets = (
    <>
      {sheet?.type === "watch" && <WatchSheet {...sheet} onClose={(id) => { closeSheet(); if (id && sheet.mode === "create") go(`/w/${id}`); }} />}
      {sheet?.type === "privacy" && <PrivacySheet email={me?.email} onClose={closeSheet} />}
      {sheet?.type === "history" && <HistorySheet chats={chats} actions={actions} onClose={closeSheet} />}
      {sheet?.type === "rename" && <RenameSheet kind={sheet.kind} item={sheet.item} onClose={closeSheet} />}
      {sheet?.type === "move" && <MoveSheet kind={sheet.kind} item={{ ...sheet.item, title: sheet.item.title }} onClose={closeSheet} />}
      {showOnboarding && <Onboarding email={me.email} onDone={(id) => { setSkippedOnboarding(true); if (id) go(`/w/${id}`); }} />}
      <Toast message={toast} onDone={() => setToast("")} />
    </>
  );

  if (desktop) {
    return (
      <div className="shell">
        <Sidebar route={route} watches={watches} chats={chats} email={me?.email} actions={actions} renaming={renaming}
                 setRenaming={setRenaming} onNewWatch={() => newWatch()} onPrivacy={() => setSheet({ type: "privacy" })}
                 openSheet={setSheet} toast={setToast} />
        <main className="main">{userError && <p className="banner" role="alert">{userError}</p>}{content}</main>
        {sheets}
      </div>
    );
  }

  const inChat = route.section === "" || route.section === "c";
  const currentChat = chats.find((c) => c._id === route.id);
  return (
    <div className="shell phone">
      <header className="topbar">
        {route.section === "w" || route.section === "archived"
          ? <button className="icon-button" onClick={() => go("/watches")} aria-label="Back to watches"><Icon name="back" /></button>
          : inChat
            ? <button className="icon-button" onClick={() => setSheet({ type: "history" })} aria-label="Chats"><Icon name="clock" /></button>
            : <button className="icon-button" onClick={() => setSheet({ type: "privacy" })} aria-label="Privacy and your data"><Icon name="shield" /></button>}
        <span className="topbar-title">{inChat ? (currentChat?.title ?? "New chat") : ""}</span>
        {currentChat && <RowMenu items={actions.chatItems(currentChat)} label="Chat options" />}
        {inChat && route.section === "c"
          ? <button className="icon-button" onClick={() => go("/")} aria-label="New chat"><Icon name="compose" /></button>
          : <UserButton />}
      </header>
      <main className="main">{userError && <p className="banner" role="alert">{userError}</p>}{content}</main>
      <TabBar route={route} />
      {sheets}
    </div>
  );
}

function SignedOut() {
  useEffect(() => { try { localStorage.removeItem(SIGNED_IN_FLAG); } catch {} }, []);
  return <Landing SignIn={SignInButton} />;
}

export default function App() {
  const route = useRoute();
  return (
    <>
      <AuthLoading><Boot landing={route.section === ""} /></AuthLoading>
      <Unauthenticated><SignedOut /></Unauthenticated>
      <Authenticated><Workspace /></Authenticated>
    </>
  );
}
