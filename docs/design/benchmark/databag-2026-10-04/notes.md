# Station observations: community.databag.ai, 4 October 2026

These are the station's read-only observations from the member's signed-in Chrome at `/`, `/feed`, `/events` and `/videos`, plus the member's own views of `/sign-in`, the account menu and the Clerk account modal. The browser tool could not save image files. No screenshots are committed or cited; this text is the evidence record for the [audit](README.md). Names and e-mail addresses are omitted. Measurements describe the source site on that date, not tokens to import.

## Shell and measured styles

- Body: Inter, 15px / 23.25px; text `oklch(0.21 0.02 275)` on near-white `oklch(0.985 0.004 300)` with a faint violet cast. Page h1: Plus Jakarta Sans 700, 30px / 46.5px; section h2: 17px.
- Sidebar: 264px; deep violet vertical gradient `rgb(29,15,51)` to `rgb(18,8,48)`; 15px text at 92% white. Group labels COMMUNITY, LEARN and MANAGE: 10.5px, weight 700, 1.47px letter spacing, 56% white. Active row: 42px tall, 11px radius, 13% white fill, weight 600. Collapse control at top right. Bottom member card has avatar, name, role description and theme toggle.
- Top bar: 62px, 80% white frosted surface. Left breadcrumb changes with route, such as Home › Community › Events. Right side has search with a `⌘K` hint, a primary Ask button, theme toggle, notification bell with dot and account button with avatar, name and chevron. Ask button: 13px weight 600, 9px radius, violet pill and sparkle icon.
- Account menu: identity block with name, e-mail and MEMBER badge; four actions, each with a description: manage profile (name, photo, e-mail and security), account settings (role and permissions), switch to dark mode (display theme), sign out (end session). The Clerk account modal showed “Development mode”.
- Cards: white surface, 1px hairline `oklch(0.915…)`, 16px radius, 26 × 28px padding, soft two-layer shadow. Floating Feedback pill: bottom right, dark fill, white 13px weight 700 text, 44px height, 99px radius.

## Sign-in

Split screen: dark violet hero with eyebrow, large display headline, one-line lead, avatar stack with a short social-learning line and three numbered benefits. A white card on the right has logo, MEMBER ACCESS eyebrow, welcome title, Google sign-in, e-mail/password form, password recovery, primary sign-in and create-account link. The custom form does not draw Clerk's badge; the separate account modal still showed “Development mode”.

## Home `/`

A role eyebrow sits above a personal greeting and one-line lead. Three stat cards on the right show videos completed (0/4), events joined (0), and recent posts (3), with 24px Jakarta 700 values over 12px grey labels. Two-column cards place Continue learning (0 of 4 completed; play rows marked Not started) beside Upcoming events (calendar rows with date and time). Each card has an all-items link at top right. Lower sections are Latest updates and From the community.

## Feed `/feed`

Page title and a one-line description explain that Feedback can be used to ask a question. Filters: All, Discussion, Question, Win, Resource, Announcement and Saved. A search field precedes post cards. Cards show avatar initials, name, role and time, optional PINNED / ANNOUNCEMENT / WIN status pills, title, body and footer actions for likes, comments, Copy and Save.

## Events `/events`

Upcoming / Past / All segmented control. Each event card has a month/day tile, UPCOMING pill, title, time and Online metadata, attendance and capacity, a one-line description, and I'm going / Add to calendar / Join link actions.

## Videos `/videos`

Collapsible How watching works explainer with four numbered steps. Four summary tiles: Videos 4, Completed by you 0, In progress 0, Your viewing time 0 s. A left tree filter groups all videos by cohort and day; status chips with counts and search narrow the adjacent video cards, which have thumbnails.
