import * as cheerio from "cheerio";
import {
  isWaitingRoomHtml,
  unreachableNote,
  waitingRoomNote,
} from "../lib/access.js";
import { absUrl, decodeHtmlEntities, fetchText } from "../lib/http.js";
import type { ScholarRecord, SearchHit, SearchResult } from "../types.js";
import type { SourceAdapter } from "./base.js";

const OPAC = "https://opac.nlai.ir";
const DL = "https://dl.nlai.ir";

const NOTE =
  "OPAC HTML search `opac.nlai.ir/opac-prod/search/bibliographicSearch.do` " +
  "(classType=0 books) + bibliographic detail pages. Often TLS-hangs from foreign " +
  "cloud; typically reachable on Iran networks. Status partial. " +
  "Optional HTTPS_PROXY / IRANSCHOLAR_COOKIE. No auth bypass.";

function clean(text: string): string {
  return decodeHtmlEntities(text.replace(/\s+/g, " ").trim());
}

function extractId(idOrUrl: string): string {
  const m =
    idOrUrl.match(/bibliographic\/(\d+)/i) ||
    idOrUrl.match(/[?&](?:id|bibliographicId|Id)=(\d+)/i) ||
    idOrUrl.match(/showBibliographic(?:Brief|Detail)\.do[^"' ]*?[?&]id=(\d+)/i) ||
    idOrUrl.match(/^(\d+)$/);
  if (!m) {
    throw new Error(
      `NLAI id/url not recognized (expect OPAC bibliographic id): ${idOrUrl}`,
    );
  }
  return m[1]!;
}

function searchUrl(query: string): string {
  const params = new URLSearchParams({
    command: "NEW_SEARCH",
    searchType: "0",
    "simpleSearch.valueField": "0",
    "simpleSearch.value": query,
    classType: "0",
    pageStatus: "0",
  });
  return `${OPAC}/opac-prod/search/bibliographicSearch.do?${params}`;
}

function detailUrl(id: string): string {
  return `${OPAC}/opac-prod/bibliographic/${id}`;
}

export const nlaiAdapter: SourceAdapter = {
  info: {
    id: "nlai",
    nameFa: "کتابخانه ملی ایران",
    nameEn: "National Library of Iran",
    homepage: "https://www.nlai.ir/",
    kinds: ["book", "catalog"],
    capabilities: ["search", "get_record"],
    status: "partial",
    notes: NOTE,
  },

  async search(query: string, limit: number): Promise<SearchResult> {
    const url = searchUrl(query);
    let html: string;
    try {
      html = await fetchText(url, {}, 45_000, 1);
    } catch (err) {
      // Secondary try: digital library landing (still catalogs Iran access)
      try {
        const dlHtml = await fetchText(
          `${DL}/UI/Search/BasicSearch.aspx?Index=home`,
          {},
          30_000,
          0,
        );
        if (isWaitingRoomHtml(dlHtml)) {
          return {
            source: "nlai",
            status: "partial",
            query,
            hits: [],
            note: waitingRoomNote("nlai", "dl.nlai.ir"),
          };
        }
      } catch {
        /* keep primary error */
      }
      return {
        source: "nlai",
        status: "partial",
        query,
        hits: [],
        note: unreachableNote("nlai", err),
      };
    }

    if (isWaitingRoomHtml(html)) {
      return {
        source: "nlai",
        status: "partial",
        query,
        hits: [],
        note: waitingRoomNote("nlai", "opac.nlai.ir"),
      };
    }

    const $ = cheerio.load(html);
    const hits: SearchHit[] = [];
    const seen = new Set<string>();

    $(
      'a[href*="bibliographic"], a[href*="showBibliographic"], a[href*="Bibliographic"]',
    ).each((_, el) => {
      if (hits.length >= limit) return false;
      const href = $(el).attr("href") ?? "";
      let id: string | undefined;
      try {
        id = extractId(href);
      } catch {
        return;
      }
      if (seen.has(id)) return;
      const title = clean($(el).text());
      if (!title || title.length < 3) return;
      if (/^(جزئیات|detail|more|بیشتر)$/i.test(title)) return;
      seen.add(id);
      hits.push({
        source: "nlai",
        id,
        title,
        url: absUrl(OPAC, href.includes("http") ? href : detailUrl(id)),
      });
    });

    // Fallback: table rows with title in first columns
    if (hits.length === 0) {
      $("table tr").each((_, tr) => {
        if (hits.length >= limit) return false;
        const $tr = $(tr);
        const $a = $tr.find("a[href]").first();
        const href = $a.attr("href") ?? "";
        if (!/bibliographic|showBibliographic/i.test(href)) return;
        let id: string | undefined;
        try {
          id = extractId(href);
        } catch {
          return;
        }
        if (seen.has(id)) return;
        const title = clean($a.text() || $tr.text());
        if (!title || title.length < 3) return;
        seen.add(id);
        hits.push({
          source: "nlai",
          id,
          title,
          url: absUrl(OPAC, href),
        });
      });
    }

    return {
      source: "nlai",
      status: "partial",
      query,
      hits,
      note:
        hits.length === 0
          ? "OPAC reachable but no bibliographic hits parsed; try another query."
          : undefined,
    };
  },

  async getRecord(idOrUrl: string): Promise<ScholarRecord> {
    const id = extractId(idOrUrl);
    const candidates = [
      detailUrl(id),
      `${OPAC}/opac-prod/search/showBibliographicDetail.do?id=${id}`,
      `${OPAC}/opac-prod/search/showBibliographicBrief.do?id=${id}`,
    ];

    let lastErr: unknown;
    for (const url of candidates) {
      try {
        const html = await fetchText(url, {}, 45_000, 1);
        if (isWaitingRoomHtml(html)) {
          throw new Error(waitingRoomNote("nlai", "opac.nlai.ir"));
        }
        const $ = cheerio.load(html);
        const title =
          clean($("h1, h2, .title, #title").first().text()) ||
          clean($("title").text()) ||
          `رکورد ${id}`;

        const authors: string[] = [];
        $("td, th, dt, dd, span, li").each((_, el) => {
          const t = clean($(el).text());
          if (/^(پدیدآور|مؤلف|نویسنده)/.test(t)) {
            const v = clean(
              $(el).next().text() ||
                $(el).parent().find("td, dd").last().text(),
            );
            if (v && v !== t) {
              for (const part of v.split(/[؛;،]/)) {
                const name = part.trim();
                if (name.length > 1) authors.push(name);
              }
            }
          }
        });

        const body = clean($("body").text());
        const year = body.match(/\b((?:13|14)\d{2}|20\d{2})\b/)?.[1];
        const publisher = body.match(
          /(?:ناشر|مشخصات نشر)\s*[:：]?\s*([^\n]{3,80})/,
        )?.[1];

        return {
          source: "nlai",
          id,
          title: title.replace(/\s*[-|]\s*کتابخانه ملی.*$/u, "").trim(),
          authors,
          year,
          journal: publisher ? clean(publisher) : undefined,
          language: "fa",
          url,
          extra: { catalog: "opac.nlai.ir" },
        };
      } catch (err) {
        lastErr = err;
      }
    }
    throw new Error(
      lastErr instanceof Error
        ? lastErr.message
        : unreachableNote("nlai", lastErr),
    );
  },
};
