# Marktplaats Watcher — Pitch Deck Transcript (14 slides)
_Extracted verbatim from the Claude artifact 2026-10-04 by Axel (read-only). Source: https://claude.ai/artifact/VszNy83Q2z3wNpZQV2U8ma_


## Slide 1

MARKTPLAATS WATCHER · FOR THE MARKTPLAATS PRODUCT AND PARTNERSHIPS TEAM
Searching,
turned into being told.
Say what you want in plain words, pick when to check, and get an e-mail only when a new listing is worth a look: every listing read and scored 0 to 10 by an AI agent, with the reason.
Daryl Nunes · marktplaats-watcher.vercel.app · October 2026
An independent proof of concept, not affiliated with Marktplaats.






**Speaker notes:**
Thank you for the time. In one line: Marktplaats Watcher turns searching into being told. You say what you want in plain words, like a Mac mini with 16GB under 500 euros, you pick when to check, and you only get an e-mail when a listing is genuinely worth a look. Every new listing is read and scored 0 to 10 by an AI agent, and the reason comes with it. It runs live today, free, up to five watches per person.


## Slide 2

THE GAP
Saved-search e-mails match keywords. Buyers want to know which listing is worth a look.
TODAY: A KEYWORD MATCH
Every listing with "Mac mini" in the title: the computer, but also the docking station, the SSD and the look-alike.
High noise, low trust. The buyer still reads every listing themselves.
WATCHER: READ, SCORED, EXPLAINED
Each new listing is read like a person would, scored 0 to 10 against what was asked, and only the good ones are e-mailed, with the reason.
Saved search 2.0: a daily habit instead of inbox noise.
Marktplaats Watcher · not affiliated with Marktplaats
02






**Speaker notes:**
Today's saved-search e-mails are keyword matches. Search for a Mac mini and you also get the docking station, the SSD and the look-alikes. That is noise, it costs trust, and the buyer still has to read every listing themselves. The Watcher reads every new listing the way a person would, scores it 0 to 10 against what you asked for, and only e-mails the good ones, with one line saying why. Think of it as saved search 2.0: something people look forward to instead of something they unsubscribe from.


## Slide 3

THE MECHANISM · READ → SCORE → EXPLAIN
Check Marktplaats for a Mac mini with 16GB under €500 every morning at 8 and e-mail me good matches, with the reason.
From a real check for "Mac mini, 16GB, under €500"
9/10 great
Apple Mac mini, Intel Core i5, 16 GB, €230
A Mac mini with 16GB well under €500. E-mailed.
0/10 low
Mac Mini M4 Docking Station 1TB, €74
A docking station, not a Mac mini. Never e-mailed.
1. Say it in plain words, in chat or a form.
2. Pick when: every 15 minutes, every morning, or only on Fridays.
3. Choose what reaches you: great (8+), good (6+) or every new listing.
Marktplaats Watcher · not affiliated with Marktplaats
03






**Speaker notes:**
This is the sentence on our landing page, and it is the whole product. You say what you want in plain words, you pick when to check, and you choose which scores reach your inbox: great matches only, good matches, or every new listing. These two cards are from a real check. A 16GB Mac mini at 230 euros scored 9 and was e-mailed. A docking station with "Mac mini" in the title scored 0 and never reached the inbox. A keyword alert would have sent both.


## Slide 4

LIVE · 60 SECONDS
Let me show you instead of telling you.
01
Say what you want: "Mac mini with 16GB under €500, every morning at 8."
02
Search live: real listings come back, each scored with its reason.
03
Save it as a watch: the schedule reads back in plain English.
04
Open a real alert e-mail: score, one-line reason, link to the listing.
marktplaats-watcher.vercel.app · 04






**Speaker notes:**
Switch to the browser now; this is the most important minute. One: open the landing page and read the sentence out loud, then type the request in chat: a Mac mini with 16GB under 500 euros. Two: show the real listings coming back, each with a score and a reason, and point at a low score for an accessory. Three: save it as a watch and show the schedule in plain English. Four: open a real alert e-mail and show the score, the reason and the link. Then come back to the slides. If the network fails, use the screenshots from the alert e-mail instead and say so.


## Slide 5

WHAT IT COULD MEAN FOR MARKTPLAATS · TO TEST IN A PILOT
Revenue, risk and cost, plus a new kind of demand data.
REVENUE
High-intent return visits
Each click arrives knowing why the listing fits. Saved search people keep, not unsubscribe from.
RISK
Sanctioned, not scraped
Smart alerts on official access, with agreed limits, instead of buyers building their own refresh tools.
COST
No build from zero
Pilot something running and evaluated, at under a cent per check, instead of specifying it from scratch.
UPSIDE
Demand in buyers' words
"Gazelle bike near 3511AB under €300, mornings" is structured buyer intent keyword search never captures.
Marktplaats Watcher · not affiliated with Marktplaats
05






