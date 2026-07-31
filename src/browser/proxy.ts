type BrowserProxy = {
  server: string;
  username?: string;
  password?: string;
};

export type ProxyConfig = {
  browserProxy: BrowserProxy;
  solverProxy: string;
  countryCode?: string;
};

const supportedProtocols = new Set(["http:", "https:", "socks4:", "socks5:"]);
const defaultPorts: Record<string, string> = {
  "http:": "80",
  "https:": "443",
  "socks4:": "1080",
  "socks5:": "1080",
};

export function parseProxy(input: string, countryInput = ""): ProxyConfig | undefined {
  const value = input.trim();
  if (!value) return undefined;

  const url = new URL(value);
  if (!supportedProtocols.has(url.protocol)) throw new Error("Unsupported proxy protocol");
  if (!url.hostname) throw new Error("Proxy URL must include a hostname");
  if ((url.pathname && url.pathname !== "/") || url.search || url.hash) {
    throw new Error("Proxy URL must not include a path, query, or fragment");
  }

  const username = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  const port = url.port || defaultPorts[url.protocol];
  if (!port) throw new Error("Proxy URL must include a port");
  const countryCode = countryInput.trim().toUpperCase();
  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) {
    throw new Error("Proxy country must be a two-letter code");
  }

  const host = url.hostname.includes(":") ? `[${url.hostname}]` : url.hostname;
  const server = `${url.protocol}//${host}:${port}`;
  const solverProxy = username
    ? `${host}:${port}:${username}:${password}`
    : `${host}:${port}`;
  return {
    browserProxy: {
      server,
      ...(username ? { username, password } : {}),
    },
    solverProxy,
    ...(countryCode ? { countryCode } : {}),
  };
}

const proxyConfig = parseProxy(
  process.env.OPENEXTRACT_PROXY_URL ?? "",
  process.env.OPENEXTRACT_PROXY_COUNTRY ?? "",
);

export const hasProxy = Boolean(proxyConfig);
export const proxyCountryCode = proxyConfig?.countryCode;

export function createProxySession(): ProxyConfig {
  if (!proxyConfig) throw new Error("Proxy is not configured");
  return proxyConfig;
}
