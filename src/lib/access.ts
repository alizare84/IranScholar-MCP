/**
 * Helpers for Iranian academic sites that are reachable from Iran egress
 * but often return CDN Waiting Room HTML (or hang TLS) from foreign cloud IPs.
 */

export function isWaitingRoomHtml(html: string): boolean {
  const sample = html.slice(0, 8_000);
  return (
    /error-section--waiting/i.test(sample) ||
    /Transferring to the website/i.test(sample) ||
    /در حال انتقال به سایت مورد نظر هستید/i.test(sample) ||
    /در\s*حال\s*انتقال/i.test(sample)
  );
}

export function waitingRoomNote(source: string, host: string): string {
  return (
    `[${source}] CDN Waiting Room HTML from ${host} (ArvanCloud/Cloudflare-style). ` +
    `Adapters parse public pages when reachable — typical from Iran residential/ISP egress ` +
    `or an Iran HTTPS proxy. Optional: set HTTPS_PROXY / HTTP_PROXY, or IRANSCHOLAR_COOKIE ` +
    `after a browser session clears the waiting room. Not bypassing the challenge.`
  );
}

export function unreachableNote(source: string, err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    `[${source}] Network unreachable from this egress (${msg}). ` +
    `Try running the MCP server on an Iran network path (or HTTPS_PROXY to Iran egress).`
  );
}
