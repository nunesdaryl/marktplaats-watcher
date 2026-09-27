import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import Sheet from "../components/Sheet.jsx";
import { ConfirmButton } from "./WatchView.jsx";

export default function PrivacySheet({ email, onClose }) {
  const deleteMyData = useMutation(api.users.deleteMyData);
  return (
    <Sheet title="Privacy and your data" onClose={onClose}>
      <div className="stack prose">
        <p>Alerts go to <strong>{email}</strong>, from marktplaats-watcher@agentmail.to.</p>
        <p>We keep your e-mail address and your watches until you delete them. Chats and checked listings are deleted
          30 days after they were last used. Your messages, searches and listing details (titles, prices, places)
          are sent to OpenAI to answer and score them. Feedback you send is kept with your e-mail address so Daryl can
          reply. Nothing is sold; the only other companies that see it are the ones that run the app (OpenAI, Convex,
          Clerk, AgentMail, Vercel). Delete my data removes everything we store; close your login account separately
          under your account menu.</p>
        <p className="muted">A free portfolio project by Daryl Nunes, not affiliated with Marktplaats.</p>
        <ConfirmButton icon="trash" label="Delete my data" confirmLabel="Delete everything? This can't be undone."
                       onConfirm={async () => { await deleteMyData(); onClose(); window.location.hash = "/"; }} />
      </div>
    </Sheet>
  );
}
