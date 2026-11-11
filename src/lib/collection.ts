import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CollectionItem, ScholarRecord } from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = path.resolve(__dirname, "../../data/collection.json");

function collectionPath(): string {
  return process.env.IRANSCHOLAR_COLLECTION_PATH?.trim() || DEFAULT_PATH;
}

async function readAll(): Promise<CollectionItem[]> {
  const file = collectionPath();
  try {
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as CollectionItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return [];
    throw err;
  }
}

async function writeAll(items: CollectionItem[]): Promise<void> {
  const file = collectionPath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(items, null, 2), "utf8");
}

export async function saveCollectionItem(
  record: ScholarRecord,
  note?: string,
): Promise<CollectionItem> {
  const items = await readAll();
  const existingIdx = items.findIndex(
    (it) => it.record.source === record.source && it.record.id === record.id,
  );
  const item: CollectionItem = {
    savedAt: new Date().toISOString(),
    note,
    record,
  };
  if (existingIdx >= 0) items[existingIdx] = item;
  else items.push(item);
  await writeAll(items);
  return item;
}

export async function listCollection(): Promise<{
  path: string;
  count: number;
  items: CollectionItem[];
}> {
  const items = await readAll();
  return { path: collectionPath(), count: items.length, items };
}
