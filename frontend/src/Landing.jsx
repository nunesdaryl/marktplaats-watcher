import { useEffect, useState } from "react";
import Logo from "./components/Logo.jsx";
import { SIGNING_IN_FLAG } from "./lib/boot.js";

// Remember in this tab that sign-in started, so the page after signing in doesn't flash the landing page (boot.js)
const signingIn = () => { try { sessionStorage.setItem(SIGNING_IN_FLAG, "1"); } catch {} };

// The product in one sentence: the same sentence you fill in when you set up a watch.
const EXAMPLES = [
  ["Mac mini with 16GB under €500", "every morning at 8", "good matches"],
  ["Gazelle bike within 10 km of 3511", "every 30 minutes", "every new listing"],
  ["Nintendo Switch OLED under €200", "on Fridays at 18:00", "great matches only"],
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
        <Logo size={40} />
        <span className="name wordmark">Marktplaats <b>Watcher</b></span>
        <SignIn mode="modal"><button className="button plain" onClick={signingIn}>Sign in</button></SignIn>
      </header>

      <main>
        {/* No aria-live: the examples change every 3.2 s, and a live region would re-read the headline in a loop */}
        <h1 className="sentence">
          Check Marktplaats for a <span className="tag" key={what}>{what}</span>{" "}
          <span className="tag" key={when}>{when}</span> and <span className="nowrap">e-mail</span> me{" "}
          <span className="tag" key={which}>{which}</span>, with the reason.
        </h1>
        <p className="lede">
          Say what you want in plain words. Pick when to check. We read every new listing, score it 0 to 10 and
          say why. Only the ones worth a look reach your inbox. Free, up to 5 watches.
        </p>
        <SignIn mode="modal"><button className="button primary large" onClick={signingIn}>Set up a free watch</button></SignIn>
        <p className="cta-note">No card, no app to install. Sign in with your e-mail or Google.</p>

        <section className="sample" aria-labelledby="sample-title">
          <h2 id="sample-title">From a real check for "Mac mini, 16GB, under €500"</h2>
          <ul>
            <li className="good">
              <span className="score">9/10</span>
              <span><strong>Apple Mac mini, Intel Core i5, 16 GB RAM, 512 GB</strong>, €230<br />
                A Mac mini with 16GB and a price well under €500. E-mailed.</span>
            </li>
            <li className="skip">
              <span className="score">0/10</span>
              <span><strong>Mac Mini M4 Docking Station 1TB</strong>, €74<br />
                A docking station, not a Mac mini. You never hear about it.</span>
            </li>
            <li className="skip">
              <span className="score">0/10</span>
              <span><strong>Also found: SSDs, a tracker and a Cisco switch</strong><br />
                All scored 0/10. None e-mailed.</span>
            </li>
          </ul>
        </section>

        <ol className="steps">
          <li><strong>Tell the chat what you want.</strong> "A Mac mini with 16GB, under €500, near Utrecht."</li>
          <li><strong>Pick when to check.</strong> Every 15 minutes, every morning at 8, or only on weekends.</li>
          <li><strong>Get an e-mail when a good one appears, with the reason.</strong> The first check only notes what's listed now, so you only hear about new ones.</li>
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
