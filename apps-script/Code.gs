/**
 * ============================================================================
 * RM Performance Report API - Google Apps Script Web App
 * ============================================================================
 * Spreadsheet: "RM Performance Report | Ambassador Club"
 * 
 * Provides a high-performance JSON API endpoint for RM daily metrics, monthly
 * comparison reports, Paid AB trends, Active Users, and 25+/25- bucket analysis.
 * 
 * ----------------------------------------------------------------------------
 * DEPLOYMENT INSTRUCTIONS:
 * ----------------------------------------------------------------------------
 * OPTION 1: Bound to Spreadsheet (Recommended)
 * 1. Open your Google Spreadsheet: "RM Performance Report | Ambassador Club"
 * 2. In the top menu, click Extensions > Apps Script.
 * 3. Delete any default code in Code.gs and paste the contents of this file.
 * 4. Click the "Save" icon (Ctrl+S / Cmd+S).
 * 5. Run the setup() function once from the toolbar dropdown to verify access
 *    and grant required permissions.
 * 6. Click Deploy > New deployment.
 * 7. Click the gear icon next to "Select type" and select "Web app".
 * 8. Configure the deployment:
 *    - Description: "RM Performance API v1"
 *    - Execute as: "Me" (your Google account)
 *    - Who has access: "Anyone" (allows CORS access from your web app/dashboard)
 * 9. Click "Deploy", copy the Web App URL, and use it in your dashboard!
 * 
 * OPTION 2: Standalone Script
 * 1. Go to script.google.com and create a new project.
 * 2. Paste this code into Code.gs.
 * 3. In CONFIG below, set SPREADSHEET_ID to your Google Sheet's ID (found in the URL:
 *    https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit).
 * 4. Save, run setup(), and deploy as Web App following steps 6-9 above.
 * 
 * ----------------------------------------------------------------------------
 * API USAGE & ENDPOINTS:
 * ----------------------------------------------------------------------------
 * 1. GET full structured JSON:
 *    https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec
 * 
 * 2. GET specific section (optional filter query parameter):
 *    - ?sheet=rmDaily         -> Returns only RM daily tracking data
 *    - ?sheet=rmDaily&rm=Malik-> Returns only Malik's daily data
 *    - ?sheet=comparison      -> Returns comparison reports
 *    - ?sheet=paidAB          -> Returns Paid AB data
 *    - ?sheet=activeUsers     -> Returns Active Users data
 *    - ?sheet=bucketAnalysis  -> Returns 25+ / <25 bucket analysis
 *    - ?sheet=metadata        -> Returns metadata (RMs, zones, last updated)
 * 
 * 3. JSONP Support:
 *    - ?callback=myCallback   -> Wraps response in myCallback({...})
 * ============================================================================
 */

/**
 * Global Configuration
 */
var CONFIG = {
  // Spreadsheet name (used for auto-discovery if running standalone)
  SPREADSHEET_NAME: 'RM Performance Report | Ambassador Club',
  
  // Spreadsheet ID (leave empty if bound script or auto-discovering by name)
  SPREADSHEET_ID: '',

  // List of RM names to look for as daily data tabs
  RM_NAMES: ['Malik', 'Ramya', 'Dipali', 'Shirish', 'Anand'],

  // Default RM Zone Mapping
  ZONES: {
    'Malik': 'North & Chennai',
    'Dipali': 'West',
    'Ramya': 'South',
    'Shirish': 'New',
    'Anand': 'New'
  },

  // Fallback timezone (Asia/Kolkata is default for Ambassador Club)
  DEFAULT_TIMEZONE: 'Asia/Kolkata'
};

/**
 * Main Web App Handler (doGet)
 * Returns structured JSON with full CORS support.
 * 
 * @param {Object} e HTTP request event object
 * @returns {TextOutput} JSON response
 */
