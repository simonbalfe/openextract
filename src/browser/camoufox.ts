import { Camoufox } from "camoufox-js";
import type { Browser } from "playwright-core";
import { firstLine } from "../support/errors.ts";
import { isChallenge } from "./challenges.ts";
import { serializeRenderedPage } from "./shadow.ts";

let browserPromise: Promise<Browser> | undefined;

async function browser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = Camoufox({
      headless: process.env.DISPLAY ? false : process.platform === "linux" ? "virtual" : true,
    }).catch((error) => {
      browserPromise = undefined;
      throw error;
    });
    browserPromise.then(() => console.log("camoufox launched")).catch((error) => {
      console.error(`camoufox launch failed error=${firstLine(error)}`);
    });
  }
  return browserPromise;
}

export async function renderWithCamoufox(target: string): Promise<string> {
  const instance = await browser();
  const page = await instance.newPage();
  try {
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (!isChallenge(await page.title().catch(() => ""))) {
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    } else {
      for (let attempt = 0; attempt < 4 && isChallenge(await page.title().catch(() => "")); attempt++) {
        await page.waitForTimeout(2500);
      }
    }
    return await page.evaluate(serializeRenderedPage, undefined);
  } finally {
    await page.close().catch(() => {});
  }
}

export async function closeCamoufox(): Promise<void> {
  if (!browserPromise) return;
  const instance = await browserPromise.catch(() => undefined);
  await instance?.close().catch(() => {});
}
