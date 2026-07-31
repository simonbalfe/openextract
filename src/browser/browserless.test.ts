import { describe, expect, test } from "bun:test";
import { createBrowserlessRender } from "./browserless.ts";

describe("createBrowserlessRender", () => {
  test("requests rendered content with stealth enabled", async () => {
    let captured: Request | undefined;
    const render = createBrowserlessRender(
      {
        baseURL: "http://browserless:3000",
        token: "test-token",
        timeoutMS: 5_000,
      },
      async (input, init) => {
        captured = new Request(input, init);
        return new Response("<html>rendered</html>", {
          headers: { "x-response-code": "201" },
        });
      },
    );

    await expect(render("https://example.com/app")).resolves.toEqual({
      html: "<html>rendered</html>",
      status: 201,
    });
    expect(captured).toBeDefined();
    if (!captured) throw new Error("request was not captured");
    const endpoint = new URL(captured.url);
    expect(endpoint.pathname).toBe("/content");
    expect(endpoint.searchParams.get("token")).toBe("test-token");
    expect(JSON.parse(endpoint.searchParams.get("launch") ?? "null")).toEqual({
      headless: true,
      stealth: true,
    });
    expect(await captured.json()).toEqual({
      url: "https://example.com/app",
      bestAttempt: true,
      gotoOptions: {
        timeout: 30_000,
        waitUntil: "domcontentloaded",
      },
      waitForTimeout: 2_500,
    });
  });

  test("does not put an empty token in the URL", async () => {
    let capturedURL = "";
    const render = createBrowserlessRender(
      {
        baseURL: "http://browserless:3000",
        timeoutMS: 5_000,
      },
      async (input) => {
        capturedURL = input.toString();
        return new Response("<html>rendered</html>");
      },
    );

    await render("https://example.com");
    expect(new URL(capturedURL).searchParams.has("token")).toBeFalse();
  });

  test("returns a bounded error without exposing the endpoint token", async () => {
    const render = createBrowserlessRender(
      {
        baseURL: "http://browserless:3000",
        token: "secret-token",
        timeoutMS: 5_000,
      },
      async () => new Response("service unavailable", { status: 503 }),
    );

    const error = await render("https://example.com").catch((value: unknown) => value);
    expect(error).toBeInstanceOf(Error);
    if (!(error instanceof Error)) throw new Error("expected an Error");
    expect(error.message).toContain("HTTP 503");
    expect(error.message).not.toContain("secret-token");
  });
});