function doGet(e) {
  try {
    var ss = getSpreadsheet();
    var allData = getReportData(ss);

    // Support optional query parameter filtering
    var responseData = allData;
    var params = (e && e.parameter) ? e.parameter : {};

    if (params.sheet) {
      var section = params.sheet.trim();
      if (allData.hasOwnProperty(section)) {
        if (section === 'rmDaily' && params.rm) {
          var rmName = params.rm.trim();
          responseData = allData.rmDaily[rmName] || [];
        } else {
          responseData = allData[section];
        }
      }
    }

    var jsonString = JSON.stringify(responseData);

    // Support JSONP if callback is provided
    if (params.callback) {
      return ContentService.createTextOutput(params.callback + '(' + jsonString + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    // Standard JSON output with CORS support
    return ContentService.createTextOutput(jsonString)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    var errorPayload = {
      status: 'error',
      message: err.message || String(err),
      stack: err.stack || null,
      timestamp: new Date().toISOString()
    };
    return ContentService.createTextOutput(JSON.stringify(errorPayload))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Resolves and opens the spreadsheet.
 * Checks active spreadsheet first, then CONFIG.SPREADSHEET_ID, then searches Drive by name.
 * 
 * @returns {Spreadsheet} Opened Google Spreadsheet
 */
function getSpreadsheet() {
  // 1. Try active spreadsheet (when running as container-bound script)
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) {
    return ss;
  }

  // 2. Try configured Spreadsheet ID if provided
  if (CONFIG.SPREADSHEET_ID && CONFIG.SPREADSHEET_ID.trim() !== '') {
    try {
      return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID.trim());
    } catch (e) {
      Logger.log('Could not open spreadsheet by ID: ' + e.message);
    }
  }

  // 3. Try finding spreadsheet by name in Drive
  var candidateNames = [
    CONFIG.SPREADSHEET_NAME,
    'RM Performance Report _ Ambassador Club',
    'RM Performance Report'
  ];

  for (var i = 0; i < candidateNames.length; i++) {
    try {
      var files = DriveApp.getFilesByName(candidateNames[i]);
      if (files.hasNext()) {
        return SpreadsheetApp.open(files.next());
      }
    } catch (e) {
      Logger.log('Drive search for "' + candidateNames[i] + '" failed: ' + e.message);
    }
  }

  throw new Error(
    'Spreadsheet not found! Please ensure this script is bound to the spreadsheet ' +
    '("Extensions > Apps Script" inside the sheet) or set CONFIG.SPREADSHEET_ID in Code.gs.'
  );
}

/**
 * Reads all data from the spreadsheet and structures it into the final JSON format.
 * 
 * @param {Spreadsheet} ss The spreadsheet instance
 * @returns {Object} Complete structured report data
 */
function getReportData(ss) {
  if (!ss) {
    ss = getSpreadsheet();
  }

  var tz = ss.getSpreadsheetTimeZone() || CONFIG.DEFAULT_TIMEZONE;
  var sheets = ss.getSheets();

  // Categorize sheets
  var rmDailySheets = {};
  var comparisonSheets = [];
  var bucketSheets = [];
  var paidAbSheet = null;
  var activeUsersSheet = null;

  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    var name = sheet.getName().trim();

    // 1. RM Daily Tabs: exact match for RM names
    if (CONFIG.RM_NAMES.indexOf(name) !== -1) {
      rmDailySheets[name] = sheet;
      continue;
    }

    // 2. Comparison Report Tabs: 'Comparison Report Mon-YYYY'
    if (/^Comparison Report\b/i.test(name)) {
      comparisonSheets.push(sheet);
      continue;
    }

    // 3. Paid AB Tab
    if (name.toLowerCase() === 'paid ab') {
      paidAbSheet = sheet;
      continue;
    }

    // 4. Active Users Tab
    if (name.toLowerCase() === 'active users') {
      activeUsersSheet = sheet;
      continue;
    }

    // 5. 25+ 25- Report Tabs: '25+  25- Report Mon-YYYY'
    if (/^25\+\s*25-\s*Report\b/i.test(name)) {
      bucketSheets.push(sheet);
      continue;
    }
  }

  // Parse each section
  var rmDaily = parseAllRmDaily(rmDailySheets, tz);
  var comparison = parseComparisonReports(comparisonSheets);
  var paidAB = paidAbSheet ? parsePaidAB(paidAbSheet, tz) : [];
  var activeUsers = activeUsersSheet ? parseActiveUsers(activeUsersSheet, tz) : [];
  var bucketAnalysis = parseBucketReports(bucketSheets);

  // Compile metadata
  var activeRmList = Object.keys(rmDaily).length > 0 ? Object.keys(rmDaily) : CONFIG.RM_NAMES;
  var lastUpdatedStr = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd'T'HH:mm:ss");

  return {
    rmDaily: rmDaily,
    comparison: comparison,
    paidAB: paidAB,
    activeUsers: activeUsers,
    bucketAnalysis: bucketAnalysis,
    metadata: {
      lastUpdated: lastUpdatedStr,
      rmList: activeRmList,
      zones: CONFIG.ZONES
    }
  };
}

/**
 * ----------------------------------------------------------------------------
 * 1. RM DAILY DATA PARSER
 * ----------------------------------------------------------------------------
 * Reads daily follow-up and dialing data for each RM.
 * 
 * Column Mapping:
 * A (0)  = Date
 * B (1)  = Onboarding followup-Dial
 * C (2)  = Onboarding followup-Connect
 * D (3)  = Active Followups-Dial
 * E (4)  = Active Followups-Connect
 * F (5)  = Reactive Followups-Dial
 * G (6)  = Reactive Followups-Connect
 * H (7)  = Consistent Followups-Dial
 * I (8)  = Consistent Followups-Connect
 * J (9)  = Home Service Dial
 * K (10) = Home Service Connect
 * L (11) = Acquisition Dial
 * M (12) = Acquisition Connect
 * N (13) = Phone Dial
 * O (14) = Phone Connect
 * P (15) = Other Dial
 * Q (16) = Other Connect
 * R (17) = Onboardings
 * S (18) = Active AB
 * T (19) = Talk Time (In Min.)
 * U (20) = GAP COLUMN -> SKIPPED
 * V (21) = Total connected
 */
function parseAllRmDaily(rmDailySheets, tz) {
  var result = {};

  for (var rmName in rmDailySheets) {
    if (!rmDailySheets.hasOwnProperty(rmName)) continue;
    var sheet = rmDailySheets[rmName];
    result[rmName] = parseSingleRmDaily(sheet, tz);
  }

  return result;
}

function parseSingleRmDaily(sheet, tz) {
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();
  var records = [];

  // Start from row index 1 (Row 2, skipping header row)
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var rawDate = row[0];

    // Skip empty rows or rows without a valid date
    if (rawDate === '' || rawDate === null || rawDate === undefined) {
      continue;
    }

    var formattedDate = formatDate(rawDate, tz);
    if (!formattedDate) {
      continue;
    }

    records.push({
      date: formattedDate,
      onboarding_dial: toNum(row[1]),
      onboarding_connect: toNum(row[2]),
      active_dial: toNum(row[3]),
      active_connect: toNum(row[4]),
      reactive_dial: toNum(row[5]),
      reactive_connect: toNum(row[6]),
      consistent_dial: toNum(row[7]),
      consistent_connect: toNum(row[8]),
      home_service_dial: toNum(row[9]),
      home_service_connect: toNum(row[10]),
      acquisition_dial: toNum(row[11]),
      acquisition_connect: toNum(row[12]),
      phone_dial: toNum(row[13]),
      phone_connect: toNum(row[14]),
      other_dial: toNum(row[15]),
      other_connect: toNum(row[16]),
      onboardings: toNum(row[17]),
      active_ab: toNum(row[18]),
      talk_time: toNum(row[19]),
      // Column U (index 20) is skipped
      total_connected: toNum(row[21])
    });
  }

  return records;
}

