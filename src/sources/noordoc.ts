import { absUrl, fetchJson } from "../lib/http.js";
import type { ScholarRecord, SearchHit, SearchResult } from "../types.js";
import type { SourceAdapter } from "./base.js";

const BASE = "https://noordoc.ir";
const SEARCH_API = `${BASE}/_search/api/v1.0/SearchThesis`;
const THESIS_API = `${BASE}/_content/api/v1/thesis`;
const PERSON_API = `${BASE}/_content/api/v1/person`;

interface NoordocTitle {
  title?: string;
  language?: string;
}

interface NoordocPerson {
  id?: number;
  fullName?: string;
  role?: { title?: string };
}

interface NoordocThesis {
  id?: number;
  titles?: NoordocTitle[];
  students?: NoordocPerson[];
  teachers?: NoordocPerson[];
  organization?: { title?: string };
  college?: { title?: string };
  field?: { title?: string };
  educationLevel?: { title?: string };
  defianceDate?: { year?: number; original?: string };
  keywords?: Array<{ title?: string } | string>;
  abstracts?: Array<{ text?: string; language?: string }>;
  hasPdf?: boolean;
  pdfFile?: string | null;
  pageCount?: number;
}

interface NoordocSearchResponse {
  data?: { resultList?: NoordocThesis[] };
  totalCount?: number;
}

interface NoordocContentResponse {
  data?: NoordocThesis & {
    fullName?: string;
    writtenThesisCount?: number;
    guidedThesisCount?: number;
    organizations?: Array<{ title?: string; thesisCount?: number }>;
  };
  statusCode?: number;
}

function faTitle(titles?: NoordocTitle[]): string | undefined {
  if (!titles?.length) return undefined;
  const fa = titles.find((t) => t.language === "fa" && t.title);
  return (fa ?? titles[0])?.title;
}

function enTitle(titles?: NoordocTitle[]): string | undefined {
  return titles?.find((t) => t.language === "en" && t.title)?.title;
}

function authorsFrom(thesis: NoordocThesis): string[] {
  const names = (thesis.students ?? [])
    .map((s) => s.fullName?.trim())
    .filter((n): n is string => Boolean(n));
  return names;
}

function extractThesisId(idOrUrl: string): string | null {
  const m =
    idOrUrl.match(/\/thesis\/(\d+)/i) ||
    idOrUrl.match(/^thesis[:/]?(\d+)$/i);
  if (m) return m[1]!;
  if (/^\d+$/.test(idOrUrl.trim())) return idOrUrl.trim();
  return null;
}

function extractAuthorId(idOrUrl: string): string | null {
  const m =
    idOrUrl.match(/\/author\/(\d+)/i) ||
    idOrUrl.match(/^author[:/]?(\d+)$/i);
  return m ? m[1]! : null;
}

function keywordList(thesis: NoordocThesis): string[] | undefined {
  const raw = thesis.keywords ?? [];
  const out = raw
    .map((k) => (typeof k === "string" ? k : k.title ?? ""))
    .map((k) => k.trim())
    .filter(Boolean);
  return out.length ? out : undefined;
}

function abstractText(thesis: NoordocThesis): string | undefined {
  const abs = thesis.abstracts ?? [];
  const fa = abs.find((a) => a.language === "fa" && a.text);
  const pick = fa ?? abs.find((a) => a.text);
  return pick?.text?.trim() || undefined;
}

function thesisToHit(thesis: NoordocThesis): SearchHit | null {
  if (!thesis?.id) return null;
  const title = faTitle(thesis.titles);
  if (!title) return null;
  const year =
    thesis.defianceDate?.year != null
      ? String(thesis.defianceDate.year)
      : thesis.defianceDate?.original;
  return {
    source: "noordoc",
    id: String(thesis.id),
    title,
    authors: authorsFrom(thesis),
    year: year || undefined,
    journal: thesis.organization?.title,
    url: absUrl(BASE, `/thesis/${thesis.id}`),
    snippet: [thesis.educationLevel?.title, thesis.field?.title]
      .filter(Boolean)
      .join(" · "),
  };
}

