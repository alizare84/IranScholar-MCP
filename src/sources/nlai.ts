import type { ScholarRecord, SearchResult } from "../types.js";
import {
  notImplementedRecord,
  stubSearch,
  type SourceAdapter,
} from "./base.js";

const NOTE =
  "HARD BLOCKER (re-probed): National Library hosts resolve in DNS and accept TCP " +
  "(www.nlai.ir / opac.nlai.ir / dl.nlai.ir → 80.191.10.x:80/443), but TLS handshake " +
  "and plain HTTP hang with 0 bytes (connect-timeout ~15–30s). No OPAC HTML, SRU, or " +
  "OpenSearch body is reachable from this cloud environment. Needs a network path " +
  "that completes the handshake (campus/proxy mirror) — not a scrape/auth bypass.";

export const nlaiAdapter: SourceAdapter = {
  info: {
    id: "nlai",
    nameFa: "کتابخانه ملی ایران",
    nameEn: "National Library of Iran",
    homepage: "https://www.nlai.ir/",
    kinds: ["book", "catalog"],
    capabilities: ["search", "get_record"],
    status: "stubbed",
    notes: NOTE,
  },

  async search(query: string, _limit: number): Promise<SearchResult> {
    return stubSearch("nlai", query, NOTE);
  },

  async getRecord(idOrUrl: string): Promise<ScholarRecord> {
    return notImplementedRecord("nlai", idOrUrl, NOTE);
  },
};
