/** Shared IranScholar record + source types */

export type SourceId =
  | "irandoc"
  | "noormags"
  | "civilica"
  | "sid"
  | "nlai"
  | "elmnet"
  | "ensani"
  | "noordoc";

export type SourceCapability = "search" | "get_record";

export type SourceStatus = "live" | "partial" | "stubbed";

export interface SourceInfo {
  id: SourceId;
  nameFa: string;
  nameEn: string;
  homepage: string;
  kinds: string[];
  capabilities: SourceCapability[];
  status: SourceStatus;
  notes: string;
}

export interface ScholarRecord {
  source: SourceId;
  id: string;
  title: string;
  titleEn?: string;
  authors: string[];
  year?: string;
  date?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  abstract?: string;
  keywords?: string[];
  language?: string;
  url: string;
  pdfUrl?: string;
  doi?: string;
  extra?: Record<string, string>;
}

export interface SearchHit {
  source: SourceId;
  id: string;
  title: string;
  authors?: string[];
  year?: string;
  journal?: string;
  url: string;
  snippet?: string;
}

export interface SearchResult {
  source: SourceId;
  status: SourceStatus;
  query: string;
  hits: SearchHit[];
  note?: string;
}

export interface CollectionItem {
  savedAt: string;
  note?: string;
  record: ScholarRecord;
}
