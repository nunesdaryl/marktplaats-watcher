import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import Sheet from "../components/Sheet.jsx";
import { ConfirmButton } from "./WatchView.jsx";

export default function PrivacySheet({ email, onClose }) {
  const deleteMyData = useMutation(api.users.deleteMyData);
  return (
    <Sheet title="Privacy and your data" onClose={onClose}>
      <div className="stack prose">
        <p>Alerts go to <strong>{email}</strong>.</p>
        <p>We keep your e-mail address, your watches, the listings already shown to you and your chats. Anything
          untouched for 30 days is deleted automatically. Searches and listing titles are sent to OpenAI to score
          them. Nothing is sold or shared.</p>
        <p className="muted">A portfolio project, not affiliated with Marktplaats.</p>
        <ConfirmButton icon="trash" label="Delete my data" confirmLabel="Delete everything? This can't be undone."
                       onConfirm={async () => { await deleteMyData(); onClose(); window.location.hash = "/"; }} />
      </div>
    </Sheet>
  );
}
