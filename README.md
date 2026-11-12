# IranScholar MCP

<p align="center">
  <strong>جست‌وجوی یکپارچه منابع علمی فارسی داخل Cursor</strong><br/>
  مقاله · پایان‌نامه · کتاب — بدون جابه‌جایی بین ده‌ها تب مرورگر
</p>

<p align="center">
  stdio <a href="https://modelcontextprotocol.io">MCP</a> server for Persian academic discovery.<br/>
  Search Iranian catalogs, fetch metadata, export citations, keep a local thesis bibliography.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="MIT" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node 18+" /></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-stdio-blue" alt="MCP" /></a>
  <img src="https://img.shields.io/badge/sources-8-informational" alt="8 sources" />
</p>

**مخزن:** [github.com/alizare84/IranScholar-MCP](https://github.com/alizare84/IranScholar-MCP)

---

## چرا این پروژه؟

پژوهشگر فارسی‌زبان معمولاً باید جداگانه در نورمگز، سیویلیکا، گنج ایرانداک و بقیه جستجو کند، لینک و متادیتا را دستی کپی کند و استناد را جدا بسازد. **IranScholar MCP** این مسیر را به چند ابزار MCP داخل ادیتور تبدیل می‌کند:

1. یک کوئری → چند منبع  
2. گرفتن رکورد کامل (عنوان، نویسندگان، چکیده، سال، نشانی)  
3. خروجی استناد APA / Vancouver / BibTeX  
4. ذخیره در کالکشن محلی JSON برای پایان‌نامه

---

## منابع (Sources)

| Source | فارسی | Status | چه می‌کند |
|--------|--------|--------|-----------|
| **Noormags** | نورمگز | **live** | جست‌وجوی HTML + متادیتای استناد روی صفحه مقاله |
| **Civilica** | سیویلیکا | **live** | SSR جست‌وجو + `/doc/{id}/`؛ در صورت قطع → پروکسی ایرانداک |
| **Irandoc / Ganj** | ایرانداک (گنج) | **live** | API پایان‌نامه/پیشنهاده؛ `get_record` بعد از `search` در همان پروسس |
| **Ensani** | پرتال جامع علوم انسانی | **live** | جست‌وجوی مقاله HTML + `/fa/article/{id}` |
| **Noordoc** | نوردوک | **live** | API پایان‌نامه (`SearchThesis`) + thesis/author |
| **SID** | جهاد دانشگاهی | **partial** | پارسر HTML — روی **خروجی ایران**؛ از کلود اغلب Waiting Room |
| **Elmnet** | علم‌نت | **partial** | `/search?q=` + `/doc/{id}` — روی **ایران**؛ ArvanCloud Waiting Room از بسیاری IPهای کلود |
| **NLAI** | کتابخانه ملی | **partial** | OPAC — روی **ایران**؛ از کلود خارجی TLS اغلب قطع می‌شود |

**وضعیت‌ها:** `live` = معمولاً از اکثر محیط‌ها جواب می‌دهد · `partial` = پارسر آماده؛ برای نتیجه واقعی MCP را روی ماشین/پروکسی با دسترسی ایران اجرا کنید · چالش CDN را دور نمی‌زنیم.

**دسترسی ایران:** `npm start` روی ISP/VPN ایران، یا `HTTPS_PROXY` / `HTTP_PROXY` + **`NODE_USE_ENV_PROXY=1`**. اختیاری: `IRANSCHOLAR_COOKIE` فقط برای **sid.ir / elmnet.ir / nlai.ir**.

---

## ابزارهای MCP (Tools)

| Tool | کار |
|------|-----|
| `list_sources` | فهرست منابع، قابلیت‌ها و وضعیت live/partial |
| `search_sources` | `query` + اختیاری `sources[]` و `limit` |
| `get_record` | متادیتای یک رکورد با `source` + `id` / `url` |
| `export_citation` | `apa` \| `vancouver` \| `bibtex` |
| `save_collection_item` | ذخیره در کتاب‌شناسی محلی JSON |
| `list_collection` | فهرست آیتم‌های ذخیره‌شده |

### نمونه جریان کار

```
list_sources
  → search_sources  query=«مهدی شامی زنجانی»  sources=["noormags","irandoc"]
  → get_record      source=noormags  id=1809667
  → export_citation style=apa  source=noormags  id=1809667
  → save_collection_item …
```

---

## نصب و اجرا

نیازمندی: **Node.js 18+**

```bash
git clone https://github.com/alizare84/IranScholar-MCP.git
cd IranScholar-MCP
npm install
npm run build
npm start          # stdio MCP — Cursor این پروسس را spawn می‌کند

# با پروکسی ایران:
# NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://127.0.0.1:7890 npm start
# یا: node --use-env-proxy dist/index.js
```

اسموک زنده:

```bash
npm run smoke
```

---

## تنظیم در Cursor

**Settings → MCP** (یا `mcp.json`). مسیر `args` باید **مطلق** به `dist/index.js` باشد:

```json
{
  "mcpServers": {
    "iranscholar": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/IranScholar-MCP/dist/index.js"],
      "env": {
        "NODE_USE_ENV_PROXY": "1"
      }
    }
  }
}
```

- macOS/Linux: `"/Users/you/src/IranScholar-MCP/dist/index.js"`
- Windows: `"C:\\\\Users\\\\you\\\\src\\\\IranScholar-MCP\\\\dist\\\\index.js"`

بعد از `git pull` دوباره `npm run build` بزنید.

### متغیرهای محیطی

| Variable | معنی |
|----------|------|
| `IRANSCHOLAR_COLLECTION_PATH` | مسیر JSON کالکشن (پیش‌فرض `data/collection.json`) |
| `IRANSCHOLAR_COOKIE` | فقط برای `*.sid.ir` / `*.elmnet.ir` / `*.nlai.ir` |
| `HTTPS_PROXY` / `HTTP_PROXY` | پروکسی ایران — با **`NODE_USE_ENV_PROXY=1`** یا `node --use-env-proxy` |
| `NODE_USE_ENV_PROXY` | `1` تا `fetch` پروکسی محیطی را رعایت کند |

---

## ساختار پروژه

```
src/           سرور MCP + آداپترها
scripts/       smoke.ts
data/          کالکشن محلی (gitignored)
dist/          خروجی build
```

---

## غیرهدف‌های v1

- دور زدن paywall PDF یا Waiting Room CDN  
- SSO دانشگاه / اتوماسیون VPN  
- بات Hosted Agent SDK (این یک سرور MCP مستقل است)

---

## مشارکت

ایده برای منبع بعدی (مگیران، ISC، …)، باگ یا PR خوشحال‌کننده است. اگر مفید بود، ستاره بزنید.

## License

MIT
