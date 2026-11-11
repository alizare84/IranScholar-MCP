import * as cheerio from "cheerio";
import {
  absUrl,
  decodeHtmlEntities,
  fetchJson,
  fetchText,
} from "../lib/http.js";
import type { ScholarRecord, SearchHit, SearchResult } from "../types.js";
import type { SourceAdapter } from "./base.js";

const BASE = "https://civilica.com";
/** Irandoc federated proxy — same filter path encoding, often more reachable */
const PROXY_BASE = "https://search.irandoc.ac.ir/api/civilica/search";

interface CivilicaAuthor {
  fname?: string;
  lname?: string;
}

interface CivilicaSource {
  id: number;
  title?: string;
  year?: number | string;
  language?: number;
  page_no?: number;
  LegalPerson?: { name?: string; name_en?: string; issue?: string | null; volume?: string | null };
  Authors?: CivilicaAuthor[];
  pdfFile?: boolean;
}

interface CivilicaHit {
  _source?: CivilicaSource;
}

interface CivilicaInit {
  records?: CivilicaHit[] | null;
  recordCount?: number;
  filters?: Record<string, unknown>;
}

function metaAll($: cheerio.CheerioAPI, name: string): string[] {
  const values: string[] = [];
  $(`meta[name="${name}"], meta[property="${name}"]`).each((_, el) => {
    const content = $(el).attr("content");
    if (content) values.push(decodeHtmlEntities(content.trim()));
  });
  return values;
}

function metaOne($: cheerio.CheerioAPI, name: string): string | undefined {
  return metaAll($, name)[0];
}

function extractId(idOrUrl: string): string {
  const m = idOrUrl.match(/\/doc\/(\d+)/i) || idOrUrl.match(/^(\d+)$/);
  if (!m) {
    throw new Error(
      `Civilica id/url not recognized (expect /doc/{id}/): ${idOrUrl}`,
    );
  }
  return m[1]!;
}

/**
 * Build /search/paper/{filter}/ segment.
 * Civilica SSR treats path keyword literally: spaces must stay spaces
 * (URL-encoded as %20). Underscores become part of the keyword and return 0 hits.
 * Hyphens delimit filter keys (k-, i-, p-), so strip them from the term.
 */