/**
 * ----------------------------------------------------------------------------
 * 2. COMPARISON REPORT PARSER
 * ----------------------------------------------------------------------------
 * Tabs: 'Comparison Report Mon-YYYY' (e.g. 'Comparison Report Jul-2026')
 * 
 * Structure:
 * - Row 1: Headers (Metric, Total Leads, Workable Leads, Conversion, Conversion %, Projection)
 * - Row 2: Previous month totals
 * - Row 3: Current month totals
 * - Row 4: Target MTD
 * - Row 5: Jump %
 * - Row 6: Target MTD Delta
 * - Row 7: 'RM Level' label
 * - Row 8+: Blocks of 6 rows per RM (prev, curr, target, jump, delta, blank)
 */
function parseComparisonReports(sheets) {
  var comparison = {};

  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    var sheetName = sheet.getName().trim();

    // Extract month key (e.g., 'Jul-2026', 'Oct-2026')
    var match = sheetName.match(/^Comparison Report\s+(.+)$/i);
    var monthKey = match ? match[1].trim() : sheetName;

    var values = sheet.getDataRange().getValues();
    if (values.length < 6) {
      continue;
    }

    // Helper to parse a metric row
    var parseCompRow = function(row, isPercentageRow) {
      if (!row) return null;
      var total = parseMetricVal(row[1], isPercentageRow);
      var workable = parseMetricVal(row[2], isPercentageRow);
      var conv = parseMetricVal(row[3], isPercentageRow);
      var convPct = formatPercentage(row[4]);
      var proj = (row.length > 5 && row[5] !== '' && row[5] !== null && row[5] !== undefined)
        ? parseMetricVal(row[5], false)
        : null;

      return {
        total_leads: total,
        workable_leads: workable,
        conversion: conv,
        conversion_pct: convPct,
        projection: proj
      };
    };

    // Overall metrics (Rows 2 to 6, index 1 to 5)
    var overall = {
      prevLabel: values[1] && values[1][0] ? String(values[1][0]).trim() : '',
      currLabel: values[2] && values[2][0] ? String(values[2][0]).trim() : '',
      prev: parseCompRow(values[1], false),
      curr: parseCompRow(values[2], false),
      target: parseCompRow(values[3], false),
      jump: parseCompRow(values[4], true),
      delta: parseCompRow(values[5], true)
    };

    // Per RM blocks (starting after 'RM Level' row)
    var rms = {};
    var startRow = 7; // Default Row 8 (0-indexed 7)

    // Find 'RM Level' row dynamically if present
    for (var r = 0; r < values.length; r++) {
      if (values[r][0] && String(values[r][0]).trim().toLowerCase() === 'rm level') {
        startRow = r + 1;
        break;
      }
    }

    var currRow = startRow;
    while (currRow < values.length) {
      var firstCell = values[currRow] ? values[currRow][0] : null;
      if (firstCell && String(firstCell).trim() !== '') {
        var rawLabel = String(firstCell).trim();
        // Extract RM name before '(' or space (e.g., 'Malik (Sep-2026)' -> 'Malik')
        var rmNameMatch = rawLabel.match(/^([^(]+)/);
        var rmName = rmNameMatch ? rmNameMatch[1].trim() : rawLabel;

        if (currRow + 4 < values.length) {
          rms[rmName] = {
            prev: parseCompRow(values[currRow], false),
            curr: parseCompRow(values[currRow + 1], false),
            target: parseCompRow(values[currRow + 2], false),
            jump: parseCompRow(values[currRow + 3], true),
            delta: parseCompRow(values[currRow + 4], true)
          };
        }
        currRow += 6; // Move to next 6-row block
      } else {
        currRow++;
      }
    }

    comparison[monthKey] = {
      overall: overall,
      rms: rms
    };
  }

  return comparison;
}

