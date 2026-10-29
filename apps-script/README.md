# RM Performance Report Web App API

Google Apps Script Web App that extracts and serves structured performance metrics from the **'RM Performance Report | Ambassador Club'** Google Spreadsheet as a JSON API with CORS support.

---

## 📋 Features

- **Dynamic RM Daily Data**: Extracts daily dialing, connect, onboarding, active AB, and talk time metrics for all RMs (`Malik`, `Ramya`, `Dipali`, `Shirish`, `Anand`).
- **Column Gap Handling**: Safely skips gap column U between Talk Time (col T) and Total Connected (col V).
- **Monthly Comparison Reports**: Dynamically extracts overall totals, targets, jumps, deltas, and per-RM blocks for all `Comparison Report Mon-YYYY` sheets.
- **Paid AB Tracking**: Reads daily paid ambassador records from the `Paid AB` tab.
- **Active Users Tracking**: Reads daily active users per RM from the `Active Users` tab.
- **25+ / <25 Volume Bucket Analysis**: Dynamically extracts high volume (25+) and low volume (<25) category breakdowns (`Consistent`, `Reactive`, `Active`) from all `25+  25- Report Mon-YYYY` sheets.
- **Graceful Error & Blank Handling**: Treats blanks as 0 for numeric fields, formats all dates uniformly as `YYYY-MM-DD`.
- **CORS & JSONP**: Ready for cross-origin browser fetch requests and optional `?callback=` JSONP wrappers.

---

## 🚀 Deployment Instructions

