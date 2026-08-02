import { expect, test } from "bun:test";
import { parseHTML } from "linkedom";
import { serializeRenderedPage } from "./shadow.ts";

test("serializes nested shadow roots and assigned slots", () => {
  const { document } = parseHTML('<html><body><outer-box><span slot="title">Archive</span></outer-box></body></html>');
  const outer = document.querySelector("outer-box");
  if (!outer) throw new Error("missing outer-box");
  const outerRoot = outer.attachShadow({ mode: "open" });
  outerRoot.innerHTML = '<section><h1><slot name="title"></slot></h1><inner-box></inner-box></section>';
  const inner = outerRoot.querySelector("inner-box");
  if (!inner) throw new Error("missing inner-box");
  inner.attachShadow({ mode: "open" }).innerHTML = "<p>Nested content</p>";

  const html = serializeRenderedPage(document);

  expect(html).toContain('<h1><span slot="title">Archive</span></h1>');
  expect(html).toContain("<inner-box><p>Nested content</p></inner-box>");
  expect(html).not.toContain("<slot");
});
