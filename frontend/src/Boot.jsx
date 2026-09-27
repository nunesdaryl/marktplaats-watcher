import Landing from "./Landing.jsx";

// What shows before the app's JavaScript and Clerk have loaded. It is prerendered into the static HTML, so a
// first-time visitor sees the landing page at once. Returning signed-in users (flag set by the app, read by a
// tiny script in <head> before first paint) see a quiet placeholder instead of a landing-page flash.
export default function Boot({ landing }) {
  return (
    <>
      {landing && <div className="boot-landing"><Landing /></div>}
      <div className={`boot-wait ${landing ? "" : "always"}`} aria-hidden="true"><span className="logo" style={{ width: 36, height: 36, fontSize: 20 }}>🛒</span></div>
    </>
  );
}
