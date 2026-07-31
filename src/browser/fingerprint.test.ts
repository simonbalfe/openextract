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

  test("selects proxy geography deterministically", () => {
    expect(selectProxyGeography(() => 0).countryCode).toBe("US");
    expect(selectProxyGeography(() => 0.999999).countryCode).toBe("AU");
  });

  test("creates a coherent proxy browser identity", () => {
    const identity = createBrowserIdentity("146.0.7680.0", true, () => 0);
    expect(identity.countryCode).toBe("US");
    expect(identity.contextOptions.locale).toBe("en-US");
    expect(identity.contextOptions.timezoneId).toBe("America/New_York");
    expect(identity.contextOptions.userAgent).toContain("Chrome/146.");
    const viewport = identity.contextOptions.viewport;
    expect(viewport).toBeTruthy();
    if (!viewport) throw new Error("Expected a fingerprint viewport");
    expect(identity.contextOptions.screen).toEqual(viewport);
    expect(identity.contextOptions.extraHTTPHeaders?.["accept-language"]).toContain("en-US");
    expect(identity.script.length).toBeGreaterThan(10_000);
    expect(identity.signature).toContain("en-US");
  });

  test("rotates direct and proxy browser properties", () => {
    const proxySignatures = new Set(
      Array.from({ length: 12 }, () =>
        createBrowserIdentity("146.0.7680.0", true).signature,
      ),
    );
    const directSignatures = new Set(
      Array.from({ length: 12 }, () =>
        createBrowserIdentity("146.0.7680.0", false).signature,
      ),
    );
    expect(proxySignatures.size).toBeGreaterThan(1);
    expect(directSignatures.size).toBeGreaterThan(1);
  });
});
