import { useEffect, useState } from "react";
import Logo from "./components/Logo.jsx";
import { SIGNING_IN_FLAG } from "./lib/boot.js";
import { linkTo } from "./lib/router.js";
import { MIN_SCORE, NOTIFY_LABEL, NOTIFY_SHORT } from "../convex/schedule";

// Remember in this tab that sign-in started, so the page after signing in doesn't flash the landing page (boot.js)
const signingIn = () => { try { sessionStorage.setItem(SIGNING_IN_FLAG, "1"); } catch {} };

// The product in one sentence: the same sentence you fill in when you set up a watch.
const EXAMPLES = [
  ["Mac mini with 16GB under €500", "every morning at 8", "good"],
  ["Gazelle bike within 10 km of 3511", "every evening at 7", "good"],
  ["Nintendo Switch OLED under €200", "on Fridays at 18:00", "great"],
];

function useCycle(length, ms) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((n) => (n + 1) % length), ms);
    return () => clearInterval(id);
  }, [length, ms]);
  return i;
}

// Before Clerk has loaded (the prerendered page), the sign-in buttons are plain buttons.
const Plain = ({ children }) => children;

export default function Landing({ SignIn = Plain }) {
  const [what, when, which] = EXAMPLES[useCycle(EXAMPLES.length, 3200)];
  return (
    <div className="landing">
      <header className="bar">
        {/* The logo goes home, as on Marktplaats; this is home, so it scrolls back to the top */}
        <a className="home-link" aria-label="Marktplaats Watcher, home"
           {...linkTo("/", () => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }))}>
          <Logo size={40} />
          <span className="name wordmark">Marktplaats <b>Watcher</b></span>
        </a>
        <SignIn mode="modal"><button className="button plain" onClick={signingIn}>Sign in</button></SignIn>
      </header>

      <main>
        {/* No aria-live: the examples change every 3.2 s, and a live region would re-read the headline in a loop */}
        <h1 className="sentence">
          Check Marktplaats for a <span className="tag" key={what}>{what}</span>{" "}
          <span className="tag" key={when}>{when}</span> and <span className="nowrap">e-mail</span> me{" "}
          <span className="tag" key={which}>{NOTIFY_LABEL[which]}</span><span className="sentence-tail">, with the reason.</span>
        </h1>
        <p className="hint">{NOTIFY_LABEL[which]} means {NOTIFY_SHORT[which]}.</p>
        <p className="lede">
          Say what you want in plain words. Pick when to check. We read every new listing, score it 0 to 10 and
          say why. You choose which ones reach your inbox. Free, up to 5 watches.
        </p>
        <SignIn mode="modal"><button className="button primary large" onClick={signingIn}>Set up a free watch</button></SignIn>
        <p className="cta-note">No card, no app to install. Sign in with your e-mail or Google.</p>

        <section className="sample" aria-labelledby="sample-title">
          <h2 id="sample-title">From a real check for "Mac mini, 16GB, under €500"</h2>
          <p className="hint">How scores work: every listing gets a score from 0 to 10 and a reason. {MIN_SCORE.great}+ is great, {MIN_SCORE.good}+ is good. You choose which ones reach your inbox.</p>
          <ul>
            <li className="good">
              <span className="score">9/10<br />great</span>
              <span><strong>Apple Mac mini, Intel Core i5, 16 GB RAM, 512 GB</strong>, <span className="sample-price">€230</span><br />
                A Mac mini with 16GB and a price well under €500. E-mailed.</span>
            </li>
            <li className="skip">
              <span className="score">0/10<br />low</span>
              <span><strong>Mac Mini M4 Docking Station 1TB</strong>, <span className="sample-price">€74</span><br />
                A docking station, not a Mac mini. With good matches selected, it stays out of your inbox.</span>
            </li>
            <li className="skip">
              <span className="score">0/10<br />low</span>
              <span><strong>Also found: SSDs, a tracker and a Cisco switch</strong><br />
                All scored 0/10. None e-mailed with good matches selected.</span>
            </li>
          </ul>
        </section>

        {/* The question every visitor has: Marktplaats already has saved searches. Facts from its help pages, 29 Sep 2026 */}
        <section className="compare" aria-labelledby="compare-title">
          <h2 id="compare-title">Not another saved search</h2>
          <div className="compare-cols">
            <div>
              <h3>Marktplaats' saved search</h3>
              <ul>
                <li>Matches the words you typed</li>
                <li>Sends every ad that matches: accessories, look-alikes and wanted ads too</li>
                <li>A notice once a day, with no reason given</li>
              </ul>
            </div>
            <div className="ours">
              <h3>Marktplaats Watcher</h3>
              <ul>
                <li>Understands what you asked for, in plain words</li>
                <li>Reads every new listing and scores it 0 to 10, with the reason</li>
                <li>E-mails the scores you choose, when you choose</li>
              </ul>
            </div>
          </div>
          <p className="compare-note">About Marktplaats' saved searches: its own help pages, September 2026.</p>
        </section>

        <ol className="steps">
          <li><strong>Tell the chat what you want.</strong> "A Mac mini with 16GB, under €500, near Utrecht."</li>
          <li><strong>Pick when to check.</strong> Every 15 minutes, every morning at 8, or only on weekends. One e-mail with the listings you chose, rather than a ping per listing.</li>
          <li><strong>Get an e-mail when a good one appears, with the reason.</strong> The first check only notes what's listed now, so you only hear about new ones. Rate each alert, so the scores keep getting checked.</li>
        </ol>

        <section id="privacy" className="fineprint">
          <h2>What we keep, and for how long</h2>
          <p>
            Your e-mail address and your watches, until you delete them. Your chats and the listings we've checked,
            until 30 days after they were last used. Your messages, searches and listing details (titles, prices, places) are sent to OpenAI to
            answer and score them. Nothing is sold; the only other companies that see it are the ones that run
            the app (OpenAI, Convex, Clerk, AgentMail, Vercel). "Delete my data" removes everything we store at once;
            your login account is closed separately, under your account menu.
          </p>
          <p>
            Up to 5 watches per person, checked at most every 15 minutes. Each check reads every listing placed since
            the last one, with your price and distance applied by Marktplaats. A search in the chat shows the first
            page of results.
          </p>
          <p>
            A free portfolio project by Daryl Nunes, not affiliated with Marktplaats. Alerts come from
            marktplaats-watcher@agentmail.to, so add it to your contacts.
          </p>
        </section>
      </main>
    </div>
  );
}
