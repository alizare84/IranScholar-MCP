import * as cheerio from "cheerio";
import { absUrl, decodeHtmlEntities, fetchText } from "../lib/http.js";
import type { ScholarRecord, SearchHit, SearchResult } from "../types.js";
import type { SourceAdapter } from "./base.js";

const BASE = "https://www.ensani.ir";

function extractId(idOrUrl: string): string {
  const m =
    idOrUrl.match(/\/fa\/article\/(\d+)/i) || idOrUrl.match(/^(\d+)$/);
  if (!m) {
    throw new Error(
      `Ensani id/url not recognized (expect /fa/article/{id}): ${idOrUrl}`,
    );
  }
  return m[1]!;
}

function cleanTitle(raw: string): string {
  return decodeHtmlEntities(
    raw
      .replace(/\(مقاله علمی وزارت علوم\)/g, "")
      .replace(/\s*-\s*پرتال جامع علوم انسانی\s*$/u, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function toAsciiDigits(text: string): string {
  return text.replace(/[۰-۹]/g, (d) =>
    String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)),
  );
}

function yearFromText(text: string): string | undefined {
  const m = toAsciiDigits(text).match(/(13|14)\d{2}/);
  return m?.[0];
}

export const ensaniAdapter: SourceAdapter = {
  info: {
    id: "ensani",
    nameFa: "پرتال جامع علوم انسانی",
    nameEn: "Ensani (Comprehensive Humanities Portal)",
    homepage: BASE,
    kinds: ["article"],
    capabilities: ["search", "get_record"],
    status: "live",
    notes:
      "Public HTML search via `/fa/article/search/index?searchType=0&term=` " +
      "(redirects to `ArticleSearch[title]=…`) and article pages `/fa/article/{id}`.",
  },

  async search(query: string, limit: number): Promise<SearchResult> {
    const url =
      `${BASE}/fa/article/search/index?searchType=0&term=` +
      encodeURIComponent(query);
    const html = await fetchText(url, {}, 40_000);
    const $ = cheerio.load(html);
    const hits: SearchHit[] = [];
    const seen = new Set<string>();

    $("article.article-item").each((_, el) => {
      if (hits.length >= limit) return false;
      const $el = $(el);
      const $a = $el.find("h2.heading a[href*='/fa/article/']").first();
      const href = $a.attr("href") ?? "";
      const idMatch = href.match(/\/fa\/article\/(\d+)/i);
      if (!idMatch) return;
      const id = idMatch[1]!;
      if (seen.has(id)) return;
      seen.add(id);

      const title = cleanTitle(
        $a.clone().children("span").remove().end().text() || $a.text(),
      );
      if (!title || title.length < 3) return;

      const authors: string[] = [];
      $el.find(".authors a[rel='author'], .authors a").each((__, a) => {
        const name = decodeHtmlEntities($(a).text().replace(/\s+/g, " ").trim());
        if (name) authors.push(name);
      });
      const journal = decodeHtmlEntities(
        $el.find(".journal .journal-title, .journal a").first().text().replace(/\s+/g, " ").trim(),
      );
      const pages = decodeHtmlEntities(
        $el.find(".page-number").first().text().replace(/\s+/g, " ").trim(),
      );

      hits.push({
        source: "ensani",
        id,
        title,
        authors: authors.length ? authors : undefined,
        year: yearFromText(journal),
        journal: journal || undefined,
        url: absUrl(BASE, `/fa/article/${id}`),
        snippet: pages || undefined,
      });
    });

    // Fallback: any article links if list markup changes
    if (hits.length === 0) {
      $("a[href*='/fa/article/']").each((_, el) => {
        if (hits.length >= limit) return false;
        const href = $(el).attr("href") ?? "";
        const idMatch = href.match(/\/fa\/article\/(\d+)/i);
        if (!idMatch) return;
        const id = idMatch[1]!;
        if (seen.has(id)) return;
        const title = cleanTitle($(el).text());
        if (!title || title.length < 8) return;
        if (/^(نویسندگان|منبع|حوزه)/.test(title)) return;
        seen.add(id);
        hits.push({
          source: "ensani",
          id,
          title,
          url: absUrl(BASE, `/fa/article/${id}`),
        });
      });
    }

    return {
      source: "ensani",
      status: "live",
      query,
      hits,
      note:
        hits.length === 0
          ? "No public hits parsed; try a different Persian query."
          : undefined,
    };
  },

  async getRecord(idOrUrl: string): Promise<ScholarRecord> {
    const id = extractId(idOrUrl);
    const url = `${BASE}/fa/article/${id}`;
    const html = await fetchText(url, {}, 40_000);
    const $ = cheerio.load(html);

    const authors: string[] = [];
    const authorSel = $(".authors a[href*='/fa/article/author/']");
    const authorNodes =
      authorSel.length > 0 ? authorSel : $("a[href*='/fa/article/author/']");
    authorNodes.each((_, el) => {
      const name = decodeHtmlEntities($(el).text().replace(/\s+/g, " ").trim());
      if (name && !authors.includes(name)) authors.push(name);
    });

    const title =
      cleanTitle($("h1").first().text()) ||
      cleanTitle($('meta[property="og:title"]').attr("content") || "") ||
      cleanTitle($("title").text()) ||
      `مقاله ${id}`;

    const journal = decodeHtmlEntities(
      $(".journal a").first().text().replace(/\s+/g, " ").trim() ||
        $("b:contains('منبع')")
          .parent()
          .find("a")
          .first()
          .text()
          .replace(/\s+/g, " ")
          .trim(),
    );

    let abstract: string | undefined;
    $("h3").each((_, el) => {
      if (abstract) return;
      if (/چکیده/.test($(el).text())) {
        const block = $(el).parent().text().replace(/\s+/g, " ").trim();
        abstract = decodeHtmlEntities(
          block.replace(/^[\s\S]*?چکیده\s*/u, "").trim(),
        );
      }
    });

    const keywords: string[] = [];
    $("a.tag, .tags a.tag").each((_, el) => {
      const k = decodeHtmlEntities($(el).text().replace(/\s+/g, " ").trim());
      if (k) keywords.push(k);
    });
    if (keywords.length === 0) {
      const metaKw = $('meta[name="keywords"]').attr("content");
      if (metaKw) {
        for (const k of metaKw.split(/[,،]/)) {
          const t = k.trim();
          if (t) keywords.push(decodeHtmlEntities(t));
        }
      }
    }

    const pages = decodeHtmlEntities(
      $(".pageNumber")
        .text()
        .replace(/شماره صفحات:\s*/u, "")
        .replace(/\s+/g, " ")
        .trim() ||
        $("b:contains('شماره صفحات')")
          .parent()
          .text()
          .replace(/شماره صفحات:\s*/u, "")
          .replace(/\s+/g, " ")
          .trim(),
    );

    return {
      source: "ensani",
      id,
      title,
      authors,
      year: yearFromText(journal),
      journal: journal || undefined,
      pages: pages || undefined,
      abstract: abstract || undefined,
      keywords: keywords.length ? keywords : undefined,
      language: "fa",
      url,
      pdfUrl: absUrl(BASE, `/fa/article/download/${id}`),
    };
  },
};
