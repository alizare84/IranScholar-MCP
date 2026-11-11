import type { ScholarRecord, SearchResult } from "../types.js";
import {
  notImplementedRecord,
  stubSearch,
  type SourceAdapter,
} from "./base.js";

const NOTE =
  "HARD BLOCKER: sid.ir / www.sid.ir return Cloudflare Waiting Room HTML " +
  "(`error-section--waiting`, «Transferring to the website…») for all probed paths " +
  "(/ , /paper/search, legacy SearchPaper.aspx, /api/v1/search). No public JSON " +
  "search body is reachable without passing the challenge (browser/session). " +
  "Not bypassing Cloudflare.";

export const sidAdapter: SourceAdapter = {
  info: {
    id: "sid",
    nameFa: "جهاد دانشگاهی (SID)",
    nameEn: "Scientific Information Database (SID)",
    homepage: "https://www.sid.ir/",
    kinds: ["article"],
    capabilities: ["search", "get_record"],
    status: "stubbed",
    notes: NOTE,
  },

  async search(query: string, _limit: number): Promise<SearchResult> {
    return stubSearch("sid", query, NOTE);
  },

  async getRecord(idOrUrl: string): Promise<ScholarRecord> {
    return notImplementedRecord("sid", idOrUrl, NOTE);
  },
};
