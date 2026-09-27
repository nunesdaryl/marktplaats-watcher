import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import Icon from "./Icon.jsx";
import Sheet from "./Sheet.jsx";

/** "Move to folder…": pick a folder, take it out of its folder, or make a new folder on the spot. */
export default function MoveSheet({ kind, item, onClose }) {
  const folders = useQuery(api.folders.list) ?? [];
  const createFolder = useMutation(api.folders.create);
  const moveWatch = useMutation(api.watches.move);
  const moveChat = useMutation(api.chats.move);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function moveTo(folderId) {
    try {
      if (kind === "watch") await moveWatch({ id: item._id, folderId });
      else await moveChat({ chatId: item._id, folderId });
      onClose();
    } catch (e) { setError(e.data ?? "Moving didn't work. Try again."); }
  }

  async function newFolder(e) {
    e.preventDefault();
    try { await moveTo(await createFolder({ name })); } catch (err) { setError(err.data ?? "That didn't work."); }
  }

  return (
    <Sheet title={`Move "${item.title}"`} onClose={onClose}>
      <ul className="grouped">
        {item.folderId && (
          <li><button onClick={() => moveTo(null)}><Icon name="back" size={16} />
            <span className="text"><span className="primary-text">Out of its folder</span></span></button></li>
        )}
        {folders.map((f) => (
          <li key={f._id}>
            <button onClick={() => moveTo(f._id)} disabled={f._id === item.folderId}>
              <Icon name="folder" size={16} />
              <span className="text"><span className="primary-text">{f.name}</span></span>
              {f._id === item.folderId && <span className="secondary-text">Here now</span>}
            </button>
          </li>
        ))}
      </ul>
      <form className="new-folder" onSubmit={newFolder}>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={40}
               placeholder="New folder name" aria-label="New folder name" />
        <button className="button tinted" disabled={!name.trim()}>Create and move</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
    </Sheet>
  );
}
