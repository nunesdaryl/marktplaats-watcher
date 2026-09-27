import { SignInButton, UserButton } from "@clerk/clerk-react";
import { AuthLoading, Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../convex/_generated/api";
import Chat from "./Chat.jsx";
import Landing from "./Landing.jsx";
import Logo from "./Logo.jsx";
import WatchForm from "./WatchForm.jsx";
import Watches from "./Watches.jsx";

function Workspace() {
  const storeUser = useMutation(api.users.store);
  const watches = useQuery(api.watches.list) ?? [];
  const [form, setForm] = useState(null);       // { mode: "create" | "edit", initial, watchId? }
  const [tab, setTab] = useState("chat");       // small screens show one pane at a time
  const [userError, setUserError] = useState("");

  useEffect(() => {
    storeUser().catch((e) => setUserError(e.data ?? "We couldn't load your account. Refresh to try again."));
  }, [storeUser]);

  return (
    <div className="workspace">
      <header className="bar">
        <Logo />
        <span className="name">Marktplaats Watcher</span>
        <nav className="tabs" aria-label="Sections">
          <button aria-pressed={tab === "chat"} onClick={() => setTab("chat")}>Chat</button>
          <button aria-pressed={tab === "watches"} onClick={() => setTab("watches")}>
            Watches{watches.length ? ` (${watches.length})` : ""}
          </button>
        </nav>
        <UserButton />
      </header>
      {userError && <p className="banner" role="alert">{userError}</p>}
      <div className="panes" data-tab={tab}>
        <Chat watches={watches} onWatch={(initial) => setForm({ mode: "create", initial })}
              onAdjust={(initial) => setForm({ mode: "create", initial })} />
        <Watches watches={watches} onEdit={(w) => setForm({ mode: "edit", initial: w, watchId: w._id })} />
      </div>
      {form && <WatchForm {...form} onClose={(saved) => { setForm(null); if (saved) setTab("watches"); }} />}
    </div>
  );
}

export default function App() {
  return (
    <>
      <AuthLoading><div className="loading">Loading…</div></AuthLoading>
      <Unauthenticated><Landing SignIn={SignInButton} /></Unauthenticated>
      <Authenticated><Workspace /></Authenticated>
    </>
  );
}
