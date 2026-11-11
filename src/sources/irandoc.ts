import { fetchJson } from "../lib/http.js";
import type { ScholarRecord, SearchHit, SearchResult } from "../types.js";
import type { SourceAdapter } from "./base.js";

/**
 * Ganj theses are exposed through Irandoc’s public federated search proxy
 * (search.irandoc.ac.ir). Direct ganj.irandoc.ac.ir often times out from this
 * environment; the proxy is the live path.
 */
const SEARCH_API = "https://search.irandoc.ac.ir/api/ganj/search";
const VIEW_BASE = "https://ganj.irandoc.ac.ir/#/articles";

interface GanjContribution {
  role?: { title_fa?: string; title_en?: string };
  researcher?: { full_name_fa?: string; full_name_en?: string };
}

interface GanjResult {
  title?: string;
  ja_pub_yyyy?: number;
  uuid?: string;
  external_link?: string | null;
  publishable_type?: string;
  publishable_type_en?: string;
  contributions?: GanjContribution[];
  grade?: { title_fa?: string };
  field?: { title_fa?: string };
  super_field?: { title_fa?: string };
  subjects?: Array<{ title_fa?: string }>;
}

interface GanjSearchResponse {
  results_total_count?: number;
  results?: GanjResult[];
  expersioned_search_params?: string;
}

function extractUuid(idOrUrl: string): string {
  const m =
    idOrUrl.match(/[0-9a-f]{32}/i) ||
    idOrUrl.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
  if (m) return m[0]!.replace(/-/g, "").toLowerCase();
  if (/^[0-9a-f]{32}$/i.test(idOrUrl.trim())) return idOrUrl.trim().toLowerCase();
  throw new Error(
    `Irandoc id/url not recognized (expect Ganj uuid): ${idOrUrl}`,
  );
}

function authorsFrom(result: GanjResult): string[] {
  const names: string[] = [];
  for (const c of result.contributions ?? []) {
    const role = c.role?.title_fa ?? "";
    // Prefer authors / پدیدآور; still keep advisors as secondary if no authors
    const name =
      c.researcher?.full_name_fa || c.researcher?.full_name_en || "";
    if (!name) continue;
    if (/پدیدآور|author/i.test(role) || !role) names.push(name);
  }
  if (names.length) return names;
  return (result.contributions ?? [])
    .map((c) => c.researcher?.full_name_fa || c.researcher?.full_name_en || "")
    .filter(Boolean);
}

function toHit(result: GanjResult): SearchHit | null {
  if (!result.uuid || !result.title) return null;
  return {
    source: "irandoc",
    id: result.uuid,
    title: result.title,
    authors: authorsFrom(result),
    year: result.ja_pub_yyyy != null ? String(result.ja_pub_yyyy) : undefined,
    journal: result.publishable_type,
    url: `${VIEW_BASE}/${result.uuid}`,
    snippet: [result.grade?.title_fa, result.field?.title_fa]
      .filter(Boolean)
      .join(" · "),
  };
}

function toRecord(result: GanjResult): ScholarRecord {
  const id = result.uuid ?? "";
  return {
    source: "irandoc",
    id,
    title: result.title ?? id,
    authors: authorsFrom(result),
    year: result.ja_pub_yyyy != null ? String(result.ja_pub_yyyy) : undefined,
    journal: result.publishable_type,
    language: "fa",
    url: result.external_link || `${VIEW_BASE}/${id}`,
    keywords: (result.subjects ?? [])
      .map((s) => s.title_fa || "")
      .filter(Boolean),
    extra: {
      publishableTypeEn: result.publishable_type_en ?? "",
      grade: result.grade?.title_fa ?? "",
      field: result.field?.title_fa ?? "",
      superField: result.super_field?.title_fa ?? "",
    },
  };
}

/** Recent search hits (uuid → result) so get_record works after search without ganj detail host. */
const recordCache = new Map<string, GanjResult>();
const CACHE_LIMIT = 200;

function cacheResults(results: GanjResult[]): void {
  for (const row of results) {
    if (!row.uuid) continue;
    const key = row.uuid.toLowerCase().replace(/-/g, "");
    if (recordCache.has(key)) recordCache.delete(key);
    recordCache.set(key, row);
    while (recordCache.size > CACHE_LIMIT) {
      const first = recordCache.keys().next().value;
      if (first === undefined) break;
      recordCache.delete(first);
    }
  }
}

async function ganjSearch(keywords: string): Promise<GanjSearchResponse> {
  // results_per_page=1 is the SPA enum for ~25 hits (TwentyFive)
  const params = new URLSearchParams({
    keywords,
    basicscope: "1",
    sort_by: "1",
    sort_direction: "1",
    results_per_page: "1",
    fulltext_status: "1",
    page: "1",
  });
  const data = await fetchJson<GanjSearchResponse>(
    `${SEARCH_API}?${params}`,
    {
      headers: {
        Origin: "https://search.irandoc.ac.ir",
        Referer: "https://search.irandoc.ac.ir/",
      },
    },
    60_000,
  );
  cacheResults(data.results ?? []);
  return data;
}

export const irandocAdapter: SourceAdapter = {
  info: {
    id: "irandoc",
    nameFa: "ایرانداک (گنج)",
    nameEn: "Irandoc (Ganj theses)",
    homepage: "https://ganj.irandoc.ac.ir/",
    kinds: ["thesis", "proposal"],
    capabilities: ["search", "get_record"],
    status: "live",
    notes:
      "Live via https://search.irandoc.ac.ir/api/ganj/search (federated proxy). Direct ganj.irandoc.ac.ir often times out. get_record uses in-process cache from recent search hits (no public detail HTML/API).",
  },

  async search(query: string, limit: number): Promise<SearchResult> {
    const data = await ganjSearch(query);
    const hits: SearchHit[] = [];
    for (const row of data.results ?? []) {
      if (hits.length >= limit) break;
      const hit = toHit(row);
      if (hit) hits.push(hit);
    }
    return {
      source: "irandoc",
      status: "live",
      query,
      hits,
      note:
        `Ganj proxy total≈${data.results_total_count ?? hits.length}` +
        (data.expersioned_search_params
          ? `; parsed as «${data.expersioned_search_params}»`
          : ""),
    };
  },

  async getRecord(idOrUrl: string): Promise<ScholarRecord> {
    const uuid = extractUuid(idOrUrl);
    const cached = recordCache.get(uuid);
    if (cached) return toRecord(cached);

    // Cold path: search proxy does not support uuid lookup; try keywords=uuid anyway
    const data = await ganjSearch(uuid);
    const match = (data.results ?? []).find(
      (r) => (r.uuid || "").toLowerCase().replace(/-/g, "") === uuid,
    );
    if (match?.uuid) return toRecord(match);

    throw new Error(
      `[irandoc] No cached/search hit for uuid ${uuid}. ` +
        `Call search_sources first in this process, or open ${VIEW_BASE}/${uuid}. ` +
        `Direct ganj.irandoc.ac.ir detail API is unreachable from this environment.`,
    );
  },
};
