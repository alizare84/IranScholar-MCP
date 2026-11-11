import type { ScholarRecord, SearchResult } from "../types.js";
import {
  notImplementedRecord,
  stubSearch,
  type SourceAdapter,
} from "./base.js";

const NOTE =
  "HARD BLOCKER: National Library hosts resolve in DNS (www.nlai.ir, opac.nlai.ir, " +
  "dl.nlai.ir) but TCP/TLS handshakes time out from this environment (http and https). " +
  "No OPAC HTML, SRU, or OpenSearch endpoint is reachable to scrape. Needs network path " +
  "to 80.191.10.x or a campus/proxy mirror.";

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
