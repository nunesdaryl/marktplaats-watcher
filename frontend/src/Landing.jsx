import { useEffect, useState } from "react";
import Logo from "./Logo.jsx";

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

export default function Landing({ SignIn }) {
  const [what, when, which] = EXAMPLES[useCycle(EXAMPLES.length, 3200)];
  return (
    <div className="landing">
      <header className="bar">
        <Logo />
        <span className="name">Marktplaats Watcher</span>
        <SignIn mode="modal"><button className="ghost">Sign in</button></SignIn>
      </header>

      <main>
        <h1 className="sentence" aria-live="polite">
          Check Marktplaats for a <span className="tag" key={what}>{what}</span>{" "}
          <span className="tag" key={when}>{when}</span> and <span className="nowrap">e-mail</span> me{" "}
          <span className="tag" key={which}>{which}</span>.
        </h1>
        <p className="lede">
          Say what you want. Pick when to check. Every new listing gets a score from 0 to 10 and the reason
          for it, and only the ones worth a look reach your inbox. Free.
        </p>
        <SignIn mode="modal"><button className="primary">Sign in to start watching</button></SignIn>

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
          </ul>
        </section>

        <ol className="steps">
          <li><strong>Tell the chat what you want.</strong> "A Mac mini with 16GB, under €500, near Utrecht."</li>
          <li><strong>Pick how often to check.</strong> Every 15 minutes, every morning at 8, or only on weekends.</li>
          <li><strong>Get an e-mail when a good one appears.</strong> The first check only notes what's listed now, so you only hear about new ones.</li>
        </ol>

        <section id="privacy" className="fineprint">
          <h2>What we keep, and for how long</h2>
          <p>
            Your e-mail address (to send alerts), your watches, and the listings we've already shown you, for 30 days.
            Searches and listing titles are sent to OpenAI to score them. Nothing else, and nothing is sold or shared.
            "Delete my data" in the app removes it all at once.
          </p>
          <p>
            Up to 5 watches per person, checked at most every 15 minutes. It reads the first page of Marktplaats'
            public search results, so it's for watching, not for searching everything.
          </p>
          <p>
            A portfolio project, not affiliated with Marktplaats. Alerts come from marktplaats-watcher@agentmail.to.
          </p>
        </section>
      </main>
    </div>
  );
}
