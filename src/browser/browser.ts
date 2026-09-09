import { chromium, type Browser } from "patchright";
import type { BrowserOptions } from "../extraction/types.ts";
import { firstLine } from "../support/errors.ts";
import { hasTurnstile, isChallenge, solveTurnstile } from "./challenges.ts";
import { createBrowserIdentity, installBrowserIdentity } from "./fingerprint.ts";
import { createProxySession, hasProxy, proxyCountryCode } from "./proxy.ts";
import { serializeRenderedPage } from "./shadow.ts";
import { hasCapsolver, solveCloudflare } from "./solvers.ts";

export async function launchBrowser(attempts = 6): Promise<Browser> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const browser = await chromium.launch({
        channel: "chrome",
        headless: !process.env.DISPLAY,
      });
      console.log(`browser launched attempt=${attempt}`);
      return browser;
    } catch (error) {
      console.error(`browser launch failed attempt=${attempt} error=${firstLine(error)}`);
      if (attempt === attempts) throw error;
      await Bun.sleep(3000);
    }
  }
  throw new Error("browser failed to launch");
}

export async function render(
  browser: Browser,
  target: string,
  options: BrowserOptions,
): Promise<string> {
  const useProxy = options.useProxy && hasProxy;
  const session = useProxy ? createProxySession() : null;
  const identity = (() => {
    try {
      return createBrowserIdentity(browser.version(), useProxy ? proxyCountryCode : undefined);
    } catch (error) {
      console.warn(`browser fingerprint unavailable version=${browser.version()} error=${firstLine(error)}`);
      return undefined;
    }
  })();

  async function createContext() {
    const context = await browser.newContext({
      ...identity?.contextOptions,
      ...(session ? { proxy: session.browserProxy } : {}),
    });
    if (identity) await installBrowserIdentity(context, identity);
    return context;
  }

  let context = await createContext();
  try {
    let page = await context.newPage();
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30000 });
    const userAgent = await page.evaluate(() => navigator.userAgent);
    const challenged = isChallenge(await page.title().catch(() => ""));
    if (!challenged) {
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    } else if (!options.solve) {
      for (let attempt = 0; attempt < 4 && isChallenge(await page.title().catch(() => "")); attempt++) {
        await page.waitForTimeout(2500);
      }
    }
    let html = await page.evaluate(serializeRenderedPage, undefined);

    if (options.solve && hasTurnstile(html)) {
      await solveTurnstile(page, page.url(), html);
      html = await page.evaluate(serializeRenderedPage, undefined);
    }

    if (options.solve && session && hasCapsolver && isChallenge(html)) {
      const challengeURL = page.url();
      const solution = await solveCloudflare(
        challengeURL,
        session.solverProxy,
        userAgent,
        html,
      );
      const cookies = Object.entries(solution.cookies ?? {}).map(([name, value]) => ({
        name,
        value: String(value),
        url: challengeURL,
      }));
      await context.close().catch(() => {});
      context = await createContext();
      if (cookies.length > 0) await context.addCookies(cookies);
      page = await context.newPage();
      await page.goto(challengeURL, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      html = await page.evaluate(serializeRenderedPage, undefined);
    }
    return html;
  } finally {
    await context.close().catch(() => {});
  }
}
