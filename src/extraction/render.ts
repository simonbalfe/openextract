import { load } from "cheerio";

const javascriptRequiredPattern = /enable javascript|javascript (?:is )?required|requires javascript|javascript to run/i;
const strongBlockMarkers = [
  "checking your browser",
  "cf-browser-verification",
  "request unsuccessful",
  "ddos protection",
];
const shortBlockMarkers = [
  "enable javascript",
  "please enable js",
  "you need to enable javascript",
  "captcha",
  "are you a human",
  "access denied",
];

export function isBlockPageContent(content: string): boolean {
  const value = content.trim();
  if (!value) return true;

  const head = value.slice(0, 4000).toLowerCase();
  if (strongBlockMarkers.some((marker) => head.includes(marker))) return true;
  return value.length <= 1500 && shortBlockMarkers.some((marker) => head.includes(marker));
}

export function needsBrowser(html: string): boolean {
  if (!html.trim()) return true;

  const $ = load(html);
  const scriptCount = $("script").length;
  const requiresJavaScript = javascriptRequiredPattern.test($("noscript").text());
  const hasEmptyApplicationRoot = $('[id="app"], [id="root"]').toArray().some((node) => {
    const root = $(node).clone();
    root.find("script, style, noscript, svg").remove();
    return root.text().trim().length === 0;
  });
  const body = $("body").clone();
  body.find("script, style, noscript, svg").remove();
  const visibleTextLength = body.text().replaceAll(/\s+/g, " ").trim().length;

  return hasEmptyApplicationRoot || requiresJavaScript || (visibleTextLength < 100 && scriptCount >= 2);
}