/**
 * ----------------------------------------------------------------------------
 * 3. PAID AB TAB PARSER
 * ----------------------------------------------------------------------------
 * Columns: A=Date, B=Malik, C=Ramya, D=Dipali, E=Total
 * Row 1 has totals, Row 2 has headers, data starts Row 3.
 */
function parsePaidAB(sheet, tz) {
  var values = sheet.getDataRange().getValues();
  var records = [];

  if (values.length < 3) {
    return records;
  }

  // Row 2 (index 1) has headers
  var headerRow = values[1];
  var colKeys = [];
  for (var c = 1; c < headerRow.length; c++) {
    var h = headerRow[c] ? String(headerRow[c]).trim() : '';
    if (h) {
      colKeys.push({ colIndex: c, key: h });
    }
  }

  // Fallback keys if headers are missing
  if (colKeys.length === 0) {
    colKeys = [
      { colIndex: 1, key: 'Malik' },
      { colIndex: 2, key: 'Ramya' },
      { colIndex: 3, key: 'Dipali' },
      { colIndex: 4, key: 'Total' }
    ];
  }

  // Data starts at Row 3 (index 2)
  for (var r = 2; r < values.length; r++) {
    var row = values[r];
    var rawDate = row[0];

    if (rawDate === '' || rawDate === null || rawDate === undefined) {
      continue;
    }

    var formattedDate = formatDate(rawDate, tz);
    if (!formattedDate) {
      continue;
    }

    var record = { date: formattedDate };
    for (var k = 0; k < colKeys.length; k++) {
      var item = colKeys[k];
      record[item.key] = toNum(row[item.colIndex]);
    }

    records.push(record);
  }

  return records;
}

