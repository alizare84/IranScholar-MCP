const DEFAULT_UA =
  "IranScholarMCP/0.1 (+https://github.com/iranscholar/iranscholar-mcp; research; polite)";

/**
 * Waiting-room cookies are only for SID / Elmnet / NLAI (Iran-path partial sources).
 * Never attach IRANSCHOLAR_COOKIE to Noormags, Civilica, Irandoc, etc.
 */
const COOKIE_HOST_SUFFIXES = [
  "sid.ir",
  "elmnet.ir",
  "nlai.ir",
] as const;

function hostAllowsEnvCookie(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return COOKIE_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

function envCookieForUrl(url: string): Record<string, string> {
  const cookie = process.env.IRANSCHOLAR_COOKIE?.trim();
  if (!cookie) return {};
  try {
    const { hostname } = new URL(url);
    if (!hostAllowsEnvCookie(hostname)) return {};
  } catch {
    return {};
  }
  return { Cookie: cookie };
}

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

async function fetchTextOnce(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": DEFAULT_UA,
        Accept:
          "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "fa,en;q=0.8",
        ...envCookieForUrl(url),
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      throw new HttpError(`HTTP ${res.status} for ${url}`, res.status, url);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchText(
  url: string,
  init: RequestInit = {},
  timeoutMs = 25_000,
  retries = 2,
): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchTextOnce(url, init, timeoutMs);
    } catch (err) {
      lastErr = err;
      if (err instanceof HttpError && err.status < 500 && err.status !== 429) {
        throw err;
      }
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

export async function fetchJson<T = unknown>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 45_000,
): Promise<T> {
  const text = await fetchText(
    url,
    {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    },
    timeoutMs,
  );
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Expected JSON from ${url}, got: ${text.slice(0, 120)}`);
  }
}

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    )
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\u200c/g, "\u200c");
}

export function absUrl(base: string, href: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}
