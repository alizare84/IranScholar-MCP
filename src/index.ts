#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { exportCitation } from "./lib/citations.js";
import { listCollection, saveCollectionItem } from "./lib/collection.js";
import { SOURCE_IDS, getAdapter, listAdapters, resolveSources } from "./sources/index.js";
import type { ScholarRecord, SourceId } from "./types.js";

const sourceEnum = z.enum([
  "irandoc",
  "noormags",
  "civilica",
  "sid",
  "nlai",
  "elmnet",
  "ensani",
  "noordoc",
]);

function jsonText(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function errorText(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: message }],
  };
}

const server = new McpServer({
  name: "iranscholar-mcp",
  version: "0.1.0",
});

server.registerTool(
  "list_sources",
  {
    title: "List academic sources",
    description:
      "List configured Persian academic sources (Irandoc, Noormags, Civilica, SID, NLAI, Elmnet, Ensani, Noordoc) with live/partial/stubbed status and capabilities.",
  },
  async () => {
    return jsonText({
      sources: listAdapters().map((a) => a.info),
    });
  },
);

server.registerTool(
  "search_sources",
  {
    title: "Search academic sources",
    description:
      "Search one or more Persian academic sources. Optional source filter and limit. Returns per-source hits and honest stub notes.",
    inputSchema: {
      query: z.string().min(1).describe("Search query (Persian or English)"),
      sources: z
        .array(sourceEnum)
        .optional()
        .describe("Optional subset of sources; default = all"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Max hits per source (default 10)"),
    },
  },
  async ({ query, sources, limit }) => {
    try {
      const perSource = Math.min(Math.max(limit ?? 10, 1), 50);
      const adapters = resolveSources(sources as SourceId[] | undefined);
      const results = [];
      for (const adapter of adapters) {
        try {
          results.push(await adapter.search(query, perSource));
        } catch (err) {
          results.push({
            source: adapter.info.id,
            status: adapter.info.status,
            query,
            hits: [],
            note: `Search failed: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }
      return jsonText({ query, limit: perSource, results });
    } catch (err) {
      return errorText(err);
    }
  },
);

server.registerTool(
  "get_record",
  {
    title: "Get full record metadata",
    description:
      "Fetch full metadata for a record by source + id or URL (e.g. Noormags article id, Civilica /doc/{id}/).",
    inputSchema: {
      source: sourceEnum.describe("Source id"),
      id: z
        .string()
        .min(1)
        .describe("Record id or public URL on that source"),
    },
  },
  async ({ source, id }) => {
    try {
      const record = await getAdapter(source as SourceId).getRecord(id);
      return jsonText({ record });
    } catch (err) {
      return errorText(err);
    }
  },
);

server.registerTool(
  "export_citation",
  {
    title: "Export citation",
    description:
      "Format a ScholarRecord (or fetch by source+id) as APA, Vancouver, or BibTeX-ish text suitable for Persian metadata.",
    inputSchema: {
      style: z
        .enum(["apa", "vancouver", "bibtex"])
        .describe("Citation style"),
      source: sourceEnum
        .optional()
        .describe("If set with id, fetch record first"),
      id: z.string().optional().describe("Record id/URL when fetching"),
      record: z
        .record(z.unknown())
        .optional()
        .describe("Inline ScholarRecord object if already available"),
    },
  },
  async ({ style, source, id, record }) => {
    try {
      let resolved: ScholarRecord | undefined;
      if (record && typeof record === "object" && "title" in record) {
        resolved = record as unknown as ScholarRecord;
      } else if (source && id) {
        resolved = await getAdapter(source as SourceId).getRecord(id);
      } else {
        throw new Error("Provide either `record` or both `source` and `id`.");
      }
      const citation = exportCitation(resolved, style);
      return jsonText({ style, citation, record: resolved });
    } catch (err) {
      return errorText(err);
    }
  },
);

server.registerTool(
  "save_collection_item",
  {
    title: "Save to local collection",
    description:
      "Save a record into the local JSON bibliography collection (data/collection.json or IRANSCHOLAR_COLLECTION_PATH).",
    inputSchema: {
      source: sourceEnum.optional(),
      id: z.string().optional(),
      note: z.string().optional(),
      record: z.record(z.unknown()).optional(),
    },
  },
  async ({ source, id, note, record }) => {
    try {
      let resolved: ScholarRecord | undefined;
      if (record && typeof record === "object" && "title" in record) {
        resolved = record as unknown as ScholarRecord;
      } else if (source && id) {
        resolved = await getAdapter(source as SourceId).getRecord(id);
      } else {
        throw new Error("Provide either `record` or both `source` and `id`.");
      }
      const item = await saveCollectionItem(resolved, note);
      return jsonText({ saved: true, item });
    } catch (err) {
      return errorText(err);
    }
  },
);

server.registerTool(
  "list_collection",
  {
    title: "List local collection",
    description: "List items saved in the local thesis bibliography JSON file.",
  },
  async () => {
    try {
      return jsonText(await listCollection());
    } catch (err) {
      return errorText(err);
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr only — stdout is MCP JSON-RPC
  console.error(
    `iranscholar-mcp 0.1.0 ready (sources: ${SOURCE_IDS.join(", ")})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
