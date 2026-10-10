import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import PublicLanding from "./PublicLanding.jsx";

vi.mock("./PublicLandingLive.jsx", () => ({ default: ({ language }) => <span data-live={language}>Live founding places</span> }));

test.each([["nl", "Een goede vondst", "Veelgestelde vragen"], ["en", "See the good listing", "Questions"]])(
  "%s campaign page renders public content before sign-in loads", (language, headline, faq) => {
    const html = renderToStaticMarkup(<PublicLanding language={language} />);
    expect(html).toContain(headline);
    expect(html).toContain(faq);
    expect(html).toContain(`data-live="${language}"`);
    expect(html).toContain("Vinod Kumar Bhovi");
    expect(html).toContain("53");
    expect(html).toContain("data-language-switch");
  },
);
