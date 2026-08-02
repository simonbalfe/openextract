import { describe, expect, test } from "bun:test";
import { classifyPage } from "./render.ts";

describe("classifyPage", () => {
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

    expect(classifyPage("Example article. This page already contains useful content.", html).kind).toBe("usable");
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

    expect(classifyPage("Application", html)).toEqual({
      kind: "needs-browser",
      reason: "empty application root with 0 visible chars",
    });
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

    expect(classifyPage("Loading...", html)).toEqual({
      kind: "needs-browser",
      reason: "script-heavy shell with 10 visible chars and 2 scripts",
    });
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

    expect(classifyPage("Application", html)).toEqual({
      kind: "needs-browser",
      reason: "noscript requires JavaScript with 0 visible chars",
    });
  });

  test("identifies bot challenge markup", () => {
    const html = `
      <html>
        <head><title>Just a moment...</title></head>
        <body>
          <form id="challenge-form" action="/cdn-cgi/challenge-platform/verify">Checking your browser</form>
        </body>
      </html>
    `;

    expect(classifyPage("Just a moment. Checking your browser.", html)).toEqual({
      kind: "blocked",
      reason: "response matched Cloudflare challenge markup (37 chars)",
    });
  });

  test("identifies a short textual challenge", () => {
    expect(classifyPage("Access denied. Please complete the captcha.")).toEqual({
      kind: "blocked",
      reason: "short response matched CAPTCHA challenge (43 chars)",
    });
  });

  test("identifies a human-verification interstitial", () => {
    expect(classifyPage("Prove your humanity. Complete the challenge below and let us know you're a real person.")).toEqual({
      kind: "blocked",
      reason: "short response matched human verification (87 chars)",
    });
  });

  test("renders content that is too thin to use", () => {
    expect(classifyPage("Go to end", "<html><body><main>Go to end</main></body></html>")).toEqual({
      kind: "needs-browser",
      reason: "only 9 extractable chars returned",
    });
  });

  test("keeps long content that discusses CAPTCHA", () => {
    const article = `An article about captcha accessibility. ${"Useful server-rendered content. ".repeat(70)}`;

    expect(classifyPage(article).kind).toBe("usable");
  });

  test("keeps a security product page", () => {
    const page = "Cloudflare Products. DDoS Protection. CAPTCHA and bot management. Application security and performance.";

    expect(classifyPage(page).kind).toBe("usable");
  });

  test("does not render for an unrelated empty application root", () => {
    const html = `
      <html>
        <body>
          <main>${"Substantial server-rendered content. ".repeat(20)}</main>
          <div id="app"></div>
          <script src="/widget.js"></script>
        </body>
      </html>
    `;

    expect(classifyPage("Substantial server-rendered content. ".repeat(20), html).kind).toBe("usable");
  });
});
