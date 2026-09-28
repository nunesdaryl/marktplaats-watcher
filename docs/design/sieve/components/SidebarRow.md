# SidebarRow

Rows in the 272px desktop sidebar: nav items (New chat, Alerts, Pinned), folders, watches and chats by date.

- At least 36px high, 6px/8px padding, `radius-sm`, `text-md` 400, 18px icons in `text-2`.
- **Watch row:** a status dot (`great` when active, a `text-3` ring when paused), the name, and the schedule under it in `text-xs` `text-2`.
- **Section headers** (Folders, Watches, dates): `text-xs` 500 `text-2`, with a + for adding.
- **States:** hover `fill` and the "…" menu button appears; `.active` `fill-strong` in 500; focus ring.
- The foot keeps "Feedback & suggestions", the account row and the shortcuts line ("⌘K search · ⌘⇧O new chat · Esc close") in Geist Mono `text-3`.
