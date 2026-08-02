import { load } from "cheerio";

export type PageClassification =
  | { kind: "usable" }
  | { kind: "needs-browser"; reason: string }
  | { kind: "blocked"; reason: string };

const javascriptRequiredPattern = /enable javascript|javascript (?:is )?required|requires javascript|javascript to run/i;
const challengeMarkupPatterns = [
  { label: "Cloudflare challenge markup", pattern: /\/cdn-cgi\/challenge-platform|cf-chl-|cf-browser-verification/i },
  { label: "challenge form markup", pattern: /id=["']challenge-form["']|name=["']challenge-form["']/i },
];
const challengeTextPatterns = [
  { label: "browser verification", pattern: /checking (?:your )?browser|verifying (?:that )?you are human/i },
  {
    label: "human verification",
    pattern: /are you (?:a )?human|prove (?:that )?you are human|prove your humanity|complete the challenge|real person/i,
  },
  { label: "CAPTCHA challenge", pattern: /complete (?:the )?(?:captcha|security check)|captcha (?:required|verification)/i },
  { label: "access denial", pattern: /access denied|request unsuccessful|attention required/i },
  { label: "challenge interstitial", pattern: /just a moment/i },
];
const MAX_MARKUP_CHALLENGE_CHARS = 4000;
const MAX_TEXT_CHALLENGE_CHARS = 2500;
const MIN_USABLE_CONTENT_CHARS = 40;

export function classifyPage(content: string, html = ""): PageClassification {
  const value = content.trim();
  if (!html.trim()) {
    const challenge = challengeTextPatterns.find(({ pattern }) => pattern.test(value.slice(0, 5000)));
    if (value.length <= MAX_TEXT_CHALLENGE_CHARS && challenge) {
      return { kind: "blocked", reason: `short response matched ${challenge.label} (${value.length} chars)` };
    }
    if (!value) return { kind: "needs-browser", reason: "no visible content returned" };
    if (value.length < MIN_USABLE_CONTENT_CHARS) {
      return { kind: "needs-browser", reason: `only ${value.length} extractable chars returned` };
    }
    return { kind: "usable" };
  }

  const $ = load(html);
  const body = $("body").clone();
  body.find("script, style, noscript, svg").remove();
  const visibleText = body.text().replaceAll(/\s+/g, " ").trim();
  const signalText = `${value}\n${visibleText}`.slice(0, 5000);
  const contentLength = Math.max(value.length, visibleText.length);
  const markupChallenge = challengeMarkupPatterns.find(({ pattern }) => pattern.test(html));
  if (contentLength <= MAX_MARKUP_CHALLENGE_CHARS && markupChallenge) {
    return { kind: "blocked", reason: `response matched ${markupChallenge.label} (${contentLength} chars)` };
  }
  const textChallenge = challengeTextPatterns.find(({ pattern }) => pattern.test(signalText));
  if (contentLength <= MAX_TEXT_CHALLENGE_CHARS && textChallenge) {
    return { kind: "blocked", reason: `short response matched ${textChallenge.label} (${contentLength} chars)` };
  }

  const scriptCount = $("script").length;
  const requiresJavaScript = javascriptRequiredPattern.test($("noscript").text());
  const hasEmptyApplicationRoot = $('[id="app"], [id="root"]').toArray().some((node) => {
    const root = $(node).clone();
    root.find("script, style, noscript, svg").remove();
    return root.text().trim().length === 0;
  });
  if (hasEmptyApplicationRoot && visibleText.length < 500) {
    return { kind: "needs-browser", reason: `empty application root with ${visibleText.length} visible chars` };
  }
  if (requiresJavaScript && visibleText.length < 500) {
    return { kind: "needs-browser", reason: `noscript requires JavaScript with ${visibleText.length} visible chars` };
  }
  if (visibleText.length < 100 && scriptCount >= 2) {
    return { kind: "needs-browser", reason: `script-heavy shell with ${visibleText.length} visible chars and ${scriptCount} scripts` };
  }
  if (!value) return { kind: "needs-browser", reason: "no extractable content returned" };
  if (value.length < MIN_USABLE_CONTENT_CHARS) {
    return { kind: "needs-browser", reason: `only ${value.length} extractable chars returned` };
  }
  return { kind: "usable" };
}
