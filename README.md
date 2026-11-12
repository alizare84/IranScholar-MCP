# IranScholar MCP

stdio MCP server for Persian academic discovery — search articles and theses across Iranian sources from Cursor (or any MCP client) while writing a thesis.

سرور MCP برای جست‌وجو و گردآوری منابع علمی فارسی (مقاله، پایان‌نامه، کتاب) هنگام نگارش پایان‌نامه.

## Sources

| Source | Status | Notes |
|--------|--------|-------|
| **Noormags** (نورمگز) | **live** | HTML search + Highwire citation meta on article pages |
| **Civilica** (سیویلیکا) | **live** | Prefer SSR `/search/paper/…` + `/doc/{id}/`; falls back to Irandoc Civilica proxy when direct SSR fails |
| **Irandoc / Ganj** (ایرانداک) | **live** | `search.irandoc.ac.ir` Ganj API (direct `ganj.irandoc.ac.ir` often times out). `get_record` uses in-process cache from a recent `search` in the same process |
| **Ensani** (پرتال جامع علوم انسانی) | **live** | HTML `/fa/article/search/index?term=` + `/fa/article/{id}` |
| **Noordoc** (نوردوک / پایان‌نامه‌ها) | **live** | JSON `SearchThesis` + `/_content/api/v1/thesis/{id}` (author/person URLs too) |
| **SID** (جهاد دانشگاهی) | **stubbed** | Cloudflare Waiting Room — no public JSON without challenge |
| **Elmnet** (علم‌نت) | **stubbed** | ArvanCloud Waiting Room on all probed paths; no public body |
| **NLAI** (کتابخانه ملی) | **stubbed** | TCP connects but TLS/HTTP hang (0 bytes) from many cloud paths |

Stubbed adapters return empty hits plus a blocker note so tools stay discoverable without pretending to scrape behind Cloudflare/ArvanCloud waiting rooms or dead TLS paths.

**Smoke-checked (2026-11-12):** Noormags + Irandoc return real hits for author/advisor queries such as «مهدی شامی زنجانی»; Ensani/Noordoc/Civilica respond live on generic queries (name hits may be empty depending on the catalog).

## Tools

| Tool | Purpose |
|------|---------|
| `list_sources` | Configured sources, capabilities, and live/stubbed status |
| `search_sources` | `query`, optional `sources[]`, `limit` |
| `get_record` | Fetch one record by `source` + `id` / `url` |
| `export_citation` | Formats: `apa` \| `vancouver` \| `bibtex` |
| `save_collection_item` / `list_collection` | Local JSON bibliography |

## Requirements

- Node.js **18+**

## Install & build

```bash
git clone https://github.com/alizare84/IranScholar-MCP.git
cd IranScholar-MCP
npm install
npm run build
```

Run the server (stdio — leave it for the MCP client to spawn):

```bash
npm start
# equivalent: node dist/index.js
```

Optional live smoke (hits Noormags / Civilica / Irandoc / Ensani / Noordoc; SID, Elmnet & NLAI stay stubbed):

```bash
npm run smoke
```

## Cursor MCP config

Cursor → **Settings → MCP** (or your user `mcp.json`). Point `args` at the **absolute** path of `dist/index.js` on your machine:

```json
{
  "mcpServers": {
    "iranscholar": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/IranScholar-MCP/dist/index.js"]
    }
  }
}
```

Examples:

- macOS/Linux: `"/Users/you/src/IranScholar-MCP/dist/index.js"`
- Windows: `"C:\\\\Users\\\\you\\\\src\\\\IranScholar-MCP\\\\dist\\\\index.js"`

Rebuild after pulling (`npm run build`) so `dist/` matches `src/`.

### Optional environment

| Variable | Meaning |
|----------|---------|
| `IRANSCHOLAR_COLLECTION_PATH` | Override local collection JSON (default `data/collection.json`) |

## Project layout

```
src/           TypeScript MCP server + source adapters
scripts/       smoke.ts live checks
data/          local collection (gitignored runtime file)
dist/          build output (gitignored; created by npm run build)
```

## Non-goals (v1)

- PDF paywall bypass
- University SSO / campus VPN automation
- Hosted Agent SDK bot (this repo is a standalone MCP server)

## License

MIT
