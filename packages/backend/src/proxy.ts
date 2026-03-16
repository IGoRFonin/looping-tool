import { ProxyAgent } from "undici";

const proxyUrl = process.env.PROXY_URL;

let proxyFetch: typeof globalThis.fetch | undefined;

/**
 * Returns a fetch function that routes through PROXY_URL if configured.
 * Falls back to global fetch if no proxy is set.
 */
export function getProxyFetch(): typeof globalThis.fetch {
  if (!proxyUrl) return globalThis.fetch;

  if (!proxyFetch) {
    const agent = new ProxyAgent(proxyUrl);
    proxyFetch = ((input: any, init?: any) =>
      globalThis.fetch(input, {
        ...init,
        // @ts-expect-error Node.js fetch supports dispatcher via undici
        dispatcher: agent,
      })) as typeof globalThis.fetch;
  }

  return proxyFetch;
}
