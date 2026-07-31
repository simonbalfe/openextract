type BrowserProxy = {
  server: string;
  username: string;
  password: string;
};

export type ProxySession = {
  browserProxy: BrowserProxy;
  solverProxy: string;
};

const proxyConfig = {
  username: process.env.EVOMI_USERNAME ?? "",
  password: process.env.EVOMI_PASSWORD ?? "",
  gateway: process.env.EVOMI_GATEWAY ?? "",
};

export const hasProxy = Boolean(proxyConfig.username && proxyConfig.password && proxyConfig.gateway);

export function formatProxyPassword(
  password: string,
  sessionID: string,
  countryCode?: string,
): string {
  const country = countryCode ? `_country-${countryCode.toUpperCase()}` : "";
  return `${password}${country}_session-${sessionID}_lifetime-10`;
}

function createSessionID(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

export function createProxySession(countryCode?: string): ProxySession {
  const password = formatProxyPassword(proxyConfig.password, createSessionID(), countryCode);
  return {
    browserProxy: {
      server: `http://${proxyConfig.gateway}`,
      username: proxyConfig.username,
      password,
    },
    solverProxy: `${proxyConfig.gateway}:${proxyConfig.username}:${password}`,
  };
}
