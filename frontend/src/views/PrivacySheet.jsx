import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import Sheet from "../components/Sheet.jsx";
import { ConfirmButton } from "./WatchView.jsx";

export default function PrivacySheet({ email, waitlisted = false, onClose }) {
  const deleteMyData = useMutation(api.users.deleteMyData);
  return (
    <Sheet title="Privacy and your data" onClose={onClose}>
      <div className="stack prose">
        {waitlisted ? <p>We keep your waitlist e-mail address and what you're hunting for until you're admitted or delete your data. We use your e-mail to tell you when a place opens.</p> : <>
        <p>Alerts go to <strong data-private>{email}</strong>, from marktplaats-watcher@agentmail.to.</p>
        <p>After sign-up we may email a short set of tips in your landing page language, or your browser language. Each tip has a link to stop these tips; alerts still arrive. We count sent tips and clicks on their app links, without tracking pixels.</p>
        <p>We hide paid placements and, unless you choose otherwise, shops and dealers. We use only whether a seller has a website, never who they are.</p>
        <p>We keep your e-mail address and your watches until you delete them. Chats and checked listings are deleted
          30 days after they were last used. Your messages, searches and listing details (titles, prices, places)
          are sent to OpenAI to answer and score them. Feedback you send is kept with your e-mail address so Daryl can
          reply, together with the page you were on, your screen size and browser, and (unless you untick it) a
          screenshot of that page with your e-mail address hidden. To improve the app we record which features you use
          (for example "saved a watch" or "opened an alert"), never what you type, and keep that for 90 days. Vercel
          counts page visits without cookies. To run the service, fix problems and improve it, Daryl (the owner) can see
          your account, watches, alerts, saved chats and feedback in a private dashboard that only Daryl can open. When you
          rate an alert ("good match" or "not right, because…"), that answer is kept for 12 months to improve the scores and tune that watch's future scores, and is deleted with the watch or with Delete my data. Founding survey answers are kept for 12 months and deleted with Delete my data. Nothing is sold; the only other companies that see it are the ones that run the app (OpenAI, Convex,
          Clerk, AgentMail, Vercel). Delete my data removes everything we store; close your login account separately
          under your account menu.</p>
        </>}
        <p className="muted">A free portfolio project by Daryl Nunes, not affiliated with Marktplaats.</p>
        <ConfirmButton icon="trash" label="Delete my data" confirmLabel="Delete everything? This can't be undone."
                       onConfirm={async () => { await deleteMyData(); onClose(); window.location.hash = "/"; }} />
      </div>
    </Sheet>
  );
}
