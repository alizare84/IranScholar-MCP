# IranScholar MCP

**جست‌وجوی یکپارچه منابع علمی فارسی داخل Cursor** — مقاله، پایان‌نامه و کتاب از ایرانداک، نورمگز، سیویلیکا، انسانی، نوردوک، SID، علم‌نت و کتابخانه ملی، بدون جابه‌جایی بین ده‌ها تب مرورگر.

stdio [MCP](https://modelcontextprotocol.io) server for Persian academic discovery. Use it from **Cursor** (or any MCP client) while writing a thesis: search multiple Iranian catalogs, fetch metadata, export citations, and keep a local bibliography collection.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js 18+](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-stdio-blue)](https://modelcontextprotocol.io)

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
| **Civilica** | سیویلیکا | **live** | SSR جست‌وجو + صفحه `/doc/{id}/`؛ در صورت قطع، پروکسی ایرانداک |
| **Irandoc / Ganj** | ایرانداک (گنج) | **live** | API جست‌وجوی پایان‌نامه/پیشنهاده؛ `get_record` بعد از `search` در همان پروسس |
| **Ensani** | پرتال جامع علوم انسانی | **live** | جست‌وجوی مقاله HTML + صفحه `/fa/article/{id}` |
| **Noordoc** | نوردوک | **live** | API پایان‌نامه (`SearchThesis`) + thesis/author |
| **SID** | جهاد دانشگاهی | **partial** | پارسر HTML — روی **خروجی شبکه ایران**؛ از کلود خارجی اغلب Waiting Room |
| **Elmnet** | علم‌نت | **partial** | `/search?q=` + `/doc/{id}` — روی **ایران**؛ ArvanCloud Waiting Room از بسیاری IPهای کلود |
| **NLAI** | کتابخانه ملی | **partial** | OPAC — روی **ایران**؛ از کلود خارجی TLS اغلب قطع می‌شود |

**وضعیت‌ها:** `live` = از این محیط هم معمولاً جواب می‌دهد · `partial` = پارسر آماده است، برای نتیجه واقعی بهتر است MCP را روی ماشین/پروکسی با دسترسی ایران اجرا کنید · هرگز چالش CDN را دور نمی‌زنیم.

**دسترسی ایران:** `npm start` روی ISP/VPN ایران، یا پروکسی با `HTTPS_PROXY` / `HTTP_PROXY` و **`NODE_USE_ENV_PROXY=1`** (بدون این فلگ، `fetch` در Node معمولاً پروکسی را رعایت نمی‌کند). اختیاری: `IRANSCHOLAR_COOKIE` فقط برای میزبان‌های **sid.ir / elmnet.ir / nlai.ir** (به نورمگز/سیویلیکا و بقیه ارسال نمی‌شود).

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
npm start          # stdio MCP — کلاینت (Cursor) این پروسس را spawn می‌کند

# با پروکسی ایران (Node باید env-proxy را روشن کند):
# NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://127.0.0.1:7890 npm start
# یا: node --use-env-proxy dist/index.js
```

اسموک زنده (شبکه):

```bash
npm run smoke
```

---

## تنظیم در Cursor

**Settings → MCP** (یا فایل `mcp.json`). مسیر `args` باید **مطلق** به `dist/index.js` باشد:

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

اگر از پروکسی استفاده می‌کنید، `HTTPS_PROXY` را هم در همان `env` (یا محیط سیستم) بگذارید. بدون `NODE_USE_ENV_PROXY=1`، `fetch` معمولاً مستقیم وصل می‌شود.

مثال‌ها:

- macOS/Linux: `"/Users/you/src/IranScholar-MCP/dist/index.js"`
- Windows: `"C:\\\\Users\\\\you\\\\src\\\\IranScholar-MCP\\\\dist\\\\index.js"`

بعد از `git pull` حتماً دوباره `npm run build` بزنید تا `dist/` با `src/` یکی باشد.

### متغیرهای محیطی (اختیاری)

| Variable | معنی |
|----------|------|
| `IRANSCHOLAR_COLLECTION_PATH` | مسیر JSON کالکشن (پیش‌فرض `data/collection.json`) |
| `IRANSCHOLAR_COOKIE` | Cookie فقط برای درخواست‌های `*.sid.ir` / `*.elmnet.ir` / `*.nlai.ir` (بعد از عبور مرورگر از Waiting Room)؛ به بقیه منابع ارسال نمی‌شود |
| `HTTPS_PROXY` / `HTTP_PROXY` | پروکسی خروجی ایران — برای `fetch` در Node باید **`NODE_USE_ENV_PROXY=1`** یا `node --use-env-proxy` هم باشد |
| `NODE_USE_ENV_PROXY` | `1` تا Node از متغیرهای پروکسی محیطی برای `fetch` استفاده کند ([docs](https://nodejs.org/learn/http/enterprise-network-configuration)) |

---

## ساختار پروژه

```
src/           سرور MCP + آداپترهای منابع
scripts/       smoke.ts — تست زنده
data/          کالکشن محلی (runtime؛ gitignored)
dist/          خروجی build (gitignore)
```

---

## غیرهدف‌های v1 (Non-goals)

- دور زدن paywall PDF  
- دور زدن Cloudflare / ArvanCloud Waiting Room  
- SSO دانشگاه / اتوماسیون VPN سازمانی  
- بات Hosted Agent SDK (این ریپو یک سرور MCP مستقل است)

---

## مشارکت و بازخورد

ایده برای منبع بعدی (مگیران، ISC، کتابخانه‌های دانشگاهی، …)، باگ، یا PR خوشحال‌کننده است. اگر برای پایان‌نامه/مقاله فارسی مفید بود، ستاره روی ریپو کمک می‌کند دیده شود.

**مخزن:** https://github.com/alizare84/IranScholar-MCP

---

## License

MIT