function buildFilterSegment(query: string, page = 1, perPage = 10): string {
  const term = query
    .trim()
    .replaceAll("/", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .trim();
  return `k-${term}-i-${perPage}-p-${page}`;
}

function encodeFilterPath(segment: string): string {
  // Encode the whole segment but keep structural hyphens unescaped for readability;
  // encodeURIComponent already leaves `-` alone and turns spaces into %20.
  return encodeURIComponent(segment);
}

function buildSearchUrl(query: string, page = 1, perPage = 10): string {
  return `${BASE}/search/paper/${encodeFilterPath(buildFilterSegment(query, page, perPage))}/`;
}

function buildProxySearchUrl(query: string, page = 1, perPage = 10): string {
  // Irandoc proxy SPA historically used `_` for spaces; civilica.com needs real spaces.
  // Prefer space encoding on both — proxy accepts the same path shape when reachable.
  return `${PROXY_BASE}/${encodeFilterPath(buildFilterSegment(query, page, perPage))}/`;
}

function parseInitPayload(html: string): CivilicaInit | null {
  const marker = "__INITAL_FROM_SERVER__";
  const idx = html.indexOf(marker);
  if (idx < 0) return null;
  const eq = html.indexOf("=", idx);
  if (eq < 0) return null;
  let i = eq + 1;
  while (i < html.length && /\s/.test(html[i]!)) i++;
  if (html[i] !== "{") return null;
  let depth = 0;
  for (let j = i; j < html.length; j++) {
    const ch = html[j]!;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(i, j + 1)) as CivilicaInit;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function authorName(a: CivilicaAuthor): string {
  return [a.fname, a.lname].filter(Boolean).join(" ").trim();
}

function hitFromSource(src: CivilicaSource): SearchHit | null {
  if (!src?.id || !src.title) return null;
  return {
    source: "civilica",
    id: String(src.id),
    title: src.title,
    authors: (src.Authors ?? []).map(authorName).filter(Boolean),
    year: src.year != null ? String(src.year) : undefined,
    journal: src.LegalPerson?.name,
    url: absUrl(BASE, `/doc/${src.id}/`),
  };
}

export const civilicaAdapter: SourceAdapter = {
  info: {
    id: "civilica",
    nameFa: "سیویلیکا",
    nameEn: "Civilica",
    homepage: BASE,
    kinds: ["conference", "journal"],
    capabilities: ["search", "get_record"],
    status: "live",
    notes:
      "Search via public SSR path `/search/paper/k-{term}-i-{n}-p-{page}/` (window.__INITAL_FROM_SERVER__). get_record via `/doc/{id}/` citation meta.",
  },

  async search(query: string, limit: number): Promise<SearchResult> {
    const perPage = Math.min(Math.max(limit, 1), 20);
    let init: CivilicaInit | null = null;
    let via = "civilica.com SSR";

    try {
      const html = await fetchText(buildSearchUrl(query, 1, perPage), {}, 40_000);
      init = parseInitPayload(html);
    } catch (err) {
      via = `irandoc civilica proxy (direct failed: ${(err as Error).message})`;
      init = await fetchJson<CivilicaInit>(
        buildProxySearchUrl(query, 1, perPage),
        {
          headers: {
            Origin: "https://search.irandoc.ac.ir",
            Referer: "https://search.irandoc.ac.ir/",
          },
        },
        45_000,
      );
    }

    // Proxy may succeed where SSR HTML parse fails
    if ((!init?.records || init.records.length === 0) && via.startsWith("civilica")) {
      try {
        via = "irandoc civilica proxy";
        init = await fetchJson<CivilicaInit>(
          buildProxySearchUrl(query, 1, perPage),
          {
            headers: {
              Origin: "https://search.irandoc.ac.ir",
              Referer: "https://search.irandoc.ac.ir/",
            },
          },
          45_000,
        );
      } catch {
        // keep original init / empty
      }
    }

    const records = init?.records ?? [];
    const hits: SearchHit[] = [];
    for (const row of records) {
      if (hits.length >= limit) break;
      const hit = row._source ? hitFromSource(row._source) : null;
      if (hit) hits.push(hit);
    }

    const filterKeyword = init?.filters?.keyword;
    return {
      source: "civilica",
      status: "live",
      query,
      hits,
      note:
        hits.length === 0
          ? `No hits via ${via} (keyword=${String(filterKeyword ?? "")}).`
          : `via ${via}; recordCount≈${init?.recordCount ?? hits.length}; keyword=${String(filterKeyword ?? "")}.`,
    };
  },

  async getRecord(idOrUrl: string): Promise<ScholarRecord> {
    const id = extractId(idOrUrl);
    const url = `${BASE}/doc/${id}/`;
    const html = await fetchText(url);
    const $ = cheerio.load(html);

    const authors = metaAll($, "citation_author");
    const title =
      metaOne($, "citation_title") ||
      $("h1").first().text().replace(/\s+/g, " ").trim() ||
      metaOne($, "og:title")?.replace(/^مقاله\s*/, "") ||
      `مقاله ${id}`;
    const keywordsRaw =
      metaOne($, "citation_keywords") || metaOne($, "keywords");

    return {
      source: "civilica",
      id,
      title: decodeHtmlEntities(title),
      authors,
      year:
        metaOne($, "citation_year") ||
        metaOne($, "citation_publication_date")?.slice(0, 4),
      date: metaOne($, "citation_publication_date"),
      language: metaOne($, "citation_language") || "fa",
      url: metaOne($, "og:url") || url,
      pdfUrl: metaOne($, "citation_pdf_url"),
      abstract: metaOne($, "description") || metaOne($, "og:description"),
      keywords: keywordsRaw
        ? keywordsRaw
            .split(/[,،]/)
            .map((k) => k.trim())
            .filter(Boolean)
        : undefined,
      journal: undefined,
    };
  },
};
