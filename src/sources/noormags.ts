import * as cheerio from "cheerio";
import { absUrl, decodeHtmlEntities, fetchText } from "../lib/http.js";
import type { ScholarRecord, SearchHit, SearchResult } from "../types.js";
import type { SourceAdapter } from "./base.js";

const BASE = "https://www.noormags.ir";

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
  const m = idOrUrl.match(/articlepage\/(\d+)/i) || idOrUrl.match(/^(\d+)$/);
  if (!m) {
    throw new Error(`Noormags id/url not recognized: ${idOrUrl}`);
  }
  return m[1]!;
}

export const noormagsAdapter: SourceAdapter = {
  info: {
    id: "noormags",
    nameFa: "نورمگز / مقالات نور",
    nameEn: "Noormags",
    homepage: BASE,
    kinds: ["article"],
    capabilities: ["search", "get_record"],
    status: "live",
    notes:
      "Public HTML search (`/view/fa/search?q=`) and Highwire citation meta on article pages.",
  },

  async search(query: string, limit: number): Promise<SearchResult> {
    const url = `${BASE}/view/fa/search?q=${encodeURIComponent(query)}`;
    const html = await fetchText(url);
    const $ = cheerio.load(html);
    const hits: SearchHit[] = [];
    const seen = new Set<string>();

    $("a[href*='/view/fa/articlepage/']").each((_, el) => {
      if (hits.length >= limit) return false;
      const href = $(el).attr("href") ?? "";
      const idMatch = href.match(/articlepage\/(\d+)/i);
      if (!idMatch) return;
      const id = idMatch[1]!;
      if (seen.has(id)) return;

      let title = decodeHtmlEntities($(el).text().replace(/\s+/g, " ").trim());
      // Skip language switcher labels
      if (!title || /^(العربية|English|فارسی|Türkçe|Русский)$/i.test(title)) {
        const slug = decodeURIComponent(
          (href.match(/articlepage\/\d+\/([^?#]+)/) ?? [])[1] ?? "",
        ).replace(/-/g, " ");
        title = slug || `مقاله ${id}`;
      }
      if (title.length < 3) return;

      seen.add(id);
      hits.push({
        source: "noormags",
        id,
        title,
        url: absUrl(BASE, `/view/fa/articlepage/${id}`),
      });
    });

    return {
      source: "noormags",
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
    const url = `${BASE}/view/fa/articlepage/${id}`;
    const html = await fetchText(url);
    const $ = cheerio.load(html);

    const authors = metaAll($, "citation_author");
    const title =
      metaOne($, "citation_title") ||
      metaOne($, "og:title")?.replace(/-نورمگز\s*$/, "").trim() ||
      $("title").text().trim() ||
      `مقاله ${id}`;
    const first = metaOne($, "citation_firstpage");
    const last = metaOne($, "citation_lastpage");
    const pages =
      first && last ? `${first}-${last}` : first || last || undefined;

    return {
      source: "noormags",
      id,
      title: decodeHtmlEntities(title),
      authors,
      year: (metaOne($, "citation_publication_date") || metaOne($, "citation_date") || "")
        .slice(0, 4) || undefined,
      date: metaOne($, "citation_publication_date") || metaOne($, "citation_date"),
      journal: metaOne($, "citation_journal_title"),
      volume: metaOne($, "citation_volume"),
      issue: metaOne($, "citation_issue"),
      pages,
      language: metaOne($, "citation_language") || "fa",
      url: metaOne($, "citation_html_url") || url,
      pdfUrl: metaOne($, "citation_pdf_url"),
      abstract: metaOne($, "description"),
      extra: {
        shortUrl: metaOne($, "og:url") ?? "",
      },
    };
  },
};
