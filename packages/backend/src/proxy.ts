import { ProxyAgent } from "undici";
import { SocksProxyAgent } from "socks-proxy-agent";
import http from "node:http";
import https from "node:https";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Convert Headers/object/array to plain Record */
function toPlainHeaders(h: any): Record<string, string> {
  if (!h) return {};
  if (typeof h.entries === "function") {
    const out: Record<string, string> = {};
    for (const [k, v] of h.entries()) out[k] = v;
    return out;
  }
  if (Array.isArray(h)) {
    const out: Record<string, string> = {};
    for (const [k, v] of h) out[k] = v;
    return out;
  }
  return { ...h };
}

let proxyFetch: typeof globalThis.fetch | undefined;
let initialized = false;

/**
 * Returns a fetch function that routes through PROXY_URL if configured.
 * Supports both HTTP(S) and SOCKS5 proxies.
 * Reads PROXY_URL lazily to ensure dotenv has loaded.
 */
export function getProxyFetch(): typeof globalThis.fetch {
  if (initialized) return proxyFetch || globalThis.fetch;
  initialized = true;

  const proxyUrl = process.env.PROXY_URL;
  if (!proxyUrl) {
    console.log("[proxy] No PROXY_URL configured, using direct connection");
    return globalThis.fetch;
  }

  if (proxyUrl.startsWith("socks")) {
    console.log(`[proxy] Using SOCKS5 proxy: ${proxyUrl}`);
    const socksAgent = new SocksProxyAgent(proxyUrl);

    proxyFetch = ((input: any, init?: any) => {
      let url: string;
      if (typeof input === "string") {
        url = input;
      } else if (input instanceof URL) {
        url = input.toString();
      } else if (input?.url) {
        // Request object
        url = input.url;
      } else {
        url = String(input);
      }
      const method = init?.method || input?.method || "GET";
      const headers: Record<string, string> = {
        "User-Agent": BROWSER_UA,
        ...toPlainHeaders(input?.headers),
        ...toPlainHeaders(init?.headers),
      };
      const body = init?.body ?? input?.body;

      return new Promise<Response>((resolve, reject) => {
        const parsedUrl = new URL(url);
        const mod = parsedUrl.protocol === "https:" ? https : http;

        const req = mod.request(
          url,
          { method, headers, agent: socksAgent },
          (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => {
              const buffer = Buffer.concat(chunks);
              resolve(
                new Response(buffer, {
                  status: res.statusCode || 200,
                  statusText: res.statusMessage || "",
                  headers: res.headers as Record<string, string>,
                })
              );
            });
          }
        );

        req.on("error", reject);

        if (body) {
          if (typeof body === "string") req.write(body);
          else if (Buffer.isBuffer(body)) req.write(body);
        }
        req.end();
      });
    }) as typeof globalThis.fetch;
  } else {
    console.log(`[proxy] Using HTTP proxy: ${proxyUrl}`);
    const agent = new ProxyAgent(proxyUrl);
    proxyFetch = ((input: any, init?: any) =>
      globalThis.fetch(input, {
        ...init,
        headers: {
          "User-Agent": BROWSER_UA,
          ...toPlainHeaders(init?.headers),
        },
        // @ts-expect-error Node.js fetch supports dispatcher via undici
        dispatcher: agent,
      })) as typeof globalThis.fetch;
  }

  return proxyFetch;
}
