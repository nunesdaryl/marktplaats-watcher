# Outreach drafts: founding users and Marktplaats (6 October 2026)

Drafts for Daryl to copy and send himself. Nothing here is sent, posted or signed in on his behalf.
Why now: the product is live and the factory backlog is empty; the founding places (4 of 100 taken on 6 October) and
official data access are the highest-leverage next steps. See `docs/system-design.html`, "Highest-leverage next steps".

Fill in before sending: `[phone]`, `[LinkedIn URL]`.

## 1. Cohort group post (WhatsApp)

> Hi Cohort 1! 👋 Marktplaats Watcher is live and I'm opening it to the first 100 people, **free for 30 days**:
> 👉 https://marktplaats-watcher.vercel.app
>
> Tell it what you're hunting for in plain words ("Mac mini 16GB under €500"), pick when to check, and it only e-mails
> you the listings worth a look, with the reason. New: it can also suggest an opening offer and write the message for you.
>
> I'd love your honest feedback: there's a "Give feedback" link at the top. 96 places left. 🙏

## 2. Comment under the LinkedIn post (4 October)

> Update: Marktplaats Watcher is open, and **96 of the 100 free founding places are still available** (free for 30
> days). Set up a watch in under a minute: https://marktplaats-watcher.vercel.app. Vinodkumar Bhovi, your bidding
> request is live too: "Help me make an offer" suggests a fair opening price and writes the message for you. 😉

## 3. Message to Vinod (WhatsApp)

> Hi Vinod! Two quick things.
> 1) Your request is live: on any listing worth a look, "Help me make an offer" suggests an opening price and writes a
> polite Dutch message you send yourself. Would love your verdict on your Mac mini watch.
> 2) I'm opening the app to the first 100 users, free for 30 days. Would you be willing to share the link in the cohort
> or your network?
>
> And for the Marktplaats pitch: do you have, or know anyone with, a contact at Marktplaats or Adevinta (product,
> partnerships or their API team)? A warm intro would make all the difference. Thanks again for being user #1!

## 4. Marktplaats API access (MW-14)

**Phone script for the business desk (088 008 26 26, weekdays):**

> "Hallo, ik ben Daryl Nunes. Ik heb een kleine app gebouwd die kopers een e-mail stuurt als er een nieuwe advertentie
> verschijnt die past bij wat ze zoeken. Ik wil dat graag op de officiële manier doen via jullie API
> (api.marktplaats.nl). Daarnaast wil ik kopers via jullie eigen toestemmingsscherm per gebruiker intrekbare toegang laten geven om namens hen te bieden en berichten te sturen, binnen jullie limieten. Met wie kan ik praten over partnertoegang tot de zoek-API en deze gedelegeerde toegang?"
>
> English: "I built a small app that e-mails buyers when a new listing matches what they're looking for. I'd like to do
> this the official way through your API. I would also like buyers to authorise us on your own consent screen, per user and revocably, to place bids and send messages within your limits. Who can I talk to about search API access and this delegated access?"

**Follow-up e-mail (once you have a name or address):**

> Subject: Request for partner access to the Marktplaats search API
>
> Hello,
>
> I'm Daryl Nunes, an automation engineer in The Hague. I built Marktplaats Watcher (marktplaats-watcher.vercel.app),
> a small app for buyers: people describe what they're looking for, and it e-mails them only new listings that match,
> with the reason. It's a free beta with at most 100 users, and every alert links straight to the listing on
> Marktplaats.
>
> Today it reads public search results, but I'd like to do this properly through your official API (api.marktplaats.nl,
> /v1/search) with partner credentials, within your rate limits and terms. I would also like to discuss official, revocable delegated buyer access: each user authorises us on Marktplaats' own consent screen to place bids and send messages for them, within your limits. Could you tell me how to request access, or
> put me in touch with the right team?
>
> I'm also happy to show a 2-minute demo.
>
> Kind regards,
> Daryl Nunes
> [phone] · [LinkedIn URL]

Record the answer in Linear MW-14 (who, when, what they said).

## 5. Interview guide for the first users (15 minutes each)

1. "What were you hunting for when you signed up, and how did you look for it before?"
2. "Tell me about the last alert you got. Was it worth a look? Why or why not?"
3. "Was anything confusing or slower than you expected when you set up your watch?"
4. "How would you feel if you could no longer use it: very, somewhat or not disappointed?"
5. "What would make you tell a friend about it?"

**Who to start with:** the person with the broad "Printer" watch (what kind of printer, why no price limit), and anyone
who stalls in the owner dashboard's sign-up funnel (for example, signed up but never saved a watch).

**MW-83 at the same time:** ask them to "send me feedback" without a hint; note whether they found it and how quickly.

## How we'll know it's working (owner dashboard)

- Accounts and activation (watch saved → first alert → rated) by **19 October**, when the first day-14 survey goes out.
- Survey answers and the share "very disappointed" (aim 40% or more, with enough answers) by **4 November**.
- A reply from Marktplaats or its API programme (MW-14).
