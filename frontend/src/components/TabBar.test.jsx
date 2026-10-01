import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import TabBar from "./TabBar.jsx";
import { go } from "../lib/router.js";

vi.mock("../lib/router.js", () => ({ go: vi.fn() }));
vi.stubGlobal("React", React);

test("phone navigation has three tabs for non-owners", () => {
  const html = renderToStaticMarkup(<TabBar route={{ section: "admin" }} newAlerts={2} isOwner={false} />);
  expect(html.match(/<button/g)).toHaveLength(3);
  expect(html).not.toContain("Dashboard");
  expect(html).toContain('aria-current="page"');
});

test("owner phone navigation opens and highlights Dashboard", () => {
  const tree = TabBar({ route: { section: "admin" }, isOwner: true });
  const html = renderToStaticMarkup(tree);
  expect(html.match(/<button/g)).toHaveLength(4);
  const dashboard = [...html.matchAll(/<button[^>]*>.*?<\/button>/gs)].map(([button]) => button).find((button) => button.includes("Dashboard"));
  expect(dashboard).toContain('class="active" aria-current="page"');
  expect(html).toContain('d="M5 20v-8m7 8V5m7 15v-5M3 20h18"');
  tree.props.children[3].props.onClick();
  expect(go).toHaveBeenCalledWith("/admin");
});
