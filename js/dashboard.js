/**
 * RM Performance Dashboard - Ambassador Club
 * Core Data Processing, Store & Utilities
 */

(function () {
  'use strict';

  // Master RM Configuration
  const RM_CONFIG = {
    Malik: {
      name: 'Malik',
      color: '#4F46E5', // Indigo
      subtleColor: 'rgba(79, 70, 229, 0.12)',
      zone: 'North & Chennai',
      badgeClass: 'badge-north',
      role: 'Senior RM',
      hasConversionData: true,
      dataStart: 'Dec 2025'
    },
    Ramya: {
      name: 'Ramya',
      color: '#059669', // Emerald
      subtleColor: 'rgba(5, 150, 105, 0.12)',
      zone: 'South',
      badgeClass: 'badge-south',
      role: 'Senior RM',
      hasConversionData: true,
      dataStart: 'Dec 2025'
    },
    Dipali: {
      name: 'Dipali',
      color: '#D97706', // Amber
      subtleColor: 'rgba(217, 119, 6, 0.12)',
      zone: 'West',
      badgeClass: 'badge-west',
      role: 'Senior RM',
      hasConversionData: true,
      dataStart: 'Dec 2025'
    },
    Shirish: {
      name: 'Shirish',
      color: '#7C3AED', // Violet
      subtleColor: 'rgba(124, 58, 237, 0.12)',
      zone: 'New Joiner',
      badgeClass: 'badge-new',
      role: 'New Joiner (Input Metrics)',
      hasConversionData: false,
      dataStart: 'May 2026'
    },
    Anand: {
      name: 'Anand',
      color: '#DC2626', // Red
      subtleColor: 'rgba(220, 38, 38, 0.12)',
      zone: 'New Joiner',
      badgeClass: 'badge-new',
      role: 'New Joiner (Input Metrics)',
      hasConversionData: false,
      dataStart: 'Jun 2026'
    }
  };

  const MONTH_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  // Helper Utilities
  function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return Math.round(num).toLocaleString('en-IN');
  }

  function formatPct(num, decimals = 1) {
    if (num === null || num === undefined || isNaN(num)) return '0.0%';
    return `${Number(num).toFixed(decimals)}%`;
  }

  function formatMinutes(num) {
    if (num === null || num === undefined || isNaN(num)) return '0m';
    const mins = Math.round(num);
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    if (hrs > 0) return `${hrs}h ${rem}m`;
    return `${mins}m`;
  }

  function calcMoM(curr, prev) {
    if (!prev || prev === 0) return 0;
    return ((curr - prev) / prev) * 100;
  }

  function getMonthLabel(yearMonthStr) {
    // Input '2026-10' -> 'Oct-2026'
    if (!yearMonthStr) return '';
    const parts = yearMonthStr.split('-');
    if (parts.length < 2) return yearMonthStr;
    const mIdx = parseInt(parts[1], 10) - 1;
    return `${MONTH_NAMES[mIdx]}-${parts[0]}`;
  }

  function getYearMonthFromLabel(label) {
    // Input 'Oct-2026' -> '2026-10'
    if (!label) return '';
    const parts = label.split('-');
    if (parts.length < 2) return label;
    const mIdx = MONTH_NAMES.indexOf(parts[0]);
    if (mIdx === -1) return label;
    const mm = String(mIdx + 1).padStart(2, '0');
    return `${parts[1]}-${mm}`;
  }

  // Data Fetcher
  async function fetchDashboardData() {
    const urlInput = document.getElementById('appsScriptUrl');
    const appsScriptUrl = urlInput ? urlInput.value.trim() : '';

    if (appsScriptUrl) {
      try {
        const resp = await fetch(appsScriptUrl);
        if (resp.ok) {
          const json = await resp.json();
          return processRawData(json);
        }
      } catch (e) {
        console.warn('Apps Script fetch failed, falling back to local data.', e);
      }
    }

    if (window.SAMPLE_DATA) {
      return processRawData(window.SAMPLE_DATA);
    }

    try {
      const localResp = await fetch('data.json');
      if (localResp.ok) {
        const localData = await localResp.json();
        return processRawData(localData);
      }
    } catch (e) {
      console.warn('data.json fetch failed, checking global SAMPLE_DATA');
    }

    throw new Error('Unable to load dashboard data.');
  }

  // Data Processing Engine
  function processRawData(raw) {
    const rmDaily = raw.rmDaily || {};
    const monthlyByRM = {};
    const allMonthsSet = new Set();

    // Group daily records by RM and YYYY-MM
    Object.keys(RM_CONFIG).forEach(rm => {
      const records = rmDaily[rm] || [];
      const mMap = {};

      records.forEach(r => {
        if (!r.date) return;
        const ym = r.date.substring(0, 7); // '2026-10'
        allMonthsSet.add(ym);

        if (!mMap[ym]) {
          mMap[ym] = {
            yearMonth: ym,
            label: getMonthLabel(ym),
            rm: rm,
            days: 0,
            workingDays: 0,
            consistentDays: 0, // >= 50 dials
            onboarding_dial: 0,
            onboarding_connect: 0,
            active_dial: 0,
            active_connect: 0,
            reactive_dial: 0,
            reactive_connect: 0,
            consistent_dial: 0,
            consistent_connect: 0,
            acquisition_dial: 0,
            acquisition_connect: 0,
            home_service_dial: 0,
            home_service_connect: 0,
            phone_dial: 0,
            phone_connect: 0,
            other_dial: 0,
            other_connect: 0,
            totalDials: 0,
            totalConnected: 0,
            talktime: 0,
            onboardings: 0,
            activeAbSum: 0,
            activeAbCount: 0,
            lastActiveAb: 0,
            dailyDials: []
          };
        }

        const m = mMap[ym];
        m.days++;

        const d_onboarding = Number(r.onboarding_dial || 0);
        const d_active = Number(r.active_dial || 0);
        const d_reactive = Number(r.reactive_dial || 0);
        const d_consistent = Number(r.consistent_dial || 0);
        const d_acq = Number(r.acquisition_dial || 0);
        const d_home = Number(r.home_service_dial || 0);
        const d_phone = Number(r.phone_dial || 0);
        const d_other = Number(r.other_dial || 0);

        const dayDials = d_onboarding + d_active + d_reactive + d_consistent + d_acq + d_home + d_phone + d_other;
        const dayTalk = Number(r.talktime || 0);

        m.dailyDials.push({ date: r.date, dials: dayDials, talktime: dayTalk });

        if (dayDials > 0 || dayTalk > 0) {
          m.workingDays++;
        }
        if (dayDials >= 50) {
          m.consistentDays++;
        }

        m.onboarding_dial += d_onboarding;
        m.onboarding_connect += Number(r.onboarding_connect || 0);
        m.active_dial += d_active;
        m.active_connect += Number(r.active_connect || 0);
        m.reactive_dial += d_reactive;
        m.reactive_connect += Number(r.reactive_connect || 0);
        m.consistent_dial += d_consistent;
        m.consistent_connect += Number(r.consistent_connect || 0);
        m.acquisition_dial += d_acq;
        m.acquisition_connect += Number(r.acquisition_connect || 0);
        m.home_service_dial += d_home;
        m.home_service_connect += Number(r.home_service_connect || 0);
        m.phone_dial += d_phone;
        m.phone_connect += Number(r.phone_connect || 0);
        m.other_dial += d_other;
        m.other_connect += Number(r.other_connect || 0);

        m.totalDials += dayDials;

        const sumConn = (Number(r.onboarding_connect || 0) + Number(r.active_connect || 0) +
          Number(r.reactive_connect || 0) + Number(r.consistent_connect || 0) +
          Number(r.acquisition_connect || 0) + Number(r.home_service_connect || 0) +
          Number(r.phone_connect || 0) + Number(r.other_connect || 0));
        m.totalConnected += (Number(r.total_connected || 0) || sumConn);
        m.talktime += dayTalk;
        m.onboardings += Number(r.onboardings || 0);

        const ab = Number(r.active_ab || 0);
        if (ab > 0) {
          m.activeAbSum += ab;
          m.activeAbCount++;
          m.lastActiveAb = ab;
        }
      });

      // Compute derived metrics
      Object.values(mMap).forEach(m => {
        m.connectionRate = m.totalDials > 0 ? (m.totalConnected / m.totalDials) * 100 : 0;
        m.avgTalktime = m.workingDays > 0 ? (m.talktime / m.workingDays) : 0;
        m.avgActiveAb = m.activeAbCount > 0 ? Math.round(m.activeAbSum / m.activeAbCount) : m.lastActiveAb;
        m.consistencyScore = m.workingDays > 0 ? (m.consistentDays / m.workingDays) * 100 : 0;
      });

      monthlyByRM[rm] = mMap;
    });

    const sortedMonths = Array.from(allMonthsSet).sort();

    return {
      raw: raw,
      rmDaily: rmDaily,
      monthlyByRM: monthlyByRM,
      months: sortedMonths, // e.g. ['2025-12', ..., '2026-10']
      monthLabels: sortedMonths.map(getMonthLabel),
      comparison: raw.comparison || {},
      paidAB: raw.paidAB || [],
      activeUsers: raw.activeUsers || [],
      bucketAnalysis: raw.bucketAnalysis || {},
      metadata: raw.metadata || {}
    };
  }

  // Mini Sparkline Generator (Vanilla Canvas)
  function drawSparkline(canvasId, values, color = '#4F46E5') {
    const canvas = typeof canvasId === 'string' ? document.getElementById(canvasId) : canvasId;
    if (!canvas || !values || values.length < 2) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = (max - min) || 1;
    const padding = 3;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    values.forEach((v, i) => {
      const x = padding + (i / (values.length - 1)) * (w - padding * 2);
      const y = h - padding - ((v - min) / range) * (h - padding * 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Gradient fill under sparkline
    ctx.lineTo(w - padding, h);
    ctx.lineTo(padding, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, color + '33');
    grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // Landing Page Renderer (index.html)
  function initLandingPage(data) {
    const rmList = Object.keys(RM_CONFIG);
    const latestMonth = data.months[data.months.length - 1]; // '2026-10'
    const prevMonth = data.months[data.months.length - 2];   // '2026-09'

    // Compute executive totals for latest month
    let totalDials = 0;
    let prevDials = 0;
    let totalConnected = 0;
    let totalConversions = 0;
    let totalTalktime = 0;
    let totalWorkingDays = 0;

    rmList.forEach(rm => {
      const curr = data.monthlyByRM[rm][latestMonth];
      const prev = data.monthlyByRM[rm][prevMonth];
      if (curr) {
        totalDials += curr.totalDials;
        totalConnected += curr.totalConnected;
        totalTalktime += curr.talktime;
        totalWorkingDays += curr.workingDays;
      }
      if (prev) {
        prevDials += prev.totalDials;
      }
    });

    // Conversions from Oct-2026 comparison report if available
    const compOct = data.comparison['Oct-2026'] || {};
    if (compOct.overall && compOct.overall.curr) {
      totalConversions = compOct.overall.curr.conversion || 0;
    }

    const teamConnRate = totalDials > 0 ? (totalConnected / totalDials) * 100 : 0;
    const teamAvgTalk = totalWorkingDays > 0 ? totalTalktime / totalWorkingDays : 0;
    const dialsMoM = calcMoM(totalDials, prevDials);

    // Update KPI cards on index.html
    const elDials = document.getElementById('hubTotalDials');
    const elConnRate = document.getElementById('hubConnRate');
    const elConversions = document.getElementById('hubConversions');
    const elTalktime = document.getElementById('hubAvgTalktime');

    if (elDials) elDials.textContent = formatNumber(totalDials);
    if (elConnRate) elConnRate.textContent = formatPct(teamConnRate);
    if (elConversions) elConversions.textContent = formatNumber(totalConversions);
    if (elTalktime) elTalktime.textContent = formatMinutes(teamAvgTalk);

    const elMoM = document.getElementById('hubDialsMoM');
    if (elMoM) {
      const isPos = dialsMoM >= 0;
      elMoM.className = `kpi-delta ${isPos ? 'positive' : 'negative'}`;
      elMoM.innerHTML = `${isPos ? '↑' : '↓'} ${Math.abs(dialsMoM).toFixed(1)}% MoM`;
    }

    // Render RM Preview Cards
    const previewGrid = document.getElementById('rmPreviewGrid');
    if (previewGrid) {
      previewGrid.innerHTML = '';
      rmList.forEach(rm => {
        const conf = RM_CONFIG[rm];
        const m = data.monthlyByRM[rm][latestMonth] || {};
        const initials = rm.substring(0, 2).toUpperCase();

        const card = document.createElement('a');
        card.className = 'rm-preview-card';
        card.setAttribute('data-rm', rm);
        card.href = `profile.html?rm=${encodeURIComponent(rm)}`;
        card.innerHTML = `
          <div class="rm-preview-avatar" style="background: ${conf.color}">
            ${initials}
          </div>
          <div class="rm-preview-name">${conf.name}</div>
          <div class="rm-preview-zone">${conf.zone} • ${conf.role}</div>
          <div class="rm-preview-stats">
            <div class="rm-preview-stat-row">
              <span class="lbl">Dials (MTD)</span>
              <span class="val">${formatNumber(m.totalDials || 0)}</span>
            </div>
            <div class="rm-preview-stat-row">
              <span class="lbl">Connect Rate</span>
              <span class="val">${formatPct(m.connectionRate || 0)}</span>
            </div>
            <div class="rm-preview-stat-row">
              <span class="lbl">Avg Talktime</span>
              <span class="val">${formatMinutes(m.avgTalktime || 0)}</span>
            </div>
            <div class="rm-preview-stat-row">
              <span class="lbl">Consistency</span>
              <span class="val">${formatPct(m.consistencyScore || 0, 0)}</span>
            </div>
          </div>
          <div style="margin-top: 1rem; font-size: 0.8rem; font-weight: 700; color: ${conf.color};">
            View Deep Dive →
          </div>
        `;
        previewGrid.appendChild(card);
      });
    }

    // Update last updated timestamp
    const tsEl = document.getElementById('lastUpdatedTs');
    if (tsEl && data.metadata && data.metadata.lastUpdated) {
      const dt = new Date(data.metadata.lastUpdated);
      tsEl.textContent = isNaN(dt) ? data.metadata.lastUpdated : dt.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    }
  }

  // Loading Screen Toggle
  function hideLoader() {
    const loader = document.getElementById('loadingOverlay');
    if (loader) {
      loader.classList.add('hidden');
    }
  }

  function showLoader(text = 'Loading dashboard...') {
    const loader = document.getElementById('loadingOverlay');
    if (loader) {
      const textEl = loader.querySelector('.loading-text');
      if (textEl) textEl.textContent = text;
      loader.classList.remove('hidden');
    }
  }

  // Export Namespace
  window.RM_DASHBOARD = {
    RM_CONFIG,
    MONTH_NAMES,
    formatNumber,
    formatPct,
    formatMinutes,
    calcMoM,
    getMonthLabel,
    getYearMonthFromLabel,
    fetchDashboardData,
    processRawData,
    drawSparkline,
    initLandingPage,
    hideLoader,
    showLoader
  };

})();