function thesisToRecord(thesis: NoordocThesis): ScholarRecord {
  const id = String(thesis.id);
  const title = faTitle(thesis.titles) || `پایان‌نامه ${id}`;
  const year =
    thesis.defianceDate?.year != null
      ? String(thesis.defianceDate.year)
      : thesis.defianceDate?.original;
  const advisors = (thesis.teachers ?? [])
    .map((t) => {
      const name = t.fullName?.trim();
      if (!name || name === "- -") return "";
      const role = t.role?.title ? ` (${t.role.title})` : "";
      return `${name}${role}`;
    })
    .filter(Boolean);

  return {
    source: "noordoc",
    id,
    title,
    titleEn: enTitle(thesis.titles),
    authors: authorsFrom(thesis),
    year: year || undefined,
    journal: thesis.organization?.title,
    abstract: abstractText(thesis),
    keywords: keywordList(thesis),
    language: "fa",
    url: absUrl(BASE, `/thesis/${id}`),
    pdfUrl: thesis.pdfFile
      ? absUrl(BASE, thesis.pdfFile)
      : undefined,
    pages: thesis.pageCount != null ? String(thesis.pageCount) : undefined,
    extra: {
      educationLevel: thesis.educationLevel?.title ?? "",
      college: thesis.college?.title ?? "",
      field: thesis.field?.title ?? "",
      advisors: advisors.join("؛ "),
    },
  };
}

export const noordocAdapter: SourceAdapter = {
  info: {
    id: "noordoc",
    nameFa: "نوردوک / سامانه پایان‌نامه‌ها",
    nameEn: "Noordoc (Noor theses)",
    homepage: BASE,
    kinds: ["thesis"],
    capabilities: ["search", "get_record"],
    status: "live",
    notes:
      "Search via public JSON `POST /_search/api/v1.0/SearchThesis` (`text` + pageSize). " +
      "get_record via `/_content/api/v1/thesis/{id}` or person `/_content/api/v1/person/{id}` " +
      "(also accepts `/thesis/{id}` and `/author/{id}` URLs). No PDF paywall bypass.",
  },

  async search(query: string, limit: number): Promise<SearchResult> {
    const pageSize = Math.min(Math.max(limit, 1), 20);
    const body = {
      text: query.trim(),
      pageNumber: 1,
      pageSize,
      searchType: "exact",
      fromTitle: true,
    };
    const res = await fetchJson<NoordocSearchResponse>(
      SEARCH_API,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      45_000,
    );

    const hits: SearchHit[] = [];
    for (const row of res.data?.resultList ?? []) {
      if (hits.length >= limit) break;
      const hit = thesisToHit(row);
      if (hit) hits.push(hit);
    }

    return {
      source: "noordoc",
      status: "live",
      query,
      hits,
      note:
        hits.length === 0
          ? "No hits from SearchThesis API."
          : `via SearchThesis; totalCount≈${res.totalCount ?? hits.length}.`,
    };
  },

  async getRecord(idOrUrl: string): Promise<ScholarRecord> {
    const authorId = extractAuthorId(idOrUrl);
    if (authorId && !/\/thesis\//i.test(idOrUrl)) {
      // Bare numeric ids are treated as thesis ids (search hits use those).
      // Only `/author/{id}` or `author:{id}` resolve as persons.
      if (/author/i.test(idOrUrl)) {
        const res = await fetchJson<NoordocContentResponse>(
          `${PERSON_API}/${authorId}`,
          {},
          40_000,
        );
        const person = res.data;
        if (!person?.fullName && !person?.id) {
          throw new Error(
            `[noordoc] author ${authorId} not found (status=${res.statusCode})`,
          );
        }
        const orgs = (person.organizations ?? [])
          .map((o) => o.title)
          .filter(Boolean)
          .join("؛ ");
        return {
          source: "noordoc",
          id: `author:${authorId}`,
          title: person.fullName || `پدیدآور ${authorId}`,
          authors: [person.fullName || ""].filter(Boolean),
          journal: orgs || undefined,
          language: "fa",
          url: absUrl(BASE, `/author/${authorId}`),
          extra: {
            kind: "author",
            writtenThesisCount: String(person.writtenThesisCount ?? ""),
            guidedThesisCount: String(person.guidedThesisCount ?? ""),
            organizations: orgs,
          },
        };
      }
    }

    const thesisId = extractThesisId(idOrUrl);
    if (!thesisId) {
      throw new Error(
        `Noordoc id/url not recognized (expect /thesis/{id} or /author/{id}): ${idOrUrl}`,
      );
    }

    const res = await fetchJson<NoordocContentResponse>(
      `${THESIS_API}/${thesisId}`,
      {},
      40_000,
    );
    if (!res.data?.id) {
      throw new Error(
        `[noordoc] thesis ${thesisId} not found (status=${res.statusCode})`,
      );
    }
    return thesisToRecord(res.data);
  },
};
