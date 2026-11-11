import type { ScholarRecord } from "../types.js";

export type CitationStyle = "apa" | "vancouver" | "bibtex";

function authorListApa(authors: string[]): string {
  if (!authors.length) return "بدون‌نام";
  if (authors.length === 1) return authors[0]!;
  if (authors.length === 2) return `${authors[0]} و ${authors[1]}`;
  return `${authors[0]} و همکاران`;
}

function authorListVancouver(authors: string[]): string {
  if (!authors.length) return "بدون‌نام";
  const sliced = authors.slice(0, 6);
  const body = sliced.join(", ");
  return authors.length > 6 ? `${body}, et al` : body;
}

function bibtexKey(record: ScholarRecord): string {
  const first = (record.authors[0] ?? "anon")
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .slice(0, 24);
  const year = record.year ?? "nd";
  return `${first}${year}${record.id}`.slice(0, 64);
}

function escapeBib(value: string): string {
  return value.replace(/[{}\\]/g, "\\$&");
}

export function exportCitation(
  record: ScholarRecord,
  style: CitationStyle,
): string {
  const year = record.year ?? "بی‌تا";
  const authorsApa = authorListApa(record.authors);
  const title = record.title.trim();
  const journal = record.journal?.trim();

  if (style === "apa") {
    const container = journal ? ` *${journal}*` : "";
    const vol = record.volume ? `، ${record.volume}` : "";
    const issue = record.issue ? `(${record.issue})` : "";
    const pages = record.pages ? `، ${record.pages}` : "";
    return `${authorsApa} (${year}). ${title}.${container}${vol}${issue}${pages}. ${record.url}`;
  }

  if (style === "vancouver") {
    const authors = authorListVancouver(record.authors);
    const container = journal ? ` ${journal}.` : "";
    const vol = record.volume ? ` ${record.volume}` : "";
    const issue = record.issue ? `(${record.issue})` : "";
    const pages = record.pages ? `:${record.pages}` : "";
    return `${authors}. ${title}.${container}${vol}${issue}${pages}. ${year}. Available from: ${record.url}`;
  }

  const fields = [
    `  title = {${escapeBib(title)}}`,
    record.authors.length
      ? `  author = {${escapeBib(record.authors.join(" and "))}}`
      : undefined,
    `  year = {${escapeBib(year)}}`,
    journal ? `  journal = {${escapeBib(journal)}}` : undefined,
    record.volume ? `  volume = {${escapeBib(record.volume)}}` : undefined,
    record.issue ? `  number = {${escapeBib(record.issue)}}` : undefined,
    record.pages ? `  pages = {${escapeBib(record.pages)}}` : undefined,
    `  url = {${escapeBib(record.url)}}`,
    record.doi ? `  doi = {${escapeBib(record.doi)}}` : undefined,
    `  note = {source: ${record.source}}`,
  ].filter(Boolean);

  const entryType = journal ? "article" : "misc";
  return `@${entryType}{${bibtexKey(record)},\n${fields.join(",\n")}\n}`;
}
