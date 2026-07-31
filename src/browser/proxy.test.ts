import { describe, expect, test } from "bun:test";
import { formatProxyPassword } from "./proxy.ts";

describe("proxy sessions", () => {
  test("matches proxy geography to the browser identity", () => {
    expect(formatProxyPassword("secret", "abc12345", "gb")).toBe(
      "secret_country-GB_session-abc12345_lifetime-10",
    );
  });

  test("supports sessions without explicit geography", () => {
    expect(formatProxyPassword("secret", "abc12345")).toBe(
      "secret_session-abc12345_lifetime-10",
    );
  });
});
