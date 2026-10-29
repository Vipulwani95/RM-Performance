# 📊 RM Performance Dashboard | Ambassador Club

Executive-grade performance tracking dashboard for Relationship Managers across North, West, South, and New Joiner cohorts.

## 🏗️ Architecture

```
RM Performance/
├── 🏠 index.html          → Executive Landing Page & Hub
├── 📊 global.html         → Team Comparison (multi-RM cross-benchmarking)
├── 👤 profile.html        → RM Profile Deep-Dive (individual RM scrollable profile)
├── css/
│   └── styles.css         → Executive Design System (shared styles)
├── js/
│   ├── dashboard.js       → Core data processing & utilities
│   ├── data.js            → Offline data (extracted from Google Sheet)
│   ├── global.js          → Team comparison chart controller
│   └── profile.js         → Profile view chart controller
├── apps-script/
│   ├── Code.gs            → Google Apps Script Web App (JSON API)
│   ├── appsscript.json    → Apps Script manifest
│   └── README.md          → Apps Script deployment guide
└── data.json              → Raw JSON data backup
```

## 🚀 Quick Start (Local Preview)

Simply open `index.html` in any modern browser. The dashboard works offline using embedded data from `js/data.js`.

## 📡 Connect to Live Google Sheet

### Step 1: Deploy Google Apps Script

1. Open [Google Apps Script](https://script.google.com/)
2. Create a new project or open the project bound to your spreadsheet
3. Copy contents of `apps-script/Code.gs` into the script editor
4. Click **Deploy** → **New Deployment**
5. Select **Web App**
6. Set **Execute as**: Me, **Who has access**: Anyone
7. Click **Deploy** and copy the Web App URL

### Step 2: Connect Dashboard

In each HTML file (`index.html`, `global.html`, `profile.html`), find:
```html
<input type="hidden" id="appsScriptUrl" value="">
```
Set the `value` to your deployed Web App URL:
```html
<input type="hidden" id="appsScriptUrl" value="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec">
```

### Step 3: Push to GitHub Pages

```bash
git init
git add .
git commit -m "Initial dashboard deployment"
git remote add origin https://github.com/YOUR_USERNAME/rm-performance-dashboard.git
git push -u origin main
```

Then enable GitHub Pages in **Settings → Pages → Source: main branch**.

## 👥 Relationship Managers

| RM | Zone | Color | Data Since |
|---|---|---|---|
| **Malik** | North & Chennai | 🟣 Indigo (#4F46E5) | Dec 2025 |
| **Ramya** | South | 🟢 Emerald (#059669) | Dec 2025 |
| **Dipali** | West | 🟡 Amber (#D97706) | Dec 2025 |
| **Shirish** | New Joiner | 🟣 Violet (#7C3AED) | May 2026 |
| **Anand** | New Joiner | 🔴 Red (#DC2626) | Jun 2026 |

## 📈 Dashboard Sections

### Landing Page (index.html)
- Executive KPI ribbon (Team Dials, Connect Rate, Conversions, Avg Talktime)
- Navigation cards to Team Comparison & RM Profiles
- RM roster with zone badges and quick stats

### Team Comparison (global.html)
- **Overview**: KPI scorecards per RM with MoM deltas + Zone summary
- **MoM Trends**: 8 separate clean charts (5 standalone + 3 paired dial/connect)
- **Dial Analysis**: Stacked bar breakdown, connect rate by type, talktime heatmap
- **Conversions**: Funnel, MoM conversion %, target vs actual, Paid AB & Active Users
- **Head-to-Head**: Radar chart, sortable ranking table, 25+/25- bucket analysis
- **Consistency**: Working days, avg daily calls, consistency gauge, daily sparklines

### RM Profile (profile.html)
- Profile hero banner with RM name, zone, tenure
- Full KPI dashboard for selected RM
- All trend charts (single-RM focused, larger charts)
- Dial composition breakdown + donut chart
- Talktime calendar heatmap
- Conversion funnel & daily trends
- 25+/25- volume analysis
- Consistency score & working days history

## 🔄 Auto-Update

When new month data is added to the Google Sheet:
1. The Apps Script API automatically serves the latest data
2. Dashboard picks up new months on next page load
3. No code changes needed — just add data to the sheet

## 📱 Responsive

Works on desktop, tablet, and mobile. Print-friendly with `@media print` styles.

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Charts**: Chart.js v4
- **Fonts**: Google Fonts (Inter)
- **Data API**: Google Apps Script Web App
- **Hosting**: GitHub Pages (static site)

---

*Built for the Ambassador Club Leadership Team*
