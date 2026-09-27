import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";

const PLACEHOLDER = {
  search: "Search Marktplaats, e.g. Mac mini 16GB under €500",
  watch: "What should I watch, and when? e.g. Gazelle bike near 3511AB, every morning at 8",
};

/** The message box: a "Search now | Watch it" switch, grows with the text, Enter sends, Shift+Enter adds a line. */
export default function Composer({ onSend, busy, autoFocus, mode = "search", onModeChange }) {
  const [text, setText] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  function submit(e) {
    e?.preventDefault();
    if (!text.trim() || busy) return;
    onSend(text, mode);
    setText("");
  }

  return (
    <form className={`composer mode-${mode}`} onSubmit={submit}>
      {onModeChange && (
        <div className="mode-switch" role="radiogroup" aria-label="What should happen">
          {[["search", "Search now"], ["watch", "Watch it"]].map(([value, label]) => (
            <button key={value} type="button" role="radio" aria-checked={mode === value}
                    onClick={() => { onModeChange(value); ref.current.focus(); }}>{label}</button>
          ))}
        </div>
      )}
      <div className="composer-row">
      <textarea ref={ref} rows={1} value={text} maxLength={500} autoFocus={autoFocus}
                aria-label={mode === "watch" ? "What to watch" : "Search"}
                placeholder={PLACEHOLDER[mode]} onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) submit(e); }} />
      <button type="submit" className="send" disabled={busy || !text.trim()} aria-label={mode === "watch" ? "Set up watch" : "Search"}>
        <Icon name={mode === "watch" ? "eye" : "up"} size={18} />
      </button>
      </div>
    </form>
  );
}
