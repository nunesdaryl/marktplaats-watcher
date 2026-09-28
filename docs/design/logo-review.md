# Logo review: Marktplaats Watcher (for the FDE group)

> **Decision, 28 Sep 2026:** the FDE group chose **H**: the robot looking through binoculars, with the
> Marktplaats-style ≥ mark in both lenses. It's live, redrawn as vector with the round-lens binoculars of the chosen H (a more realistic
> binocular drawing was tried and reverted). The trademark risk below was known and accepted by the group.
> The "Not affiliated with Marktplaats" line stays on the landing page, e-mails and social images.
>
> **Update, 28 Sep:** the live logo is now **I**: H with the binoculars raised to just below the robot's eyes, so
> its smiling eyes still peek over the top (`pose: "eyes"`; H is `pose: "chest"`). Preview:
> `references/img/logo/logo-option-I-eye-level.png`.
>
> **Switching the logo:** the logo is defined once, in `frontend/src/brand/logo.js`.
> 1. Change `LOGO = { mark, pose, lens }`. The lens can be `"marktplaats"`, `"dot"`, `"sieve"`, `"score"`, `"slot"` or
>    `"none"`; the mark can be `"robot"` or `"sieve"`. A new marketplace is one more entry in `LENSES`.
> 2. Run `cd frontend && npm run brand`. It regenerates `public/icon.svg`, `apple-icon.png` and `icon-512.png`.
> 3. The app picks it up everywhere: sidebar, landing, boot screen, favicon, home-screen icon.

**Status:** options to decide together, 28 Sep 2026.
**The pipeline:**
- **Claude Design** produced the design language (direction **B · Sieve**: warm graphite, teal accent, lilac highlight,
  Geist + Geist Mono) and a prototype logo.
- **GPT Images** refines the final logo.
- The chosen raster logo is redrawn as SVG before it goes into the app.

The images live locally in `references/img/logo/` and are not in git.

## The options

| File | Option | What it says | Reads at 16px? | Risk |
|---|---|---|---|---|
| `sieve-symbol-prototype.png` | **Sieve** (Claude Design prototype) | Three teal bars narrowing to one lilac dot: "only the good one gets through" | Yes, designed on a 16px grid | Abstract; "watching" isn't literal |
| `logo-option-1-sieve-gpt-final.png` | **Sieve**, GPT Images final | Same idea with softer taper and balance, plus mono versions and a lockup with "Marktplaats **Watcher**" | Yes | Taper is less pronounced than the prototype |
| `logo-options-2-binoculars-A-B-C-D.png` | **Binocular lenses** (no character) | A: dot · B: `>*` (should be `>_`; a generation error) · C: sieve bars · D: Marktplaats-style | A and C yes | Reads as glasses or goggles rather than binoculars |
| `logo-options-3-robot-binoculars-A-B-C-D.png` | **Robot holding binoculars** | A: lilac dot in a lens · B: `>_` terminal prompt · C: sieve bars · D: Marktplaats-style | A and C mostly; B gets busy | Most literal "watching"; a character is harder to keep crisp as a favicon |
| `logo-options-4-robot-lenses-E-F-G-H.png` | **Robot, lens contents** | E: listing card (€230) + 9/10 · F: 9/10 in both lenses · G: swappable source slot (dashed) + dot · H: orange mark in one lens | E and F lose the text at 32px; G reads well | E and F show the score, our differentiator; G shows the "watch any marketplace" idea |
| `logo-option-5-robot-H-marktplaats-both-lenses-REJECTED.png` | **H redrawn** | The Marktplaats-style ≥ mark in both lenses | Yes | **Comparison only: trademark risk.** Never for the app, the repo or LinkedIn |

**The swappable lens (Daryl's insight).** The lens is a **source slot**. Today the robot watches Marktplaats; later the
same mark could watch Vinted, eBay or 2dehands with only the lens content changed. The master logo stays neutral, and
the source is named in the slot.

## Why the real Marktplaats logo stays out (options D and the "real logo" tile)

- Their logo (orange circle with a white arrow) is a registered trademark. Inside our logo it reads as "a Marktplaats
  product", which suggests affiliation. Trademark law protects exactly against that.
- It contradicts our own rules: "not affiliated with Marktplaats"; "avoid anything that looks official"
  (`docs/marketing/references/brand-voice.md`, `references/marktplaats-design-language.md`).
- FDE course Day 3: a trademark protects name, logo and slogan. "Search first — rebranding after traction is
  expensive."
- It's the easiest target for a takedown request, and it's visible in the public repo and on LinkedIn.
- **The name already does the job:** "Marktplaats Watcher" says what is watched, in plain words. Describing what we
  work with is fine; using their mark is not.

D and any "real logo" tile are **comparison-only**: never for the app, the repo or LinkedIn.

## Questions for the group

1. Abstract (Sieve) or literal (robot + binoculars)?
2. If binoculars: what goes in the lens? The lilac dot, the sieve bars, `>_`, or a "9/10" score chip?
3. A symbol that works on its own at 16px (favicon), or a mascot for marketing plus a simpler mark for the favicon?
