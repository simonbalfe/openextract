export type BrowserlessRenderedPage = {
  html: string;
  status?: number;
};

export type BrowserlessRender = (url: string) => Promise<BrowserlessRenderedPage>;

type BrowserlessConfig = {
  baseURL: string;
  token?: string;
  timeoutMS: number;
};

type HTTPFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

function responseStatus(response: Response): number | undefined {
  const value = response.headers.get("x-response-code");
  if (!value) return undefined;
  const status = Number.parseInt(value, 10);
  return Number.isInteger(status) ? status : undefined;
}

export function createBrowserlessRender(
  config: BrowserlessConfig,
  fetcher: HTTPFetch = fetch,
): BrowserlessRender {
  const endpoint = new URL("/content", config.baseURL);
  if (config.token) endpoint.searchParams.set("token", config.token);
  endpoint.searchParams.set(
    "launch",
    JSON.stringify({ headless: true, stealth: true }),
  );

  return async (url) => {
    const response = await fetcher(endpoint, {
      method: "POST",
      headers: {
        accept: "text/html",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        url,
        bestAttempt: true,
        gotoOptions: {
          timeout: 30_000,
          waitUntil: "domcontentloaded",
        },
        waitForTimeout: 2_500,
      }),
      signal: AbortSignal.timeout(config.timeoutMS),
    });
    const html = await response.text();
    if (!response.ok) {
      const detail = html.trim().replaceAll(/\s+/g, " ").slice(0, 200);
      throw new Error(
        `browserless returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`,
      );
    }
    const status = responseStatus(response);
    return {
      html,
      ...(status === undefined ? {} : { status }),
    };
  };
}
