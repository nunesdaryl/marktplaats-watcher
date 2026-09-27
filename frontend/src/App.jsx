import { SignInButton, UserButton } from "@clerk/clerk-react";
import { AuthLoading, Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../convex/_generated/api";
import Icon from "./components/Icon.jsx";
import Sheet from "./components/Sheet.jsx";
import Sidebar from "./components/Sidebar.jsx";
import TabBar from "./components/TabBar.jsx";
import WatchSheet from "./components/WatchSheet.jsx";
import Landing from "./Landing.jsx";
import { go, useMediaQuery, useRoute } from "./lib/router.js";
import AlertsView from "./views/AlertsView.jsx";
import ChatView from "./views/ChatView.jsx";
import Onboarding from "./views/Onboarding.jsx";
import PrivacySheet from "./views/PrivacySheet.jsx";
import WatchesView from "./views/WatchesView.jsx";
import WatchView from "./views/WatchView.jsx";

/** Phone: the list of saved chats, opened from the clock button. */
function HistorySheet({ chats, onClose }) {
  const open = (path) => { onClose(); go(path); };
  return (
    <Sheet title="Chats" onClose={onClose}>
      <button className="button tinted wide" onClick={() => open("/")}><Icon name="compose" size={16} />New chat</button>
      {chats.length === 0 ? <p className="empty-note">Your chats will show up here.</p> : (
        <ul className="grouped">
          {chats.map((c) => <li key={c._id}><button onClick={() => open(`/c/${c._id}`)}>
            <span className="text"><span className="primary-text">{c.title}</span></span><Icon name="chevron" size={16} />
          </button></li>)}
        </ul>
      )}
    </Sheet>
  );
}

function Workspace() {
  const storeUser = useMutation(api.users.store);
  const me = useQuery(api.users.me);
  const watchesOrLoading = useQuery(api.watches.list);
  const chats = useQuery(api.chats.list) ?? [];
  const route = useRoute();
  const desktop = useMediaQuery("(min-width: 900px)");
  const [sheet, setSheet] = useState(null);   // { type: "watch" | "privacy" | "history", ... }
  const [skippedOnboarding, setSkippedOnboarding] = useState(false);
  const [userError, setUserError] = useState("");
  const watches = watchesOrLoading ?? [];

  useEffect(() => {
    storeUser().catch((e) => setUserError(e.data ?? "We couldn't load your account. Refresh to try again."));
  }, [storeUser]);

  const newWatch = (initial = {}) => setSheet({ type: "watch", mode: "create", initial });
  const closeSheet = () => setSheet(null);
  const watch = route.section === "w" ? (watchesOrLoading === undefined ? undefined : watches.find((w) => w._id === route.id) ?? null) : null;
  const showOnboarding = me && !me.onboarded && watchesOrLoading?.length === 0 && !skippedOnboarding && !sheet;

  let content;
  if (route.section === "w") content = <WatchView watch={watch} onEdit={(w) => setSheet({ type: "watch", mode: "edit", initial: w, watchId: w._id })} />;
  else if (route.section === "alerts") content = <AlertsView />;
  else if (route.section === "watches") content = <WatchesView watches={watches} onNew={() => newWatch()} />;
  else content = <ChatView chatId={route.section === "c" ? route.id : undefined} watches={watches} onWatch={newWatch} onAdjust={newWatch} />;

  const sheets = (
    <>
      {sheet?.type === "watch" && <WatchSheet {...sheet} onClose={(id) => { closeSheet(); if (id && sheet.mode === "create") go(`/w/${id}`); }} />}
      {sheet?.type === "privacy" && <PrivacySheet email={me?.email} onClose={closeSheet} />}
      {sheet?.type === "history" && <HistorySheet chats={chats} onClose={closeSheet} />}
      {showOnboarding && <Onboarding email={me.email} onDone={(id) => { setSkippedOnboarding(true); if (id) go(`/w/${id}`); }} />}
    </>
  );

  if (desktop) {
    return (
      <div className="shell">
        <Sidebar route={route} watches={watches} chats={chats} email={me?.email} onNewWatch={() => newWatch()}
                 onPrivacy={() => setSheet({ type: "privacy" })} />
        <main className="main">{userError && <p className="banner" role="alert">{userError}</p>}{content}</main>
        {sheets}
      </div>
    );
  }

  const inChat = route.section === "" || route.section === "c";
  return (
    <div className="shell phone">
      <header className="topbar">
        {route.section === "w"
          ? <button className="icon-button" onClick={() => go("/watches")} aria-label="Back to watches"><Icon name="back" /></button>
          : inChat
            ? <button className="icon-button" onClick={() => setSheet({ type: "history" })} aria-label="Chats"><Icon name="clock" /></button>
            : <button className="icon-button" onClick={() => setSheet({ type: "privacy" })} aria-label="Privacy and your data"><Icon name="shield" /></button>}
        <span className="topbar-title">{inChat ? (chats.find((c) => c._id === route.id)?.title ?? "New chat") : ""}</span>
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

export default function App() {
  return (
    <>
      <AuthLoading><div className="loading" aria-live="polite">Loading…</div></AuthLoading>
      <Unauthenticated><Landing SignIn={SignInButton} /></Unauthenticated>
      <Authenticated><Workspace /></Authenticated>
    </>
  );
}
