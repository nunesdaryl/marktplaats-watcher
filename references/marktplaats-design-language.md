# Marktplaats' design language (observed 28 Sep 2026)

Observed on www.marktplaats.nl in Chrome: the homepage, the search results for "mac mini" and a listing page. Colours
and fonts were read from the page's computed styles, not guessed. Screenshots are in `img/marktplaats-*.jpg`, with the
account name replaced by "(account)". They are kept out of git.

Why this file exists: the Watcher is **not affiliated** with Marktplaats and must not look official (brand-voice rule:
"avoid anything that looks official"). To stay clear of their look, we first need to know exactly what it is.

## Brand elements

| Element | Value | Where |
|---|---|---|
| Logo | An **orange circle with a white arrow/"z" mark**, then the word "Marktplaats" in a **slab serif** | top left of every page |
| Brand orange | `#EDA566` (rgb 237,165,102) | logo circle, a thin **stripe across the very top** of the page, rating badge, campaign banners |
| Text navy | `#2D3C4D` (rgb 45,60,77) | almost all text (about 1,500 elements on the homepage) |
| Action blue | `#116DB4` (rgb 17,109,180) | links, primary buttons ("Plaats advertentie", "Bewaar je zoekopdracht"), active tab underline, breadcrumbs |
| Secondary slate | `#4B6179` | secondary text |
| Page background | `#FBFBFA` (warm off-white), white header | |
| Tinted selected | `#EAF7FE` background + 1px `#116DB4` border | "Lijst / Foto's" toggle when selected |
| Campaign | orange `#EDA566` left and navy right, split by a diagonal; headline in the slab serif | "Ook slim" banner ("Vind de auto die aan al je wensen voldoet") |

## Typography

| Use | Font | Size / weight |
|---|---|---|
| Logo word, section headings ("Uitgelicht", "Categorieën", "Beschrijving"), header links, **listing title and price on the listing page** | **Bree Serif** (slab), self-hosted as `BreeSerif` 300/400 | title 24px/400, price 32px/400, header links 18px |
| Body, list titles, filters, buttons | **Roboto** 300/400/500 | body 14px/400, buttons 16px/500 |
| Number plates | "Kenteken" (a licence-plate font for car ads) | |

## Components

- **Primary button:** blue `#116DB4`, off-white text, 8px radius, Roboto 500 16px, with an icon on the left ("Plaats
  advertentie" has a tag icon, "Bewaar je zoekopdracht" a bookmark-plus).
- **Secondary button:** off-white background, 1px blue border, blue text, 8px radius ("← Terug", "Lijst", "Foto's",
  arrow buttons on the gallery).
- **Search bar:** one row of joined fields with 1px grey borders and 3px outer radius: free text | "Alle categorieën…"
  select | "Postcode" | "Alle afstanden…" select | "Zoek" (a blue text button).
- **Category strip:** line icons plus a label per category, separated by thin vertical dividers.
- **Search results, list view:**
  - 16:9-ish photo with a rounded **white heart button** (save)
  - title (Roboto 500), description snippet, condition ("Nieuw")
  - price on the right (bold, "€ 18,00" with a space and decimals), date ("Vandaag"), seller name as a blue link,
    location
  - flags such as "Topadvertentie" (green text) and "Bezoek website"
- **Home feed cards:** photo, title, "€ 35,00", heart button. Loading state: grey skeleton blocks.
- **Listing page:**
  - breadcrumbs
  - large gallery with a count ("1/19") and a thumbnail strip
  - an **orange rating badge** ("Beoordeeld met 9+")
  - title and price in the slab serif, grey "Verzenden" chip
  - seller block with a verified tick, blue full-width buttons
  - "Beschrijving" section
- **Filters sidebar:** section headings in Roboto 500, radio buttons and checkboxes with counts on the right, "Toon meer ⌄"
  links.
- **Icons:** thin outline style (header: chat bubbles, bell, person; categories: car, sofa, plant, clothes, camera,
  pram).

## Layout and feel

- Centred content, about 1,150px wide. White sticky header with the orange top stripe. Two-column search (filters left,
  results right).
- **Dense and busy.** Many links, counts, flags, ads and seller badges on one screen.
- **Lots of advertising:** a large empty ad slot above the listing, ad slots between search results, "Topadvertentie"
  (paid placement), a banner "De volgorde van de resultaten wordt mede bepaald door betaalde opvalmogelijkheden" (the
  order of results is partly determined by paid visibility).
- **The noise we filter.** A "mac mini" search (609 results) mixes a Mac mini from 2011, an auction, and a **Bluetooth
  tracker** ("Mini Bluetooth Tracker met Apple Find My"). That is exactly what the Watcher's score and reason are for.
- Tone: friendly, practical, Dutch ("Voor jou", "In je buurt", "Ook slim").

## What the Watcher must NOT borrow (look-alike risk)

1. **No orange circle, no arrow or "z" mark**, and no orange `#EDA566`-family brand colour. Our current amber `#F2A900`
   is in the same family: change or clearly separate it.
2. **No slab serif** (Bree Serif or similar) for the wordmark or headings.
3. **No navy-text plus action-blue pairing.** Our current `#1D1D1F` text plus `#0071E3` accent is already close to
   `#2D3C4D` plus `#116DB4`.
4. **No thin brand stripe** across the top edge.
5. **No heart-save buttons, "Topadvertentie" style flags, or ad-like slots.** Our product is calm and ad-free.
6. The word "Marktplaats" in our name must never be set in their style (the full name "Marktplaats Watcher" is kept by
   decision). Keep the **"Not affiliated with Marktplaats"** line on landing, e-mail and social images.

## What we may learn from (without copying)

- The price is the most important number on a card. Our equivalent is **the score** plus **the price**.
- Skeleton loading states instead of spinners.
- Clear "save your search" framing. Our "watch" is the calmer, explained version of their "Bewaar je zoekopdracht"
  (save your search) and "Meldingen" (notifications).