**Speaker notes:**
Here is what it could mean for you, in the three buckets every business measures. These are hypotheses to test in a pilot, not promises. Revenue: alerts that only arrive when something is worth a look bring buyers back with high intent, because they already know why the listing fits. Risk: today keen buyers build their own refresh tools; this is the sanctioned version, running on official access with limits you set. Cost: you pilot something that already runs and is evaluated, at under a cent per check, instead of specifying it from zero. And the upside: a sentence like "Gazelle bike near 3511AB under 300 euros, mornings" is buyer intent in their own words, a demand signal that keyword search never captures.


## Slide 6

PROOF · IT EXISTS, IT RUNS, IT IS MEASURED
Production discipline, not a hackathon script.
94%
of "great match" e-mails were real matches (53 real listings, median of 3 runs)
20/20
chat test cases passed: search, watch, change, edge cases
€0.005
AI cost of a check that scores 20 new listings; no new listings, no cost
Live
marktplaats-watcher.vercel.app, free, up to 5 watches per person
Judged honestly
A model judge labels listings, a person spot-checks the judge, misses stay visible
Tested and audited
Test suites, dependency and secret scans on every push
Operated
Uptime checks, a runbook, a kill switch, and a hard AI spending cap
Source: evals/report.md in the project repository · not affiliated with Marktplaats
06






**Speaker notes:**
You just saw it run. Here is how we know it works. Of the e-mails sent at the "great match" level, 94 percent were real matches, measured on 53 real Marktplaats listings, median of three runs; the range was 86 to 100 percent, and at the broader "good" level it is 83 percent. A model judge labels the listings and I spot-check the judge, and the misses are listed in the report, not tuned away. All 20 chat test cases pass. And the running cost, unprompted: a check that scores 20 new listings costs about half a cent in AI; a check with nothing new costs nothing. An hourly watch costs between 33 cents and about 3 euros 70 a month depending on how busy the search is. Hosting runs on free tiers today, and there is a hard cap on AI spend: when it is hit, the AI stops and nothing unscored is e-mailed.


## Slide 7

PROOF · FROM THE ROOM
“I pay 10 euros to get this application … I think I can be your first user.”
Vinod Kumar Bhovi, founder of DataBag and the program's instructor, at demo day. He had spent that lunch break hunting Marktplaats by hand for a €400 Mac mini.
5 of 9
peer votes in the cohort build-off, plus the instructor's
40 h
Forward Deployed Engineer program, DataBag, instructor-led
Built during the DataBag Forward Deployed Engineer program, 2026.






**Speaker notes:**
The second kind of proof is people. I built this during DataBag's 40-hour Forward Deployed Engineer program. It won the cohort build-off with 5 of 9 peer votes plus the instructor's. And the instructor, Vinod Kumar Bhovi, founder of DataBag, said in the room that he would pay 10 euros for it and be the first user. He had spent that same lunch break refreshing Marktplaats by hand, looking for a 400 euro Mac mini. That is exactly the job the Watcher does, for every user, on schedule, with reasons.


## Slide 8

THE HONEST LIMIT
Today it reads listings through one personal signed-in session. That is fine for a demo and wrong for scale.
TODAY
A personal session, deliberately capped: free, 5 watches per person
A kill switch stops every scheduled check at once
Users can delete all their data in one click; ratings kept 12 months
WHAT WE WANT INSTEAD
An API or partner feed with a service account, not a person's login
Rate limits and data rules you set
Your security and legal review before anything scales
Marktplaats Watcher · not affiliated with Marktplaats
08






**Speaker notes:**
Now the honest part, and the reason I am here. Today the app reads listings through my own signed-in session. I capped it on purpose: free, five watches per person. There is a kill switch that stops every scheduled check at once, and users can delete all their data in one click. What I want instead is the official route: an API or a partner feed, with a service account rather than a person's login, rate limits and data rules that you set, and your security and legal review before anything scales. A production version needs a non-personal function user and official access. I would rather build it with you than around you.


## Slide 9

A PILOT PROPOSAL
Small, time-boxed, and ending in a clear decision.
WEEK 0
Agree
One category, success criteria and data rules, on paper.
WEEKS 1–2
Shadow mode
Score on sandbox access; nothing is sent. Compare with people's judgement.
WEEKS 3–6
Opted-in buyers
A small group gets real alerts and rates them.
[DATE]
Go, pivot or stop
Decided against the criteria on the next slide.
Marktplaats Watcher · not affiliated with Marktplaats
09






**Speaker notes:**
If the conversation goes well, this is what a pilot could look like. It is a proposal to shape together, not a fixed plan. Week zero: we agree on one category, the success criteria and the data rules, in writing. Weeks one and two: shadow mode on sandbox access; the agent scores listings but nothing is sent, and we compare its judgement with people's. Weeks three to six: a small group of opted-in buyers gets real alerts and rates them. Then, on a date we fix up front, we decide together: go, pivot or stop, against the criteria on the next slide.