### Method 1: Container-Bound Script (Recommended)
1. Open the Google Spreadsheet: **"RM Performance Report | Ambassador Club"**.
2. Click **Extensions** > **Apps Script**.
3. Replace the default `Code.gs` content with the code from [`Code.gs`](file:///d:/Ambassador%20Club/RM%20Performance/apps-script/Code.gs).
4. Save the project (`Ctrl+S` / `Cmd+S`).
5. Select `setup` from the function dropdown and click **Run** to authorize permissions and verify data reading.
6. Click **Deploy** > **New deployment**.
7. In the left panel, click the gear icon next to "Select type" and choose **Web app**.
8. Fill in:
   - **Description**: `RM Performance API v1`
   - **Execute as**: `Me` (your account)
   - **Who has access**: `Anyone`
9. Click **Deploy** and copy the generated Web App URL.

### Method 2: Standalone Script
1. Visit [script.google.com](https://script.google.com) and create a New Project.
2. Paste the contents of `Code.gs` and `appsscript.json`.
3. In `CONFIG` at the top of `Code.gs`, provide your spreadsheet ID in `SPREADSHEET_ID`.
4. Run `setup()` and deploy as Web app.

---

## 📡 API Usage & Endpoints

### 1. Fetch Complete Report
```http
GET https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec
```

### 2. Fetch Specific Section
```http
GET https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?sheet=rmDaily
GET https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?sheet=rmDaily&rm=Malik
GET https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?sheet=comparison
GET https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?sheet=paidAB
GET https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?sheet=activeUsers
GET https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?sheet=bucketAnalysis
GET https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?sheet=metadata
```

### 3. JSONP Support
```http
GET https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?callback=myCallback
```

---

## 📦 JSON Response Schema

```json
{
  "rmDaily": {
    "Malik": [
      {
        "date": "2025-12-26",
        "onboarding_dial": 14,
        "onboarding_connect": 8,
        "active_dial": 60,
        "active_connect": 26,
        "reactive_dial": 30,
        "reactive_connect": 12,
        "consistent_dial": 7,
        "consistent_connect": 5,
        "home_service_dial": 4,
        "home_service_connect": 2,
        "acquisition_dial": 70,
        "acquisition_connect": 22,
        "phone_dial": 11,
        "phone_connect": 5,
        "other_dial": 0,
        "other_connect": 0,
        "onboardings": 5,
        "active_ab": 2,
        "talk_time": 106,
        "total_connected": 80
      }
    ]
  },
  "comparison": {
    "Oct-2026": {
      "overall": {
        "prevLabel": "1-25 Sep-2026",
        "currLabel": "1-25 Oct-2026",
        "prev": { "total_leads": 167272, "workable_leads": 81464, "conversion": 9455, "conversion_pct": "11.61%", "projection": null },
        "curr": { "total_leads": 142475, "workable_leads": 73356, "conversion": 9568, "conversion_pct": "13.04%", "projection": "Projection - Oct-2026" },
        "target": { "total_leads": 150108, "workable_leads": 77286, "conversion": 10080, "conversion_pct": "13.04%", "projection": 11864 },
        "jump": { "total_leads": "-14.8%", "workable_leads": "-10.0%", "conversion": "1.2%", "conversion_pct": "1.43%", "projection": null },
        "delta": { "total_leads": "-5.1%", "workable_leads": "-5.1%", "conversion": "-5.1%", "conversion_pct": "0.00%", "projection": null }
      },
      "rms": {
        "Malik": {
          "prev": { "total_leads": 80574, "workable_leads": 35426, "conversion": 4810, "conversion_pct": "13.58%", "projection": null },
          "curr": { "total_leads": 65011, "workable_leads": 31052, "conversion": 4619, "conversion_pct": "14.88%", "projection": "Projection" },
          "target": { "total_leads": 76616, "workable_leads": 36595, "conversion": 5443, "conversion_pct": "14.88%", "projection": 5727 },
          "jump": { "total_leads": "-19.3%", "workable_leads": "-12.3%", "conversion": "-4.0%", "conversion_pct": "1.30%", "projection": null },
          "delta": { "total_leads": "-15.1%", "workable_leads": "-15.1%", "conversion": "-15.1%", "conversion_pct": "0.00%", "projection": null }
        }
      }
    }
  },
  "paidAB": [
    { "date": "2026-07-01", "Malik": 25, "Ramya": 13, "Dipali": 17, "Total": 55 }
  ],
  "activeUsers": [
    { "date": "2026-07-01", "Dipali": 52, "Malik": 53, "Ramya": 61, "Total": 166 }
  ],
  "bucketAnalysis": {
    "Oct-2026": {
      "Dipali": {
        "high": [
          { "category": "Consistent", "ab": 33, "workable_per_ab": 557, "paid_ab": 30, "pct_paid": "90.9%", "conversion": 2844, "conversion_pct": "15.5%" },
          { "category": "Reactive", "ab": 3, "workable_per_ab": 12.67, "paid_ab": 3, "pct_paid": "100.0%", "conversion": 4, "conversion_pct": "10.5%" },
          { "category": "Active", "ab": 7, "workable_per_ab": 47.86, "paid_ab": 5, "pct_paid": "71.4%", "conversion": 36, "conversion_pct": "10.7%" }
        ],
        "low": [
          { "category": "Consistent", "ab": 66, "workable_per_ab": 3.17, "paid_ab": 23, "pct_paid": "34.8%", "conversion": 61, "conversion_pct": "29.2%" },
          { "category": "Reactive", "ab": 61, "workable_per_ab": 1.3, "paid_ab": 5, "pct_paid": "8.2%", "conversion": 14, "conversion_pct": "17.7%" },
          { "category": "Active", "ab": 84, "workable_per_ab": 1.76, "paid_ab": 9, "pct_paid": "10.7%", "conversion": 20, "conversion_pct": "13.5%" }
        ]
      }
    }
  },
  "metadata": {
    "lastUpdated": "2026-10-29T12:00:00",
    "rmList": ["Malik", "Ramya", "Dipali", "Shirish", "Anand"],
    "zones": {
      "Malik": "North & Chennai",
      "Dipali": "West",
      "Ramya": "South",
      "Shirish": "New",
      "Anand": "New"
    }
  }
}
```
