import { useEffect, useRef, useState } from "react";

/** Rename in place, like ChatGPT's sidebar: Enter or leaving the field saves, Esc cancels. */
export default function InlineRename({ value, onSave, onCancel, max = 60, label = "Name" }) {
  const [text, setText] = useState(value);
  const ref = useRef(null);
  const done = useRef(false);
  useEffect(() => { ref.current.focus(); ref.current.select(); }, []);

  function save() {
    if (done.current) return;
    done.current = true;
    const next = text.trim();
    if (next && next !== value) onSave(next);
    else onCancel();
  }

  return (
    <input ref={ref} className="inline-rename" value={text} maxLength={max} aria-label={label}
           onChange={(e) => setText(e.target.value)} onBlur={save} onClick={(e) => e.stopPropagation()}
           onKeyDown={(e) => {
             if (e.key === "Enter") { e.preventDefault(); save(); }
             if (e.key === "Escape") { e.stopPropagation(); done.current = true; onCancel(); }
           }} />
  );
}