/**
 * ----------------------------------------------------------------------------
 * 4. ACTIVE USERS TAB PARSER
 * ----------------------------------------------------------------------------
 * Columns: A=Month(date), B=Dipali, C=Malik, D=Ramya, E=Total
 * Row 1 has headers, data starts Row 2.
 */
function parseActiveUsers(sheet, tz) {
  var values = sheet.getDataRange().getValues();
  var records = [];

  if (values.length < 2) {
    return records;
  }

  // Row 1 (index 0) has headers
  var headerRow = values[0];
  var colKeys = [];
  for (var c = 1; c < headerRow.length; c++) {
    var h = headerRow[c] ? String(headerRow[c]).trim() : '';
    if (h) {
      colKeys.push({ colIndex: c, key: h });
    }
  }

  // Fallback keys if headers are missing
  if (colKeys.length === 0) {
    colKeys = [
      { colIndex: 1, key: 'Dipali' },
      { colIndex: 2, key: 'Malik' },
      { colIndex: 3, key: 'Ramya' },
      { colIndex: 4, key: 'Total' }
    ];
  }

  // Data starts at Row 2 (index 1)
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var rawDate = row[0];

    if (rawDate === '' || rawDate === null || rawDate === undefined) {
      continue;
    }

    var formattedDate = formatDate(rawDate, tz);
    if (!formattedDate) {
      continue;
    }

    var record = { date: formattedDate };
    for (var k = 0; k < colKeys.length; k++) {
      var item = colKeys[k];
      record[item.key] = toNum(row[item.colIndex]);
    }

    records.push(record);
  }

  return records;
}

/**
 * ----------------------------------------------------------------------------
 * 5. 25+ 25- BUCKET REPORT PARSER
 * ----------------------------------------------------------------------------
 * Tabs: '25+  25- Report Mon-YYYY'
 * Contains blocks per RM with high volume (25+, cols A-G) and low volume (<25, cols I-O).
 * Each block:
 *   Row 0: RM name
 *   Row 1: Label row (High Volume / Low Volume)
 *   Row 2: Header row (Category, AB, Workable/AB, Paid AB, % Paid, Conversion, Conversion%)
 *   Row 3-5: Categories (Consistent, Reactive, Active)
 *   Row 6: Blank row
 */
function parseBucketReports(sheets) {
  var bucketAnalysis = {};

  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    var sheetName = sheet.getName().trim();

    // Extract month key (e.g. 'Oct-2026', 'Jul-2026')
    var match = sheetName.match(/^25\+\s*25-\s*Report\s+(.+)$/i);
    var monthKey = match ? match[1].trim() : sheetName;

    var values = sheet.getDataRange().getValues();
    var rmsBucket = {};

    var parseCategoryRow = function(row, startCol) {
      if (!row || row.length <= startCol) return null;
      var cat = row[startCol] !== null && row[startCol] !== undefined ? String(row[startCol]).trim() : '';
      if (!cat) return null;

      var abVal = toNum(row[startCol + 1]);
      var workableVal = toNum(row[startCol + 2]);
      var paidVal = toNum(row[startCol + 3]);
      var pctPaidVal = formatPercentage(row[startCol + 4]);
      var convVal = toNum(row[startCol + 5]);
      var convPctVal = formatPercentage(row[startCol + 6]);

      return {
        category: cat,
        ab: abVal,
        workable_per_ab: workableVal,
        paid_ab: paidVal,
        pct_paid: pctPaidVal,
        conversion: convVal,
        conversion_pct: convPctVal
      };
    };

    var r = 0;
    while (r < values.length) {
      var cellVal = values[r][0];
      if (cellVal && String(cellVal).trim() !== '') {
        var strVal = String(cellVal).trim();

        // Check if this row is an RM header row (not a subheader or label)
        var isHeaderRow = /^(Category|AB|Metric|Consistent|Reactive|Active|\d)/i.test(strVal) ||
                          strVal.indexOf('25+') !== -1 ||
                          strVal.indexOf('Volume') !== -1;

        if (!isHeaderRow) {
          var rmName = strVal;
          var highCats = [];
          var lowCats = [];

          // Expect categories at offsets +3, +4, +5 (after label row and header row)
          for (var offset = 3; offset <= 5; offset++) {
            if (r + offset < values.length) {
              var targetRow = values[r + offset];
              var highRow = parseCategoryRow(targetRow, 0); // High volume: cols 0-6 (A-G)
              var lowRow = parseCategoryRow(targetRow, 8);  // Low volume: cols 8-14 (I-O)

              if (highRow) highCats.push(highRow);
              if (lowRow) lowCats.push(lowRow);
            }
          }

          rmsBucket[rmName] = {
            high: highCats,
            low: lowCats
          };

          r += 6; // Skip past this RM block
          continue;
        }
      }
      r++;
    }

    bucketAnalysis[monthKey] = rmsBucket;
  }

  return bucketAnalysis;
}

