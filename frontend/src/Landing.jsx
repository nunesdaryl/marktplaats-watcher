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
          Say what you're after in plain words. The watcher checks as often as you like, an AI scores
          every new listing, and only the good ones reach your inbox.
        </p>
        <SignIn mode="modal"><button className="primary">Sign in to start watching</button></SignIn>

        <ol className="steps">
          <li><strong>Tell the chat what you want.</strong> "A Mac mini with 16GB, under €500, near Utrecht."</li>
          <li><strong>Pick how often to check.</strong> Every 15 minutes, every morning at 8, or only on weekends.</li>
          <li><strong>Get an e-mail when a good one appears.</strong> Each listing comes with a score and the reason for it.</li>
        </ol>

        <section id="privacy" className="fineprint">
          <h2>What we keep, and for how long</h2>
          <p>
            Your e-mail address (to send alerts), your watches, and the listings we've already shown you, for 30 days.
            Searches and listing titles are sent to OpenAI to score them. Nothing else, and nothing is sold or shared.
            "Delete my data" in the app removes it all at once.
          </p>
          <p>
            A portfolio project, not affiliated with Marktplaats. It reads Marktplaats' public search pages.
            Alerts come from marktplaats-watcher@agentmail.to.
          </p>
        </section>
      </main>
    </div>
  );
}
