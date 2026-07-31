import { describe, expect, test } from "bun:test";
import { isBlockPageContent, needsBrowser } from "./render.ts";

describe("needsBrowser", () => {
  test("keeps content-rich static HTML on direct HTTP", () => {
    const html = `
      <html>
        <head><title>Example article</title></head>
        <body>
          <main>
            <h1>Example article</h1>
            <p>This page already contains the useful article content returned by the server.</p>
          </main>
          <script src="/analytics.js"></script>
        </body>
      </html>
    `;

    expect(needsBrowser(html)).toBe(false);
  });

  test("renders an empty application root", () => {
    const html = `
      <html>
        <head><title>Application</title></head>
        <body>
          <div id="app"></div>
          <script src="/runtime.js"></script>
        </body>
      </html>
    `;

    expect(needsBrowser(html)).toBe(true);
  });

  test("renders a short script-heavy shell", () => {
    const html = `
      <html>
        <head><title>Application</title></head>
        <body>
          <div>Loading...</div>
          <script src="/runtime.js"></script>
          <script src="/app.js"></script>
        </body>
      </html>
    `;

    expect(needsBrowser(html)).toBe(true);
  });

  test("renders a page whose noscript fallback requires JavaScript", () => {
    const html = `
      <html>
        <head><title>Application</title></head>
        <body>
          <noscript>You need to enable JavaScript to run this app.</noscript>
          <script src="/app.js"></script>
        </body>
      </html>
    `;

    expect(needsBrowser(html)).toBe(true);
  });
});

describe("isBlockPageContent", () => {
  test("rejects a short challenge page", () => {
    expect(isBlockPageContent("Access denied. Please complete the captcha.")).toBe(true);
  });

  test("keeps a long article that mentions a block marker", () => {
    const article = `An article about captcha accessibility. ${"Useful server-rendered content. ".repeat(70)}`;

    expect(isBlockPageContent(article)).toBe(false);
  });
});