/**
 * ----------------------------------------------------------------------------
 * UTILITY & FORMATTING FUNCTIONS
 * ----------------------------------------------------------------------------
 */

/**
 * Robust date formatting to 'YYYY-MM-DD'
 * Handles JavaScript Date objects, DD-MMM-YYYY, YYYY-MM-DD, and ISO strings.
 * 
 * @param {*} val Raw cell value
 * @param {string} tz Spreadsheet timezone
 * @returns {string} Formatted date string (YYYY-MM-DD) or empty string
 */
function formatDate(val, tz) {
  if (val === null || val === undefined || val === '') {
    return '';
  }

  // 1. Google Sheets Date Object
  if (val instanceof Date && !isNaN(val.getTime())) {
    try {
      return Utilities.formatDate(val, tz || CONFIG.DEFAULT_TIMEZONE, 'yyyy-MM-dd');
    } catch (e) {
      var y = val.getFullYear();
      var m = ('0' + (val.getMonth() + 1)).slice(-2);
      var d = ('0' + val.getDate()).slice(-2);
      return y + '-' + m + '-' + d;
    }
  }

  var str = String(val).trim();
  if (!str) return '';

  // 2. Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // 3. ISO string: 2026-07-01T...
  var isoMatch = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    return isoMatch[1];
  }

  // 4. DD-MMM-YYYY or DD/MM/YYYY (e.g., '01-Jul-2026', '24-Oct-2026')
  var dmyMatch = str.match(/^(\d{1,2})[-/ ]([A-Za-z]{3}|\d{1,2})[-/ ](\d{4})$/);
  if (dmyMatch) {
    var day = ('0' + dmyMatch[1]).slice(-2);
    var monthPart = dmyMatch[2];
    var year = dmyMatch[3];
    var months = {
      'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
      'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
      'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
    };
    var month = months[monthPart.toLowerCase()] || ('0' + monthPart).slice(-2);
    return year + '-' + month + '-' + day;
  }

  // 5. Try standard date parse
  var parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    var py = parsed.getFullYear();
    var pm = ('0' + (parsed.getMonth() + 1)).slice(-2);
    var pd = ('0' + parsed.getDate()).slice(-2);
    return py + '-' + pm + '-' + pd;
  }

  return str;
}

/**
 * Safely parses numbers from cell values, treating empty/null/NaN as 0.
 * 
 * @param {*} val Raw cell value
 * @returns {number} Numeric value
 */
function toNum(val) {
  if (val === null || val === undefined || val === '') {
    return 0;
  }
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : val;
  }
  var str = String(val).trim().replace(/,/g, '');
  var num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Formats percentage values safely.
 * Returns formatted string like '13.04%' or '0.00%'.
 * 
 * @param {*} val Cell value (number or string)
 * @returns {string} Formatted percentage
 */
