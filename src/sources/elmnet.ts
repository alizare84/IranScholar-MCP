import type { ScholarRecord, SearchResult } from "../types.js";
import {
  notImplementedRecord,
  stubSearch,
  type SourceAdapter,
} from "./base.js";

const NOTE =
  "HARD BLOCKER: www.elmnet.ir / elmnet.ir return ArvanCloud Waiting Room HTML " +
  "(`error-section--waiting`, «Transferring to the website…» / «در حال انتقال به سایت مورد نظر هستید…») " +
  "for all probed paths (/, /search, /doc/{id}, /api, robots.txt, sitemap). " +
  "Irandoc `search.irandoc.ac.ir/api/elmnet/search` only serves the SPA shell (no JSON). " +
  "No public HTML/JSON search body is reachable without passing the challenge. " +
  "Not bypassing ArvanCloud/Cloudflare-style waiting rooms. Known public URL shape when reachable: `/doc/{id}`.";

export const elmnetAdapter: SourceAdapter = {
  info: {
    id: "elmnet",
    nameFa: "علم‌نت",
    nameEn: "Elmnet",
    homepage: "https://www.elmnet.ir",
    kinds: ["article", "thesis", "conference"],
    capabilities: ["search", "get_record"],
    status: "stubbed",
    notes: NOTE,
  },

  async search(query: string, _limit: number): Promise<SearchResult> {
    return stubSearch("elmnet", query, NOTE);
  },

  async getRecord(idOrUrl: string): Promise<ScholarRecord> {
    return notImplementedRecord("elmnet", idOrUrl, NOTE);
  },
};
