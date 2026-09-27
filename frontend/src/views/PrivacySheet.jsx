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
        <p>We keep your e-mail address and your watches until you delete them. Your chats and the listings we've
          checked are deleted after 30 days. Your messages, searches and listing details (titles, prices, places)
          are sent to OpenAI to answer and score them. Nothing is sold or shared.</p>
        <p className="muted">A free portfolio project by Daryl Nunes, not affiliated with Marktplaats.</p>
        <ConfirmButton icon="trash" label="Delete my data" confirmLabel="Delete everything? This can't be undone."
                       onConfirm={async () => { await deleteMyData(); onClose(); window.location.hash = "/"; }} />
      </div>
    </Sheet>
  );
}
