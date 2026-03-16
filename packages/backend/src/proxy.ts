import { ProxyAgent } from "undici";
import { SocksProxyAgent } from "socks-proxy-agent";
import http from "node:http";
import https from "node:https";

const proxyUrl = process.env.PROXY_URL;

let proxyFetch: typeof globalThis.fetch | undefined;

/**
 * Returns a fetch function that routes through PROXY_URL if configured.
 * Supports both HTTP(S) and SOCKS5 proxies.
 */
export function getProxyFetch(): typeof globalThis.fetch {
  if (!proxyUrl) return globalThis.fetch;

  if (!proxyFetch) {
    if (proxyUrl.startsWith("socks")) {
      // SOCKS5 proxy — use socks-proxy-agent with native fetch via undici
      const socksAgent = new SocksProxyAgent(proxyUrl);

      // node's native fetch (undici) doesn't support Node.js http.Agent,
      // so we use a custom fetch based on node:https for SOCKS5
      proxyFetch = ((input: any, init?: any) => {
        const url = typeof input === "string" ? input : input.url;
        const method = init?.method || "GET";
        const headers = {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          ...(init?.headers || {}),
        };
        const body = init?.body;

        return new Promise<Response>((resolve, reject) => {
          const parsedUrl = new URL(url);
          const mod = parsedUrl.protocol === "https:" ? https : http;

          const req = mod.request(
            url,
            {
              method,
              headers: headers as Record<string, string>,
              agent: socksAgent,
            },
            (res) => {
              const chunks: Buffer[] = [];
              res.on("data", (chunk) => chunks.push(chunk));
              res.on("end", () => {
                const buffer = Buffer.concat(chunks);
                const response = new Response(buffer, {
                  status: res.statusCode || 200,
                  statusText: res.statusMessage || "",
                  headers: res.headers as Record<string, string>,
                });
                resolve(response);
              });
            }
          );

          req.on("error", reject);

          if (body) {
            if (typeof body === "string") {
              req.write(body);
            } else if (Buffer.isBuffer(body)) {
              req.write(body);
            }
          }
          req.end();
        });
      }) as typeof globalThis.fetch;
    } else {
      // HTTP(S) proxy — use undici ProxyAgent
      const agent = new ProxyAgent(proxyUrl);
      proxyFetch = ((input: any, init?: any) =>
        globalThis.fetch(input, {
          ...init,
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            ...(init?.headers || {}),
          },
          // @ts-expect-error Node.js fetch supports dispatcher via undici
          dispatcher: agent,
        })) as typeof globalThis.fetch;
    }
  }

  return proxyFetch;
}
