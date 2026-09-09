import { describe, expect, test } from "bun:test";
import { extract } from "./extract.ts";
import type { BrowserOptions } from "./types.ts";

const article = `<html><body><main><h1>Useful article</h1><p>${"Substantial readable content. ".repeat(30)}</p></main></body></html>`;
const blocked = "<html><head><title>Just a moment...</title></head><body>Checking your browser</body></html>";

async function withPage<T>(html: string, run: (url: string) => Promise<T>): Promise<T> {
  const server = Bun.serve({
    port: 0,
    fetch: () => new Response(html, { headers: { "content-type": "text/html" } }),
  });
  try {
    return await run(`http://127.0.0.1:${server.port}`);
  } finally {
    server.stop(true);
  }
}

describe("extraction ladder", () => {
  test("does not launch a browser for usable direct HTML", async () => {
    await withPage(article, async (url) => {
      let renders = 0;
      const result = await extract(
        url,
        async () => {
          renders++;
          return article;
        },
        async () => article,
        { proxy: true, solver: true },
      );

      expect(result.provider).toBe("impit");
      expect(result.outcome).toBe("ok");
      expect(renders).toBe(0);
    });
  });

  test("uses the local browser before configured escalation", async () => {
    await withPage(blocked, async (url) => {
      const options: BrowserOptions[] = [];
      const result = await extract(
        url,
        async (_target, browserOptions) => {
          options.push(browserOptions);
          return browserOptions.useProxy ? article : blocked;
        },
        async (_target, browserOptions) => {
          options.push(browserOptions);
          return blocked;
        },
        { proxy: true, solver: true },
      );

      expect(options).toEqual([
        { useProxy: false, solve: false },
        { useProxy: false, solve: false },
        { useProxy: true, solve: true },
      ]);
      expect(result.provider).toBe("patchright+solver");
      expect(result.outcome).toBe("ok");
      expect(result.attempts.map((attempt) => attempt.provider)).toEqual([
        "impit",
        "patchright",
        "camoufox",
        "patchright+solver",
      ]);
    });
  });
});
