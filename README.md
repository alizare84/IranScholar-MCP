# IranScholar MCP

stdio MCP server for Persian academic discovery — search articles and theses across Iranian sources from Cursor (or any MCP client) while writing a thesis.

سرور MCP برای جست‌وجو و گردآوری منابع علمی فارسی (مقاله، پایان‌نامه، کتاب) هنگام نگارش پایان‌نامه.

## Sources

| Source | Status | Notes |
|--------|--------|-------|
| **Noormags** (نورمگز) | **live** | HTML search + citation meta on article pages |
| **Civilica** (سیویلیکا) | **live** | SSR search `/search/paper/…` + `/doc/{id}/` meta |
| **Irandoc / Ganj** (ایرانداک) | **live** | via `search.irandoc.ac.ir` Ganj API (network can be flaky) |
| **SID** (جهاد دانشگاهی) | **stubbed** | Cloudflare Waiting Room — no public JSON without challenge |
| **NLAI** (کتابخانه ملی) | **stubbed** | OPAC/www often unreachable (TLS/timeout) from many environments |

Stubbed adapters return empty hits plus a blocker note so tools stay discoverable without pretending to scrape behind Cloudflare.

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

Optional live smoke (hits Noormags / Civilica / Irandoc; SID & NLAI stay stubbed):

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
