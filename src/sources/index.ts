import type { SourceId } from "../types.js";
import type { SourceAdapter } from "./base.js";
import { civilicaAdapter } from "./civilica.js";
import { elmnetAdapter } from "./elmnet.js";
import { ensaniAdapter } from "./ensani.js";
import { irandocAdapter } from "./irandoc.js";
import { nlaiAdapter } from "./nlai.js";
import { noordocAdapter } from "./noordoc.js";
import { noormagsAdapter } from "./noormags.js";
import { sidAdapter } from "./sid.js";

const adapters: Record<SourceId, SourceAdapter> = {
  irandoc: irandocAdapter,
  noormags: noormagsAdapter,
  civilica: civilicaAdapter,
  sid: sidAdapter,
  nlai: nlaiAdapter,
  elmnet: elmnetAdapter,
  ensani: ensaniAdapter,
  noordoc: noordocAdapter,
};

export const SOURCE_IDS = Object.keys(adapters) as SourceId[];

export function getAdapter(id: SourceId): SourceAdapter {
  const adapter = adapters[id];
  if (!adapter) throw new Error(`Unknown source: ${id}`);
  return adapter;
}

export function listAdapters(): SourceAdapter[] {
  return SOURCE_IDS.map((id) => adapters[id]!);
}

export function resolveSources(filter?: SourceId[]): SourceAdapter[] {
  if (!filter?.length) return listAdapters();
  return filter.map(getAdapter);
}
