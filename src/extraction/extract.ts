import { Impit } from "impit";
import { extractHTML } from "./html.ts";
import { pdfToText } from "./pdf.ts";
import { classifyPage } from "./render.ts";
import type { PageClassification } from "./render.ts";
import type { BrowserOptions, ExtractAttempt, ExtractProvider, ExtractResult } from "./types.ts";

type Retrieved = {
  content: string;
  contentType: ExtractResult["contentType"];
  links: string[];
  status?: number;
  classification?: PageClassification;
};

type Rung = {
  provider: ExtractProvider;
  enabled: boolean;
  retrieve: (url: string) => Promise<Retrieved>;
};

type BrowserRender = (url: string, options: BrowserOptions) => Promise<string>;

type Capabilities = {
  proxy: boolean;
  solver: boolean;
};

const MAX_CHARACTERS = 12_000;
const DEAD_STATUSES = new Set([404, 410]);
const impit = new Impit({ browser: "chrome", timeout: 15_000 });

function validateURL(input: string): string {
  const url = new URL(input);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("URL must use http or https");
  }
  return url.href;
}

function bounded(content: string): string {
  const value = content.trim();
  if (value.length <= MAX_CHARACTERS) return value;
  return `${value.slice(0, MAX_CHARACTERS)}\n\n[truncated]`;
}

function assess(result: Retrieved): Pick<ExtractAttempt, "outcome" | "detail"> {
  if (result.status !== undefined && result.status >= 400) {
    return {
      outcome: result.status === 401 || result.status === 403 || result.status === 429 ? "blocked" : "http-error",
      detail: `HTTP ${result.status}`,
    };
  }
  if (!result.content.trim()) return { outcome: "empty", detail: "No content returned" };
  if (result.classification?.kind === "blocked") {
    return { outcome: "blocked", detail: result.classification.reason };
  }
  if (result.classification?.kind === "needs-browser") {
    return { outcome: "render-required", detail: result.classification.reason };
  }
  if (result.contentType === "pdf" && result.content.trim().length < 10) {
    return { outcome: "empty", detail: "Extracted PDF content was too short" };
  }
  return { outcome: "ok" };
}

async function retrieveWithImpit(url: string): Promise<Retrieved> {
  const response = await impit.fetch(url);
  if (!response.ok) return { content: "", contentType: "unknown", links: [], status: response.status };
  const header = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (header.includes("pdf") || new URL(url).pathname.toLowerCase().endsWith(".pdf")) {
    return {
      content: await pdfToText(await response.arrayBuffer()),
      contentType: "pdf",
      links: [],
      status: response.status,
    };
  }
  if (header.includes("html") || !header) {
    const html = await response.text();
    const extracted = extractHTML(html, url);
    return {
      ...extracted,
      contentType: "html",
      status: response.status,
      classification: classifyPage(extracted.content, html),
    };
  }
  if (header.includes("text")) {
    const content = (await response.text()).trim();
    return {
      content,
      contentType: "text",
      links: [],
      status: response.status,
      classification: classifyPage(content),
    };
  }
  return { content: "", contentType: "unknown", links: [], status: response.status };
}

function browserRetriever(render: BrowserRender, useProxy: boolean, solve: boolean): (url: string) => Promise<Retrieved> {
  return async (url) => {
    const html = await render(url, { useProxy, solve });
    const extracted = extractHTML(html, url);
    return {
      ...extracted,
      contentType: "html",
      status: 200,
      classification: classifyPage(extracted.content, html),
    };
  };
}

function ladder(render: BrowserRender, capabilities: Capabilities): Rung[] {
  return [
    { provider: "impit", enabled: true, retrieve: retrieveWithImpit },
    { provider: "patchright", enabled: true, retrieve: browserRetriever(render, false, false) },
    {
      provider: "patchright+proxy",
      enabled: capabilities.proxy,
      retrieve: browserRetriever(render, true, false),
    },
    {
      provider: "patchright+solver",
      enabled: capabilities.solver,
      retrieve: browserRetriever(render, capabilities.proxy, true),
    },
  ];
}

export async function extract(input: string, render: BrowserRender, capabilities: Capabilities): Promise<ExtractResult> {
  const url = validateURL(input);
  const attempts: ExtractAttempt[] = [];
  let lastProvider: ExtractProvider = "impit";
  let lastType: ExtractResult["contentType"] = "unknown";

  for (const rung of ladder(render, capabilities)) {
    lastProvider = rung.provider;
    if (!rung.enabled) {
      attempts.push({ provider: rung.provider, outcome: "skipped", durationMs: 0, detail: "Not configured" });
      continue;
    }
    const started = performance.now();
    try {
      const result = await rung.retrieve(url);
      lastType = result.contentType;
      const assessment = assess(result);
      attempts.push({
        provider: rung.provider,
        outcome: assessment.outcome,
        ...(result.status === undefined ? {} : { status: result.status }),
        durationMs: Math.round(performance.now() - started),
        ...(assessment.detail ? { detail: assessment.detail } : {}),
      });
      if (result.status !== undefined && DEAD_STATUSES.has(result.status)) {
        return {
          url,
          content: "",
          contentType: result.contentType,
          provider: rung.provider,
          outcome: "dead",
          links: [],
          attempts,
        };
      }
      if (assessment.outcome === "ok") {
        return {
          url,
          content: bounded(result.content),
          contentType: result.contentType,
          provider: rung.provider,
          outcome: "ok",
          links: result.links,
          attempts,
        };
      }
    } catch (error) {
      attempts.push({
        provider: rung.provider,
        outcome: "error",
        durationMs: Math.round(performance.now() - started),
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    url,
    content: "",
    contentType: lastType,
    provider: lastProvider,
    outcome: "failed",
    links: [],
    attempts,
  };
}
