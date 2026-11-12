import * as cheerio from "cheerio";
import {
  isWaitingRoomHtml,
  unreachableNote,
  waitingRoomNote,
} from "../lib/access.js";
import { absUrl, decodeHtmlEntities, fetchText } from "../lib/http.js";
import type { ScholarRecord, SearchHit, SearchResult } from "../types.js";
import type { SourceAdapter } from "./base.js";

const BASE = "https://elmnet.ir";

const NOTE =
  "Public HTML search `/search?q=` + document pages `/doc/{id}` " +
  "(id shape like `1576356-91912`). Live from Iran egress; ArvanCloud Waiting Room " +
  "blocks many cloud IPs — then returns partial + empty hits. " +
  "Optional IRANSCHOLAR_COOKIE (elmnet.ir hosts only) / HTTPS_PROXY with " +
  "NODE_USE_ENV_PROXY=1. No challenge bypass.";

function extractId(idOrUrl: string): string {
  const m =
    idOrUrl.match(/\/doc\/([0-9]+-[0-9]+)/i) ||
    idOrUrl.match(/^([0-9]+-[0-9]+)$/) ||
    idOrUrl.match(/\/doc\/([0-9]+)/i) ||
    idOrUrl.match(/^([0-9]+)$/);
  if (!m) {
    throw new Error(
      `Elmnet id/url not recognized (expect /doc/{id}): ${idOrUrl}`,
    );
  }
  return m[1]!;
}

function clean(text: string): string {
  return decodeHtmlEntities(text.replace(/\s+/g, " ").trim());
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

/** Pull «نویسندگان: …» style fields from Elmnet doc body text. */
function fieldAfterLabel(body: string, label: RegExp): string | undefined {
  const m = body.match(label);
  if (!m?.[1]) return undefined;
  return clean(m[1]);
}

export const elmnetAdapter: SourceAdapter = {
  info: {
    id: "elmnet",
    nameFa: "علم‌نت",
    nameEn: "Elmnet",
    homepage: BASE,
    kinds: ["article", "thesis", "conference"],
    capabilities: ["search", "get_record"],
    status: "partial",
    notes: NOTE,
  },

  async search(query: string, limit: number): Promise<SearchResult> {
    const url = `${BASE}/search?q=${encodeURIComponent(query)}`;
    let html: string;
    try {
      html = await fetchText(url, {}, 40_000);
    } catch (err) {
      return {
        source: "elmnet",
        status: "partial",
        query,
        hits: [],
        note: unreachableNote("elmnet", err),
      };
    }
    if (isWaitingRoomHtml(html)) {
      return {
        source: "elmnet",
        status: "partial",
        query,
        hits: [],
        note: waitingRoomNote("elmnet", "elmnet.ir"),
      };
    }

    const $ = cheerio.load(html);
    const hits: SearchHit[] = [];
    const seen = new Set<string>();

    $('a[href*="/doc/"]').each((_, el) => {
      if (hits.length >= limit) return false;
      const href = $(el).attr("href") ?? "";
      const idMatch =
        href.match(/\/doc\/([0-9]+-[0-9]+)/i) || href.match(/\/doc\/([0-9]+)/i);
      if (!idMatch) return;
      const id = idMatch[1]!;
      if (seen.has(id)) return;

      let title = clean($(el).text());
      if (!title || title.length < 6) {
        title = clean($(el).closest("article, li, div").find("h2, h3, a").first().text());
      }
      if (!title || title.length < 6) return;
      if (/^(علم نت|elmnet|خانه|جستجو)$/i.test(title)) return;

      seen.add(id);
      const card = clean($(el).closest("article, li, div").text());
      const authorsRaw = fieldAfterLabel(
        card,
        /نویسندگان?\s*[:：]?\s*([^\n]+?)(?:\s*نشریه|\s*چکیده|$)/,
      );
      const year = card.match(/\b((?:13|14)\d{2}|20\d{2})\b/)?.[1];
      hits.push({
        source: "elmnet",
        id,
        title: title.replace(/^مقاله\s+(نشریه|کنفرانس)\s*/u, "").trim() || title,
        authors: authorsRaw
          ? authorsRaw
              .split(/[،,;؛]/)
              .map((s) => s.trim())
              .filter((s) => s.length > 1)
          : undefined,
        year,
        url: absUrl(BASE, `/doc/${id}`),
      });
    });

    return {
      source: "elmnet",
      status: "partial",
      query,
      hits,
      note:
        hits.length === 0
          ? "No Elmnet hits parsed (page reachable). Try another query."
          : undefined,
    };
  },

  async getRecord(idOrUrl: string): Promise<ScholarRecord> {
    const id = extractId(idOrUrl);
    const url = `${BASE}/doc/${id}`;
    let html: string;
    try {
      html = await fetchText(url, {}, 40_000);
    } catch (err) {
      throw new Error(unreachableNote("elmnet", err));
    }
    if (isWaitingRoomHtml(html)) {
      throw new Error(waitingRoomNote("elmnet", "elmnet.ir"));
    }
    const $ = cheerio.load(html);
    const body = clean($("body").text());

    const title =
      metaOne($, "citation_title") ||
      metaOne($, "og:title") ||
      clean($("h1").first().text()) ||
      clean($("title").text()) ||
      `سند ${id}`;

    let authors = metaAll($, "citation_author");
    if (!authors.length) {
      const raw =
        fieldAfterLabel(
          body,
          /نویسندگان?\s*[:：]?\s*([^\n]+?)(?:\s*نشریه|\s*چکیده|\s*کلید|$)/,
        ) || "";
      authors = raw
        .split(/[،,;؛]/)
        .map((s) => s.replace(/\*$/, "").trim())
        .filter((s) => s.length > 1);
    }

    const journal =
      metaOne($, "citation_journal_title") ||
      fieldAfterLabel(body, /نشریه\s*[:：]?\s*([^\n]+?)(?:\s*چکیده|\s*نویسندگان|$)/);

    const year =
      metaOne($, "citation_publication_date")?.match(/\d{4}/)?.[0] ||
      metaOne($, "citation_year") ||
      body.match(/\b((?:13|14)\d{2}|20\d{2})\b/)?.[1];

    const abstract =
      metaOne($, "citation_abstract") ||
      fieldAfterLabel(body, /چکیده\s*[:：]?\s*([\s\S]+?)(?:\s*کلیدواژگان|\s*نویسندگان|$)/);

    return {
      source: "elmnet",
      id,
      title: clean(title)
        .replace(/^مقاله\s+(نشریه|کنفرانس)\s*/u, "")
        .replace(/\s*[-|]\s*علم[\u200c\s]*نت\s*$/u, ""),
      authors,
      year,
      journal: journal ? clean(journal) : undefined,
      abstract: abstract ? clean(abstract).slice(0, 2000) : undefined,
      language: "fa",
      url,
    };
  },
};
