import { describe, expect, test } from "bun:test";
import {
  createBrowserIdentity,
  parseBrowserMajorVersion,
  selectProxyGeography,
} from "./fingerprint.ts";

describe("browser fingerprints", () => {
  test("parses Chromium version strings", () => {
    expect(parseBrowserMajorVersion("146.0.7680.0")).toBe(146);
    expect(parseBrowserMajorVersion("Chromium 146.0.7680.0")).toBe(146);
    expect(parseBrowserMajorVersion("unknown")).toBeUndefined();
  });

  test("selects the configured proxy geography", () => {
    expect(selectProxyGeography("gb").countryCode).toBe("GB");
    expect(() => selectProxyGeography("ZZ")).toThrow();
  });

  test("creates a coherent proxy browser identity", () => {
    const identity = createBrowserIdentity("146.0.7680.0", "GB");
    expect(identity.contextOptions.locale).toBe("en-GB");
    expect(identity.contextOptions.timezoneId).toBe("Europe/London");
    expect(identity.contextOptions.userAgent).toContain("Chrome/146.");
    const viewport = identity.contextOptions.viewport;
    expect(viewport).toBeTruthy();
    if (!viewport) throw new Error("Expected a fingerprint viewport");
    expect(identity.contextOptions.screen).toEqual(viewport);
    expect(identity.contextOptions.extraHTTPHeaders?.["accept-language"]).toContain("en-GB");
    expect(identity.script.length).toBeGreaterThan(10_000);
  });

  test("rotates browser properties", () => {
    const identities = Array.from({ length: 12 }, () => createBrowserIdentity("146.0.7680.0", "GB"));
    const contextOptions = identities.map((identity) => JSON.stringify(identity.contextOptions));
    expect(new Set(contextOptions).size).toBeGreaterThan(1);
  });
});
