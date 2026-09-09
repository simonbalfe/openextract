import type { Page } from "patchright";
import { firstLine } from "../support/errors.ts";
import { solveToken, solverOrder } from "./solvers.ts";

const challengePattern =
  /just a moment|checking your browser|cf-browser-verification|verifying you are human|enable javascript|captcha/i;
const turnstileSitekeyPattern = /(?:data-sitekey|sitekey["'\s:=]+)["']?(0x[0-9A-Za-z_-]{20,})/;

export function isChallenge(value: string): boolean {
  return challengePattern.test(value);
}

export function hasTurnstile(html: string): boolean {
  return turnstileSitekeyPattern.test(html);
}

function turnstileSolved(html: string): boolean {
  return /cf-turnstile-response["'\s:=]+[^"'\s>]{20,}|name=["']cf-turnstile-response["'][^>]*value=["'][^"'\s>]{20,}/i.test(
    html,
  );
}

async function clickTurnstile(page: Page): Promise<boolean> {
  const challengeFrame = page
    .frames()
    .find((frame) => frame.url().startsWith("https://challenges.cloudflare.com/"));
  const element = challengeFrame
    ? challengeFrame.getByRole("checkbox").first()
    : page.locator(".cf-turnstile, [data-sitekey]").first();
  const box = await element.boundingBox().catch(() => null);
  if (!box) return false;
  const x = box.x + 28;
  const y = box.y + box.height / 2;
  await page.mouse.move(x - 60, y - 25, { steps: 8 });
  await page.mouse.move(x, y, { steps: 14 });
  await page.waitForTimeout(250 + Math.random() * 400);
  await page.mouse.click(x, y);
  return true;
}

async function injectTurnstileToken(page: Page, token: string): Promise<void> {
  await page.evaluate((value) => {
    for (const element of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input[name="cf-turnstile-response"], textarea[name="cf-turnstile-response"], input[name="g-recaptcha-response"]',
    )) {
      element.value = value;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const scope = window as typeof window & {
      __turnstileCb?: (token: string) => void;
      turnstileCallback?: (token: string) => void;
      onTurnstileSuccess?: (token: string) => void;
    };
    const callback = scope.__turnstileCb ?? scope.turnstileCallback ?? scope.onTurnstileSuccess;
    if (typeof callback === "function") {
      try {
        callback(value);
      } catch {}
    }
    for (const form of document.querySelectorAll("form")) {
      if (!form.querySelector('[name="cf-turnstile-response"]')) continue;
      try {
        form.requestSubmit ? form.requestSubmit() : form.submit();
      } catch {}
    }
  }, token);
}

export async function solveTurnstile(
  page: Page,
  target: string,
  initialHTML: string,
): Promise<string> {
  const clicked = await clickTurnstile(page).catch(() => false);
  if (clicked) await page.waitForTimeout(8000);
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  let html = await page.content();
  if (!isChallenge(await page.title().catch(() => ""))) return html;

  const sitekey = initialHTML.match(turnstileSitekeyPattern)?.[1] ?? null;
  if (!sitekey) return html;
  if (turnstileSolved(html) || !hasTurnstile(html)) return html;

  if (solverOrder().length > 0) {
    const token = await solveToken(target, sitekey).catch((error) => {
      console.error(`turnstile solver failed error=${firstLine(error)}`);
      return null;
    });
    if (token) {
      await injectTurnstileToken(page, token);
      await page.waitForTimeout(2500);
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      html = await page.content();
    }
  }
  return html;
}
