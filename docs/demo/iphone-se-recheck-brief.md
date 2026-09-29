# iPhone SE re-check: checklist item 18 (28 Sep fix)

## What item 18 is

On 28 Sep you tested the app on your iPhone SE (2020) and found two problems:

1. **No logo once you're signed in.** The phone top bar showed only "New chat", with no robot.
2. **Cramped new-chat screen.** The typing box covered the "Give feedback & suggestions" link.

Both were fixed and deployed the same day (commit `14975e1`):
- the robot logo now sits in the phone top bar on every tab
- the new-chat screen was tightened so everything fits above the typing box

That fix was only checked in a desktop browser shrunk to phone width, not on a real iPhone. **Item 18 is you checking it on
the real phone.** Until you say it looks right, the finding stays open.

Site: https://marktplaats-watcher.vercel.app

## The re-check (about 10 minutes, on the iPhone SE)

**0. Get the new version.** Your phone may still show the old version.
- Home-screen app: swipe it away in the app switcher and open it again. If there's still no robot in the top bar, remove it
  from the home screen and add it again (Safari → Share → Add to Home Screen).
- Safari: pull down to reload.
- You have the new version when the top bar shows the small robot logo next to "New chat".

**1. The four phone steps again.** Wi-Fi off, mobile data on. Note roughly how many seconds the first load takes.
1. Load the site
2. Sign in
3. Open a watch
4. Send a chat message

**2. New chat screen (dark mode).** Tap New chat. Without scrolling, can you see all of this above the typing box?
- the heading "What are you looking for?"
- all three suggestion chips
- once the 29 Sep update is live: the "FREE BETA · Give feedback & suggestions" strip just under the top bar (before
  that update, the same text is a link under the suggestions)

Take a screenshot.

**3. With the keyboard open.** Tap the typing box so the keyboard comes up.
- Is the typing box still fully visible, not hidden behind the keyboard?
- Can you still type and send?

Screenshot.

**4. The logo on every tab.** Check the robot is in the top bar on **Chat**, **Watches** and **Alerts**. Open an existing
chat with a long title: the robot should sit next to the title, and the title should end in "…" rather than overlap the
buttons. Screenshot one of them.

**5. Home-screen app vs Safari.** If you use the home-screen app, do steps 2 and 4 there too. The phone's top edge (clock
and battery) must not cover the top bar.

**6. Light mode.** Once the 29 Sep update is live, tap the moon button in the top bar (next to your avatar); before
that, use Settings → Display & Brightness → Light and reopen the app. Repeat steps 2 and 4. Check that text is
readable, the logo looks right on the light background, and nothing is white-on-white. Screenshot. Switch back afterwards
if you like.

**7. Your verdict.** In your own words: does it look right? Is anything still off?

Before you share them, check your screenshots: your e-mail address must not be visible. It shows in the account menu, so
don't open that menu.

## What happens with your answers

The results go into `docs/demo/human-checks-2026-09-27.md` §2 and `docs/demo/pre-demo-checklist.md`:
- **item 18** gets ✅ when you say it's right
- **item 15** (light mode) gets ✅ if the light-mode step passes
- **item 2** gets the load time

If something is still off, it becomes a new fix for Claude.

---

## Prompt for ChatGPT (paste as is)

```text
You are helping me, Daryl, do an on-device check of my web app "Marktplaats Watcher" on my iPhone SE (2020), and then
record the result in the repo. The repo is at:
/Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher

First read these files:
- docs/demo/iphone-se-recheck-brief.md (the steps; this is the brief you are following)
- docs/demo/human-checks-2026-09-27.md, section 2 (what was found and what was fixed in commit 14975e1)
- docs/demo/pre-demo-checklist.md (items 2, 15 and 18)

Then guide me through steps 0–7 of the brief ONE STEP AT A TIME. After each step, wait for my answer and any screenshot
before moving on. Keep each message short: I'm holding the phone.

Rules:
- Record only what I say or what a screenshot shows. Never mark a check as passed on my behalf. Quote my exact words
  for the verdict, and add the date and time (CEST) when I said it.
- If I say something is off, write down exactly what and where (which tab, dark or light, keyboard open or not, and
  home-screen app or Safari). Do not diagnose it or fix code.
- Check every screenshot for my e-mail address or other personal data before saving it. If you find any, don't save
  the screenshot; tell me.
- Save the screenshots I share, with personal data cropped, to docs/demo/evidence-2026-09-28/ with names like
  recheck-iphone-se-<step>-<dark|light>.jpg

When all steps are done, update the docs:
1. docs/demo/human-checks-2026-09-27.md, section 2: add a dated "Re-check on the iPhone SE" entry with:
   - my verdict (quoted)
   - the approximate load time
   - pass / fail / not done for each step
   - links to the screenshots
   - any open issues
2. docs/demo/pre-demo-checklist.md:
   - item 18 to ✅ only if I said it looks right
   - item 15 to ✅ only if the light-mode step passed
   - item 2 with the load time if I gave one
   Each updated row says "see human-checks-2026-09-27.md §2".
3. If anything is still off: write a short handoff for Claude at
   docs/demo/claude-mobile-ui-recheck-2026-09-28.md with:
   - the problem, with screenshots
   - what "right" should look like
   - the rules: cosmetic only; don't commit or deploy without my OK

Do not edit application code, do not commit, push or deploy, and do not open or print any .env file. When you're done,
show me the diff of the doc changes and a three-line summary.
```