## Slide 10

SUCCESS CRITERIA · AGREED BEFORE WE START
What would make it worth scaling?
METRIC
TODAY
PILOT TARGET
"Great match" e-mails that are real matches
94% on 53 listings
≥ 90% on a larger, agreed set
Buyers who rate an alert a good match
collected in the app today
[agree together]
Click-through vs saved-search e-mails
[from Marktplaats]
[agree together]
Opt-outs per 1,000 alerts
[from Marktplaats]
[agree together]
AI cost per buyer per month
€0.33–€3.68 per hourly watch
[agree together]
Today's numbers: evals/report.md · brackets are to be filled in together
10






**Speaker notes:**
A pilot is only useful if we agree up front what success means. These are my suggestions; the brackets are numbers only you have, or targets we should set together. Precision: today 94 percent of great-match e-mails are real matches, on 53 listings; for a pilot I would want at least 90 percent on a larger set we agree on. How often buyers rate an alert a good match: the app already collects those ratings. Click-through compared with your current saved-search e-mails, and opt-outs per thousand alerts: you have the baselines. And AI cost per buyer: today an hourly watch costs between 33 cents and 3 euros 68 a month, depending on how busy the search is.


## Slide 11

QUESTIONS YOU MAY HAVE
Asked at demo day, answered here.
"Why not build it ourselves?"
You can. The build is not the moat; knowing what buyers respond to is. Piloting something running is faster than specifying it from zero.
"Does it really save time?"
An expert buyer spent a lunch break refreshing for a €400 Mac mini. The Watcher does that for every user, on schedule, with reasons.
"Is this allowed?"
Today it is a capped, personal demo. The sanctioned path is exactly what this meeting is for.
"What about wrong scores?"
Measured per prompt version, misses kept visible. Every alert shows its reason, and buyers choose the threshold.
Marktplaats Watcher · not affiliated with Marktplaats
11






**Speaker notes:**
These four came up at demo day, so let me answer them before you ask. Why not build it yourselves? You can, and that is exactly why to talk: the build is not the moat, knowing what buyers respond to is, and piloting something already running is faster than specifying it from zero. If you are already building it, even better: then this becomes a conversation about helping. Does it save time? Our instructor spent a lunch break refreshing Marktplaats for a 400 euro Mac mini; this does that for everyone, on schedule. Is it allowed? Today it is a capped personal demo; the official route is the point of this meeting. Wrong scores? They are measured per prompt version with the misses visible, every alert carries its reason, and buyers pick the threshold: great matches only, good matches, or everything.


## Slide 12

THE ASK
One step now: a 30-minute conversation with the right person.
01 · NOW
30-minute call
Product, partnerships or GTM for the buyer experience.
Decide: is there interest?
02 · NEXT
Sandbox access
An API or partner feed for one category.
Decide: run the pilot?
03 · THEN
The pilot
Six weeks against agreed criteria.
Decide: go, pivot or stop
04 · LATER
Together
A white-label feature, a partner integration, or the capability itself.
Marktplaats Watcher · not affiliated with Marktplaats
12






**Speaker notes:**
So the ask is small: one 30-minute conversation with the right person on product, partnerships or GTM for the buyer experience. Everything after that is a path we would walk together, with a decision at every step. After the call: sandbox access for one category, through an API or partner feed. Then the six-week pilot against the criteria we agreed. Then, if it works, the options to explore together: a white-label smart-alerts feature, a partner integration, or acquiring the capability. Who would be the right person for that first conversation?


## Slide 13

YOUR TURN · WHAT I WOULD LIKE TO LEARN
Questions for you.
How do saved-search e-mails perform for you today?
Which categories see the most refreshing by keen buyers?
What does your partner or API programme allow?
Who signs off on data access: legal, security, the API team?
What result would make a pilot worth it for you?
Are you already building something like this?
Who else should I talk to?
Marktplaats Watcher · not affiliated with Marktplaats
13






**Speaker notes:**
This is the listening slide. Stop pitching here, ask, and write the answers down. Pick two or three questions that fit the person in front of you. A product manager: how saved-search e-mails perform, and which categories see the most refreshing. Partnerships: what the API or partner programme allows, and who signs off on data access. Anyone: what result would make a pilot worth it, whether they are already building something like this, and who else to talk to. Their answers fill in the brackets on the success-criteria slide.


## Slide 14

MARKTPLAATS WATCHER
It already runs. Let's build the official version together.
Try it
marktplaats-watcher.vercel.app
Daryl Nunes
[LinkedIn URL]
An independent proof of concept, not affiliated with Marktplaats.






**Speaker notes:**
To close: every piece of this is evaluated, tested and governed, and it already runs. What it needs to become real is official access, and I would rather build that with you than around you. The app is live at marktplaats-watcher.vercel.app, so try it after this call, and you can find me on LinkedIn. Thank you.
