import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import Sheet from "./Sheet.jsx";

/** Rename on phones and on the watch page (the sidebar renames in place). */
export default function RenameSheet({ kind, item, onClose }) {
  const renameChat = useMutation(api.chats.rename);
  const renameWatch = useMutation(api.watches.rename);
  const renameFolder = useMutation(api.folders.rename);
  const [name, setName] = useState(kind === "folder" ? item.name : item.title);
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    try {
      if (kind === "chat") await renameChat({ chatId: item._id, title: name });
      else if (kind === "folder") await renameFolder({ folderId: item._id, name });
      else await renameWatch({ id: item._id, name: name.trim() || null });
      onClose();
    } catch (err) { setError(err.data ?? "Renaming didn't work. Try again."); }
  }

  return (
    <Sheet title={`Rename ${kind}`} onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <input className="field big" value={name} onChange={(e) => setName(e.target.value)} maxLength={kind === "folder" ? 40 : 60}
               aria-label="Name" required={kind !== "watch"} />
        {kind === "watch" && item.name && (
          <p className="hint">Leave it empty to go back to the automatic name: {item.label}.</p>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="button primary wide">Save</button>
      </form>
    </Sheet>
  );
}
