import { expect, test } from "bun:test";
import { testPage } from "./ui.ts";

test("test page extracts and safely previews Markdown", () => {
  expect(testPage).toContain('fetch("/extract"');
  expect(testPage).toContain('id="preview" title="Rendered Markdown" sandbox');
  expect(testPage).toContain("marked@18.0.7");
  expect(testPage).toContain('id="raw"');
  expect(testPage).toContain('id="attempts"');
  const script = testPage.match(/<script type="module">([\s\S]+)<\/script>/)?.[1];
  expect(script).toBeTruthy();
  expect(() => new Function(script ?? "")).not.toThrow();
});
