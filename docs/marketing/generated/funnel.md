# Founding funnel and measurement (draft, 10 October 2026)

## Paths by traffic temperature
| Visitor | Path | Message | Next action |
|---|---|---|---|
| Warm: cohort, personal network, LinkedIn followers | Founder post or personal invite → app → sign-up | What Daryl built, a real watch and an honest limit. | Save a watch. |
| Cold: a permitted community post or Meta ad | Clearly labelled promotion → landing explanation/demo → sign-up | Specific job, proof as an offline test, terms before sign-up. | Save a watch. |
| Returning, opted-in user | Product email or reply from Daryl → existing watch/alerts | Check whether the first alert helped. | Rate an alert or change the watch. |

The cold landing and nurture automation are separate app issues. This pack supplies copy only. Use the existing live app until that work exists; do not imply an implemented email sequence.

## Activation and observation
1. **Watch saved:** the user reviews the proposed item, limits, schedule and bar, then confirms Save.
2. **First alert:** a qualifying *new* listing arrives after the silent first check; this may take time or never occur during the trial.
3. **Rating:** ask “Good match? Yes / Not right” on the alert. Capture reasons to improve the watch.

Read the owner dashboard for sign-ups, saved watches, first alerts and ratings by cohort, without placing stale counts in public copy. Interviews can explain drop-off. An opt-in nurture draft: welcome with one setup example; later explain the silent first check; after an actual alert ask for a rating; near the free-period end explain current terms. Send only through a separately approved, consented flow.

## Opt-in email nurture copy (draft only)
Send through a separate consented implementation, triggered by the actual event, with unsubscribe and privacy details. Do not send these as a bulk sequence from this task.

| Trigger | Dutch subject and body | English subject and body |
|---|---|---|
| Signed up, no watch yet | **Onderwerp: Maak je eerste watch.** “Welk item zoek je nu? Beschrijf het met je budget, controleer het voorstel en klik op Save. De eerste check mailt bestaande advertenties niet.” | **Subject: Set up your first watch.** “What item are you looking for? Describe it with your budget, review the suggestion and press Save. The first check does not email existing listings.” |
| Watch saved, before any alert | **Onderwerp: Waarom je nog geen melding ziet.** “Je eerste check legt bestaande advertenties vast. Pas een nieuwe advertentie boven jouw drempel kan een mail opleveren. Controleer je schema en matchdrempel in de app.” | **Subject: Why there may be no alert yet.** “Your first check records existing listings. A later new listing above your bar can trigger an email. Check your schedule and match bar in the app.” |
| First alert actually sent | **Onderwerp: Klopte deze melding?** “Open je melding en kies ‘Good match?’ of ‘Not right’. Wat ontbrak er in de score of reden? Je reactie helpt ons dit te verbeteren.” | **Subject: Did this alert fit?** “Open the alert and choose ‘Good match?’ or ‘Not right’. What did the score or reason miss? Your feedback helps us improve it.” |
| Free period nearing its actual end | **Onderwerp: Je founding-maand loopt bijna af.** “Bekijk in de app wanneer je gratis periode afloopt, hoeveel AI-budget resteert en welke vervolgstap nu geldt. Je watches kunnen pauzeren aan het einde of bij de budgetlimiet.” | **Subject: Your founding month is nearly over.** “Check the app for your actual free-period end, remaining AI budget and current next step. Watches may pause at the end or when the budget is reached.” |

## UTM convention
`utm_source` = `linkedin`, `cohort`, `community`, `dm`, `email`, or `meta`; `utm_medium` = `organic_social`, `message`, `email`, or `paid_social`; `utm_campaign` = `founding100_202610`; `utm_content` = language + asset + variant, e.g. `nl_demo_h1` or `en_meta_pas_a`. Keep one tagged URL per creative. The receiving analytics implementation is a separate issue; until present, retain tags in the drafts or Daryl's manual log. Never put email addresses or names in a UTM.
