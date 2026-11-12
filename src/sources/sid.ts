import * as cheerio from "cheerio";
import {
  isWaitingRoomHtml,
  unreachableNote,
  waitingRoomNote,
} from "../lib/access.js";
import { absUrl, decodeHtmlEntities, fetchText } from "../lib/http.js";
import type { ScholarRecord, SearchHit, SearchResult } from "../types.js";
import type { SourceAdapter } from "./base.js";

const BASE = "https://www.sid.ir";

const NOTE =
  "Public HTML search `/search/paper/{q}/fa` + paper pages `/paper/{id}/fa` " +
  "(citation meta when present). Live from Iran egress; many foreign cloud IPs " +
  "hit Cloudflare/ArvanCloud Waiting Room — then returns partial + empty hits. " +
  "Optional IRANSCHOLAR_COOKIE (sid.ir hosts only) / HTTPS_PROXY with " +
  "NODE_USE_ENV_PROXY=1. No challenge bypass.";

function extractId(idOrUrl: string): string {
  const m =
    idOrUrl.match(/\/paper\/(\d+)(?:\/|$)/i) || idOrUrl.match(/^(\d+)$/);
  if (!m) {
    throw new Error(
      `SID id/url not recognized (expect /paper/{id}/fa): ${idOrUrl}`,
    );
  }
  return m[1]!;
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

function clean(text: string): string {
  return decodeHtmlEntities(text.replace(/\s+/g, " ").trim());
}

function labelValue($: cheerio.CheerioAPI, label: RegExp): string | undefined {
  let found: string | undefined;
  $("dt, th, span, strong, b, div, li, p").each((_, el) => {
    if (found) return;
    const t = clean($(el).text());
    if (!label.test(t)) return;
    const sibling = clean(
      $(el).next().text() ||
        $(el).parent().find("dd, td").first().text() ||
        "",
    );
    if (sibling && sibling.length > 1 && sibling !== t) {
      found = sibling.replace(label, "").replace(/^[:：\s]+/, "").trim();
    }
  });
  return found || undefined;
}

export const sidAdapter: SourceAdapter = {
  info: {
    id: "sid",
    nameFa: "جهاد دانشگاهی (SID)",
    nameEn: "Scientific Information Database (SID)",
    homepage: BASE,
    kinds: ["article"],
    capabilities: ["search", "get_record"],
    status: "partial",
    notes: NOTE,
  },

  async search(query: string, limit: number): Promise<SearchResult> {
    const qPath = encodeURIComponent(query).replace(/%20/g, "%20");
    const url =
      `${BASE}/search/paper/${qPath}/fa` +
      `?page=1&sort=1&ftyp=all&fgrp=all&fyrs=all&str=${encodeURIComponent(query)}`;
    let html: string;
    try {
      html = await fetchText(url, {}, 40_000);
    } catch (err) {
      return {
        source: "sid",
        status: "partial",
        query,
        hits: [],
        note: unreachableNote("sid", err),
      };
    }
    if (isWaitingRoomHtml(html)) {
      return {
        source: "sid",
        status: "partial",
        query,
        hits: [],
        note: waitingRoomNote("sid", "sid.ir"),
      };
    }

    const $ = cheerio.load(html);
    const hits: SearchHit[] = [];
    const seen = new Set<string>();

    $('a[href*="/paper/"]').each((_, el) => {
      if (hits.length >= limit) return false;
      const href = $(el).attr("href") ?? "";
      const idMatch = href.match(/\/paper\/(\d+)/i);
      if (!idMatch) return;
      const id = idMatch[1]!;
      if (seen.has(id)) return;

      let title = clean($(el).text());
      // Prefer nearby titled anchors; skip tiny nav crumbs
      if (!title || title.length < 8) {
        const parentText = clean($(el).closest("article, li, div, tr").find("a").first().text());
        title = parentText.length >= 8 ? parentText : "";
      }
      if (!title || title.length < 8) return;
      if (/^(دانلود|نسخه|English|فارسی|en|fa)$/i.test(title)) return;

      seen.add(id);
      hits.push({
        source: "sid",
        id,
        title,
        url: absUrl(BASE, `/paper/${id}/fa`),
      });
    });

    // Enrich from card text when structure exposes نویسندگان / نشریه near link
    for (const hit of hits) {
      const $a = $(`a[href*="/paper/${hit.id}"]`).first();
      const card = $a.closest("article, li, .card, .result, div");
      const cardText = clean(card.text());
      const authorsMatch = cardText.match(
        /نویسندگان?\s*[:：]?\s*([^\n|]+?)(?:\s*نشریه|\s*عنوان|$)/,
      );
      if (authorsMatch?.[1]) {
        hit.authors = authorsMatch[1]
          .split(/[|;،]/)
          .map((s) => s.trim())
          .filter((s) => s.length > 1);
      }
      const yearMatch = cardText.match(/\b((?:13|14)\d{2}|20\d{2})\b/);
      if (yearMatch) hit.year = yearMatch[1];
    }

    return {
      source: "sid",
      status: "partial",
      query,
      hits,
      note:
        hits.length === 0
          ? "No SID hits parsed (page reachable). Try another query."
          : undefined,
    };
  },

  async getRecord(idOrUrl: string): Promise<ScholarRecord> {
    const id = extractId(idOrUrl);
    const url = `${BASE}/paper/${id}/fa`;
    let html: string;
    try {
      html = await fetchText(url, {}, 40_000);
    } catch (err) {
      throw new Error(unreachableNote("sid", err));
    }
    if (isWaitingRoomHtml(html)) {
      throw new Error(waitingRoomNote("sid", "sid.ir"));
    }
    const $ = cheerio.load(html);

    const authors = metaAll($, "citation_author");
    const title =
      metaOne($, "citation_title") ||
      metaOne($, "og:title") ||
      clean($("h1").first().text()) ||
      clean($("title").text()) ||
      `مقاله ${id}`;

    const journal =
      metaOne($, "citation_journal_title") ||
      labelValue($, /^نشریه/) ||
      undefined;
    const year =
      metaOne($, "citation_publication_date")?.match(/\d{4}/)?.[0] ||
      metaOne($, "citation_year") ||
      labelValue($, /^سال/) ||
      undefined;
    const volume = metaOne($, "citation_volume");
    const issue = metaOne($, "citation_issue");
    const first = metaOne($, "citation_firstpage");
    const last = metaOne($, "citation_lastpage");
    const pages =
      first && last ? `${first}-${last}` : first || last || undefined;
    const doi = metaOne($, "citation_doi");
    const abstract =
      metaOne($, "citation_abstract") ||
      clean($(".abstract, #abstract, [itemprop='abstract']").first().text()) ||
      undefined;

    let resolvedAuthors = authors;
    if (!resolvedAuthors.length) {
      const raw =
        labelValue($, /^نویسندگان?/) ||
        clean($("[itemprop='author']").text());
      if (raw) {
        resolvedAuthors = raw
          .split(/[|;،|]/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }

    return {
      source: "sid",
      id,
      title: clean(title).replace(/\s*[-|]\s*SID\.ir\s*$/i, ""),
      authors: resolvedAuthors,
      year,
      journal,
      volume,
      issue,
      pages,
      abstract: abstract || undefined,
      language: "fa",
      url,
      doi,
      pdfUrl: metaOne($, "citation_pdf_url"),
    };
  },
};
