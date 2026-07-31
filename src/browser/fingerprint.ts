import {
  FingerprintGenerator,
  type BrowserFingerprintWithHeaders,
} from "fingerprint-generator";
import { FingerprintInjector } from "fingerprint-injector";
import type { BrowserContext, BrowserContextOptions } from "patchright";

type OperatingSystem = "linux" | "macos" | "windows";

export type FingerprintGeography = {
  countryCode: string;
  locales: string[];
  timezoneId: string;
  operatingSystems: OperatingSystem[];
};

export type BrowserIdentity = {
  contextOptions: BrowserContextOptions;
  script: string;
};

const proxyGeographies: FingerprintGeography[] = [
  {
    countryCode: "US",
    locales: ["en-US", "en"],
    timezoneId: "America/New_York",
    operatingSystems: ["windows", "macos"],
  },
  {
    countryCode: "GB",
    locales: ["en-GB", "en"],
    timezoneId: "Europe/London",
    operatingSystems: ["windows", "macos"],
  },
  {
    countryCode: "DE",
    locales: ["de-DE", "de", "en"],
    timezoneId: "Europe/Berlin",
    operatingSystems: ["windows", "macos"],
  },
  {
    countryCode: "FR",
    locales: ["fr-FR", "fr", "en"],
    timezoneId: "Europe/Paris",
    operatingSystems: ["windows", "macos"],
  },
  {
    countryCode: "CA",
    locales: ["en-CA", "en"],
    timezoneId: "America/Toronto",
    operatingSystems: ["windows", "macos"],
  },
  {
    countryCode: "AU",
    locales: ["en-AU", "en"],
    timezoneId: "Australia/Sydney",
    operatingSystems: ["windows", "macos"],
  },
];

const requestSpecificHeaders = new Set([
  "accept",
  "accept-encoding",
  "cache-control",
  "pragma",
  "sec-fetch-dest",
  "sec-fetch-mode",
  "sec-fetch-site",
  "sec-fetch-user",
  "te",
  "upgrade-insecure-requests",
]);

const injector = new FingerprintInjector();
const generators = new Map<string, FingerprintGenerator>();

function localOperatingSystem(): OperatingSystem {
  if (process.platform === "darwin") return "macos";
  if (process.platform === "win32") return "windows";
  return "linux";
}

function localGeography(): Omit<FingerprintGeography, "countryCode"> {
  const resolved = new Intl.DateTimeFormat().resolvedOptions();
  const locale = resolved.locale || "en-US";
  const language = locale.split("-")[0] || "en";
  const hostOperatingSystem = localOperatingSystem();
  return {
    locales: language === locale ? [locale] : [locale, language],
    timezoneId: resolved.timeZone || "UTC",
    operatingSystems: [
      hostOperatingSystem,
      ...(["windows", "macos", "linux"] satisfies OperatingSystem[]).filter(
        (operatingSystem) => operatingSystem !== hostOperatingSystem,
      ),
    ],
  };
}

export function selectProxyGeography(countryCode: string): FingerprintGeography {
  const normalized = countryCode.trim().toUpperCase();
  const geography = proxyGeographies.find((candidate) => candidate.countryCode === normalized);
  if (!geography) throw new Error(`Unsupported proxy fingerprint country: ${normalized}`);
  return {
    ...geography,
    locales: [...geography.locales],
    operatingSystems: [...geography.operatingSystems],
  };
}

export function parseBrowserMajorVersion(version: string): number | undefined {
  const match = version.match(/(\d+)(?:\.\d+){1,3}/);
  if (!match?.[1]) return undefined;
  const major = Number(match[1]);
  return Number.isInteger(major) ? major : undefined;
}

function generator(browserVersion: string, operatingSystems: OperatingSystem[]): FingerprintGenerator {
  const major = parseBrowserMajorVersion(browserVersion);
  const key = `${major ?? "current"}:${operatingSystems.join(",")}`;
  const existing = generators.get(key);
  if (existing) return existing;
  const created = new FingerprintGenerator({
    browsers: [
      {
        name: "chrome",
        ...(major === undefined ? {} : { minVersion: major, maxVersion: major }),
      },
    ],
    devices: ["desktop"],
    operatingSystems,
    screen: {
      minWidth: 1280,
      maxWidth: 2560,
      minHeight: 720,
      maxHeight: 1440,
    },
  });
  generators.set(key, created);
  return created;
}

function browserHeaders(generated: BrowserFingerprintWithHeaders): Record<string, string> {
  return Object.fromEntries(
    Object.entries(generated.headers).filter(([name]) => !requestSpecificHeaders.has(name.toLowerCase())),
  );
}

export function createBrowserIdentity(
  browserVersion: string,
  proxyCountryCode?: string,
): BrowserIdentity {
  const proxyGeography = proxyCountryCode ? selectProxyGeography(proxyCountryCode) : undefined;
  const geography = proxyGeography ?? localGeography();
  const generated = generator(browserVersion, geography.operatingSystems).getFingerprint({
    locales: geography.locales,
    operatingSystems: geography.operatingSystems,
  });
  const { navigator, screen } = generated.fingerprint;
  return {
    contextOptions: {
      colorScheme: Math.random() < 0.5 ? "light" : "dark",
      deviceScaleFactor: screen.devicePixelRatio,
      extraHTTPHeaders: browserHeaders(generated),
      hasTouch: (navigator.maxTouchPoints ?? 0) > 0,
      isMobile: false,
      locale: navigator.language,
      screen: {
        width: screen.width,
        height: screen.height,
      },
      timezoneId: geography.timezoneId,
      userAgent: navigator.userAgent,
      viewport: {
        width: screen.width,
        height: screen.height,
      },
    },
    script: injector.getInjectableScript(generated),
  };
}

export async function installBrowserIdentity(
  context: BrowserContext,
  identity: BrowserIdentity,
): Promise<void> {
  await context.addInitScript({ content: identity.script });
}
