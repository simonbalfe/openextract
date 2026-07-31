import { describe, expect, test } from "bun:test";
import { parseProxy } from "./proxy.ts";

describe("proxy configuration", () => {
  test("parses an authenticated HTTP proxy", () => {
    expect(parseProxy("http://user:p%40ss@proxy.example:8080", "gb")).toEqual({
      browserProxy: {
        server: "http://proxy.example:8080",
        username: "user",
        password: "p@ss",
      },
      solverProxy: "proxy.example:8080:user:p@ss",
      countryCode: "GB",
    });
  });

  test("parses an unauthenticated SOCKS proxy with its default port", () => {
    expect(parseProxy("socks5://proxy.example")).toEqual({
      browserProxy: { server: "socks5://proxy.example:1080" },
      solverProxy: "proxy.example:1080",
    });
  });

  test("allows proxying to be disabled", () => {
    expect(parseProxy("")).toBeUndefined();
  });

  test("rejects provider-specific URL paths", () => {
    expect(() => parseProxy("http://proxy.example:8080/session/123")).toThrow();
  });
});
