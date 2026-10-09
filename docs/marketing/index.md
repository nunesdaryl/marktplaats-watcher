# Marketing Vault Index — Marktplaats Watcher

> Mirrors the agent-skill-pack `_vault` layout ('/Users/daryldimitrianthony/FDE Course/3 Skills/agent-skill-pack').
> The pack is the method; this folder is the product's own vault. All documents are in English.
> Phase 1 run: 2026-09-27, without an owner interview. Every assumption is marked `[NEEDS REVIEW]`.

## Audiences
- **(a) End users:** Dutch second-hand bargain hunters → buyer avatar, landing, in-app and e-mail copy.
- **(b) LinkedIn:** hiring managers, potential clients, fellow FDE/AI engineers → portfolio posts on how it was built.

## Pilot and case study

- [Engineering case study](../case-study.md): problem, manual task map, stack, failures, evaluations, economics and pilot pre-flight.
- [Marktplaats pitch pack](MARKTPLAATS-PITCH-PACK.md): access request and supporting artifacts.

## Reference Documents (Onboarding)

| File | Status | Created by |
|---|---|---|
| `references/onboarding.md` | Partial: derived from repo, needs owner review | Onboarding `/onboard` |
| `references/research.md` | Partial: web evidence; Reddit/X not reachable | Onboarding `/research` + Researcher `/last30days`, `/analyseer-concurrent` |
| `references/testimonials.md` | Partial: no own testimonials yet; community voice + collection plan | Onboarding `/testimonials` |
| `references/brand-voice.md` | Partial: extracted from product copy; test samples need owner rating | Onboarding `/brand-voice` |

## Generated Documents

| File | Status | Created by | Requires |
|---|---|---|---|
| `generated/buyer-avatar.md` | Draft (research-based) | Strategist `/avatar` | onboarding + research + testimonials |
| `generated/linkedin-audience.md` | Draft | Content Creator LinkedIn knowledge base | brand-voice |
| `generated/validation.md` | Complete (verdict + pitch) | Product Builder `/productplan` 4-question test | onboarding + buyer-avatar + testimonials |
| `generated/offer-stack.md` | Not created (free product, no offer) | Strategist `/offer` | buyer-avatar |
| `generated/content-kalender.md` | Not created (the 2-week LinkedIn calendar lives in `linkedin-series.md`) | Content Creator `/content-kalender` | brand-voice + buyer-avatar |
| `generated/linkedin-launch-post.md` | Draft, ready after `[DARYL]` line + live-URL check | Content Creator `/social-post linkedin` (#6 Case Study, Story Tease hook) | brand-voice + linkedin-audience + validation + research |
| `generated/linkedin-series.md` | Draft: 8-post calendar 29 Sep to 9 Oct 2026, full drafts for posts 2 to 4 | Content Creator `/content-kalender` + LinkedIn knowledge base | linkedin-launch-post |
| `generated/x-repurpose.md` | Draft: 7-tweet thread + 3 singles | Content Creator `/hergebruik` + X workflow | linkedin-launch-post |
| `generated/in-app-copy.md` | Draft: message hierarchy + copy deck for every surface (landing, meta, onboarding, chat, watch, errors, e-mail, privacy); 12 `[DARYL]` items open; no app string changed yet | Copywriter (Awareness/Leads, Four U's, Bencivenga proof, objections) + Strategist + SEO title/meta | brand-voice + buyer-avatar + research + validation |

## Other Folders

| Folder | Status | Created by |
|---|---|---|
| `competitors/` | 3 profiles: `marktplaats-saved-search.md`, `mpalerts.md`, `marktalert.md` | Researcher `/analyseer-concurrent` |
| `products/` | Empty | Product Builder |
| `faqs/` | Empty (draft FAQ list lives in onboarding.md) | Customer Service |

## Dependency Chain

```
references/onboarding.md ──┐
references/research.md ────┼──> generated/buyer-avatar.md ──> copy (landing, e-mail) ──┐
references/testimonials.md ┘                                                            ├─> generated/validation.md
references/brand-voice.md ──> generated/linkedin-audience.md ──> LinkedIn posts ────────┘
```

## Next Steps
1. Daryl reviews every `[NEEDS REVIEW]` item (fastest wins: origin story, native Marktplaats push check, test count).
2. Run the beta + testimonial plan (testimonials.md) and a 50-listing scoring eval (validation.md).
3. Re-run `/avatar` after 3+ testimonials.
4. Phase 2: `05-copywriter` for landing/e-mail copy; `06-content-creator /social-post linkedin` for portfolio posts.
