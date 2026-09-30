import { logoSvg } from "../brand/logo.js";

// The logo comes from src/brand/logo.js (one switch for the app, favicon and app icons). The SVG is our own
// constant string, not user content, so inlining it is safe.
export default function Logo({ size = 28 }) {
  return <span className="logo" style={{ width: size, height: size }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: logoSvg({ size }) }} />;
}
