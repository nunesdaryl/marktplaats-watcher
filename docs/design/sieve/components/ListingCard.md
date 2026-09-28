# ListingCard

One listing in a thread, on the watch page and in Alerts: photo, score, title, price and place, the reason, and meta.

- 248px wide in a horizontal row (a full-width grid on phones). `elevated`, 1px `line`, radius 8px, `shadow`.
- **Photo:** 4:3 on `surface`, with the score badge 8px from the top left. No photo: a `text-3` line icon centred on `surface`.
- **Title:** `text-md` 600, two lines at most.
- **Price line:** the price in Geist Mono 500 15px `text` ("€230"), then " · Utrecht" in `text-2` 13px.
- **Reason:** `text-sm` in `text`, with a 2px `line` rule on the left so it reads as an annotation. It's the one line on why, always visible.
- **Meta:** `text-xs` in `text-2` (for example "E-mailed", with a `great` check).
- **Skipped** (below the bar): no shadow, `bg` fill, the title struck through in `text-2`, the photo at 45%.
- **States:** hover lifts it 2px (off under reduced motion), focus puts the ring on the whole card, which is one link to the listing.
