import { useEffect, useRef } from "react";
import Icon from "./Icon.jsx";

/** A native <dialog>: a bottom sheet on phones, a centred panel on larger screens. Esc and the backdrop close it. */
export default function Sheet({ title, onClose, children, footer, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    // The browser would focus the close button. With a mouse, start in the first field; on touch screens,
    // focus the sheet itself so the keyboard doesn't pop up uninvited.
    const field = dialog.querySelector(".sheet-body input, .sheet-body textarea");
    if (field && window.matchMedia("(pointer: fine)").matches) field.focus();
    else dialog.focus();
  }, []);
  return (
    <dialog ref={ref} tabIndex={-1} className={`sheet ${wide ? "wide" : ""}`} onClose={onClose} aria-label={title}
            onClick={(e) => { if (e.target === ref.current) ref.current.close(); }}>
      <div className="sheet-inner">
        <header className="sheet-head">
          <span className="grabber" aria-hidden="true" />
          <h2>{title}</h2>
          <button type="button" className="icon-button" onClick={() => ref.current.close()} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-foot">{footer}</footer>}
      </div>
    </dialog>
  );
}
