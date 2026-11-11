/**
 * Smoke test (not MCP transport): list_sources + live searches + get_record.
 * Run: npm run smoke
 */
import { exportCitation } from "../src/lib/citations.js";
import { listCollection, saveCollectionItem } from "../src/lib/collection.js";
import { getAdapter, listAdapters } from "../src/sources/index.js";

async function main() {
  console.log("=== list_sources ===");
  for (const a of listAdapters()) {
    console.log(
      `- ${a.info.id}: ${a.info.status} — ${a.info.nameFa} (${a.info.capabilities.join(", ")})`,
    );
  }

  console.log("\n=== search noormags: علم داده ===");
  const noorSearch = await getAdapter("noormags").search("علم داده", 3);
  console.log(JSON.stringify(noorSearch, null, 2));
  if (!noorSearch.hits[0]) throw new Error("Expected Noormags hits");

  console.log("\n=== get_record noormags ===");
  const noor = await getAdapter("noormags").getRecord(noorSearch.hits[0].id);
  console.log(JSON.stringify(noor, null, 2));

  console.log("\n=== search civilica: داده ===");
  const civSearch = await getAdapter("civilica").search("داده", 3);
  console.log(JSON.stringify(civSearch, null, 2));
  if (!civSearch.hits[0]) throw new Error("Expected Civilica hits");

  console.log("\n=== get_record civilica ===");
  const civ = await getAdapter("civilica").getRecord(civSearch.hits[0].id);
  console.log(JSON.stringify(civ, null, 2));

  console.log("\n=== search irandoc/ganj: علم داده ===");
  const iranSearch = await getAdapter("irandoc").search("علم داده", 3);
  console.log(JSON.stringify(iranSearch, null, 2));
  if (!iranSearch.hits[0]) throw new Error("Expected Irandoc/Ganj hits");

  console.log("\n=== get_record irandoc ===");
  const iran = await getAdapter("irandoc").getRecord(iranSearch.hits[0].id);
  console.log(JSON.stringify(iran, null, 2));

  console.log("\n=== export_citation apa (noormags) ===");
  console.log(exportCitation(noor, "apa"));

  console.log("\n=== stubbed sources (expect empty + notes) ===");
  for (const id of ["sid", "nlai"] as const) {
    const r = await getAdapter(id).search("test", 1);
    console.log(id, r.status, (r.note || "").slice(0, 120));
  }

  console.log("\n=== collection ===");
  await saveCollectionItem(noor, "smoke test");
  const listed = await listCollection();
  console.log(`collection path=${listed.path} count=${listed.count}`);

  console.log("\nSMOKE OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
