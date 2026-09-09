export type ExtractProvider =
  | "impit"
  | "patchright"
  | "camoufox"
  | "patchright+proxy"
  | "patchright+solver";

export type ExtractOutcome = "ok" | "dead" | "failed";

export type BrowserOptions = {
  useProxy: boolean;
  solve: boolean;
};

export type ExtractAttempt = {
  provider: ExtractProvider;
  outcome: "ok" | "empty" | "render-required" | "blocked" | "http-error" | "error" | "skipped";
  status?: number;
  durationMs: number;
  detail?: string;
};

export type ExtractResult = {
  url: string;
  content: string;
  contentType: "html" | "pdf" | "text" | "unknown";
  provider: ExtractProvider;
  outcome: ExtractOutcome;
  links: string[];
  attempts: ExtractAttempt[];
};