function formatPercentage(val) {
  if (val === null || val === undefined || val === '') {
    return '0.0%';
  }
  var str = String(val).trim();
  if (str.indexOf('%') !== -1 || str === 'N/A') {
    return str;
  }
  var num = parseFloat(str);
  if (isNaN(num)) {
    return str;
  }
  // If float ratio (e.g. 0.1304) convert to percentage
  if (Math.abs(num) <= 1 && num !== 0) {
    return (num * 100).toFixed(1) + '%';
  }
  return num.toFixed(1) + '%';
}

/**
 * Parses metric cell in comparison reports which may be an integer,
 * a percentage string (e.g., '-14.8%'), or 'N/A'.
 * 
 * @param {*} val Raw cell value
 * @param {boolean} isPercentageRow Whether row represents Jump % or Delta
 * @returns {number|string}
 */
function parseMetricVal(val, isPercentageRow) {
  if (val === null || val === undefined || val === '') {
    return isPercentageRow ? '0.0%' : 0;
  }
  var str = String(val).trim();
  if (str.indexOf('%') !== -1 || str === 'N/A') {
    return str;
  }
  var num = parseFloat(str.replace(/,/g, ''));
  if (isNaN(num)) {
    return str;
  }
  if (isPercentageRow) {
    if (Math.abs(num) <= 1 && num !== 0) {
      return (num * 100).toFixed(1) + '%';
    }
    return num.toFixed(1) + '%';
  }
  return num;
}

/**
 * ----------------------------------------------------------------------------
 * SETUP & DIAGNOSTIC FUNCTION
 * ----------------------------------------------------------------------------
 * Run this function from the Apps Script editor toolbar to verify connection,
 * validate sheet parsing, and check the Web App deployment URL.
 */
function setup() {
  Logger.log('====================================================');
  Logger.log('RM Performance Report API - Setup & Diagnostics');
  Logger.log('====================================================');

  try {
    var ss = getSpreadsheet();
    Logger.log('✅ Connected to Spreadsheet: ' + ss.getName());
    Logger.log('   ID: ' + ss.getId());
    Logger.log('   Timezone: ' + ss.getSpreadsheetTimeZone());

    var sheetNames = ss.getSheets().map(function(s) { return s.getName(); });
    Logger.log('   Total sheets found: ' + sheetNames.length);

    Logger.log('\n--- Parsing Data Test ---');
    var data = getReportData(ss);

    var rmCount = Object.keys(data.rmDaily).length;
    Logger.log('✅ RM Daily Data: ' + rmCount + ' RMs found (' + Object.keys(data.rmDaily).join(', ') + ')');
    for (var rm in data.rmDaily) {
      Logger.log('   - ' + rm + ': ' + data.rmDaily[rm].length + ' daily records');
    }

    var compMonths = Object.keys(data.comparison);
    Logger.log('✅ Comparison Reports: ' + compMonths.length + ' months (' + compMonths.join(', ') + ')');

    Logger.log('✅ Paid AB Records: ' + data.paidAB.length);
    Logger.log('✅ Active Users Records: ' + data.activeUsers.length);

    var bucketMonths = Object.keys(data.bucketAnalysis);
    Logger.log('✅ Bucket Analysis: ' + bucketMonths.length + ' months (' + bucketMonths.join(', ') + ')');

    Logger.log('\n--- Web App Deployment Status ---');
    var serviceUrl = ScriptApp.getService().getUrl();
    if (serviceUrl) {
      Logger.log('🌐 Web App is deployed and live at:');
      Logger.log('   ' + serviceUrl);
    } else {
      Logger.log('ℹ️ Web App is not deployed yet.');
      Logger.log('   Follow the deployment steps in Code.gs header comments:');
      Logger.log('   1. Click "Deploy" > "New deployment"');
      Logger.log('   2. Select type: "Web app"');
      Logger.log('   3. Execute as: "Me"');
      Logger.log('   4. Who has access: "Anyone"');
      Logger.log('   5. Click Deploy and copy the Web App URL.');
    }

    Logger.log('\n====================================================');
    Logger.log('✅ SETUP AND VERIFICATION COMPLETE: ALL SYSTEMS READY');
    Logger.log('====================================================');

  } catch (err) {
    Logger.log('❌ SETUP ERROR: ' + err.message);
    Logger.log(err.stack);
  }
}
