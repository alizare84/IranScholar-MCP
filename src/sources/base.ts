import type {
  ScholarRecord,
  SearchResult,
  SourceId,
  SourceInfo,
} from "../types.js";

export interface SourceAdapter {
  info: SourceInfo;
  search(query: string, limit: number): Promise<SearchResult>;
  getRecord(idOrUrl: string): Promise<ScholarRecord>;
}

export function stubSearch(
  source: SourceId,
  query: string,
  note: string,
): SearchResult {
  return {
    source,
    status: "stubbed",
    query,
    hits: [],
    note,
  };
}

export function notImplementedRecord(
  source: SourceId,
  idOrUrl: string,
  reason: string,
): never {
  throw new Error(
    `[${source}] get_record not available yet for "${idOrUrl}": ${reason}`,
  );
}
