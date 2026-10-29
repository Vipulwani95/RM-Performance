/**
 * RM Performance Dashboard - Ambassador Club
 * RM Profile Individual Deep Dive View Controller (profile.html)
 */

(function () {
  'use strict';

  const {
    RM_CONFIG,
    formatNumber,
    formatPct,
    formatMinutes,
    calcMoM,
    getMonthLabel,
    getYearMonthFromLabel,
    fetchDashboardData,
    drawSparkline,
    hideLoader,
    showLoader
  } = window.RM_DASHBOARD;

  let dashboardData = null;
  let activeRM = 'Malik';
  let activeMonth = '2026-10';
  let selectedProfMonths = new Set();
  let comparisonMonth = 'Oct-2026';

  // Chart Registry for destroying old instances
  const chartRegistry = {};

  function registerChart(canvasId, chart) {
    if (chartRegistry[canvasId]) {
      chartRegistry[canvasId].destroy();
    }
    chartRegistry[canvasId] = chart;
    return chart;
  }

  function destroyAllCharts() {
    Object.keys(chartRegistry).forEach(id => {
      if (chartRegistry[id]) {
        chartRegistry[id].destroy();
        delete chartRegistry[id];
      }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    showLoader('Loading RM profile...');
    try {
      dashboardData = await fetchDashboardData();

      // Check URL query param ?rm=Name
      const params = new URLSearchParams(window.location.search);
      const urlRm = params.get('rm');
      if (urlRm && RM_CONFIG[urlRm]) {
        activeRM = urlRm;
      }

      initProfileControls();
      renderFullProfile();
    } catch (err) {
      console.error(err);
      alert('Error loading profile data. Please check console.');
    } finally {
      hideLoader();
    }
  });

  function initProfileControls() {
    // RM Dropdown
    const rmSelect = document.getElementById('profileRmSelect');
    if (rmSelect) {
      rmSelect.innerHTML = '';
      Object.keys(RM_CONFIG).forEach(rm => {
        const opt = document.createElement('option');
        opt.value = rm;
        opt.textContent = `${rm} (${RM_CONFIG[rm].zone})`;
        if (rm === activeRM) opt.selected = true;
        rmSelect.appendChild(opt);
      });

      rmSelect.addEventListener('change', (e) => {
        activeRM = e.target.value;
        // Update URL query param cleanly without reload
        const newUrl = `${window.location.pathname}?rm=${encodeURIComponent(activeRM)}`;
        window.history.pushState({ rm: activeRM }, '', newUrl);
        renderFullProfile();
      });
    }

    // Default: selectedProfMonths contains all months
    selectedProfMonths = new Set(dashboardData.months);
    activeMonth = dashboardData.months[dashboardData.months.length - 1]; // latest month
    comparisonMonth = getMonthLabel(activeMonth);

    function syncProfActiveMonth() {
      const sorted = dashboardData.months.filter(m => selectedProfMonths.has(m));
      if (sorted.length > 0) {
        activeMonth = sorted[sorted.length - 1];
        comparisonMonth = getMonthLabel(activeMonth);
      }
    }

    // Unified Month Filter Pills for Profile
    const profMonthToggleContainer = document.getElementById('profMonthToggleGroup');
    if (profMonthToggleContainer) {
      profMonthToggleContainer.innerHTML = '';
      const revMonths = [...dashboardData.months].reverse();
      revMonths.forEach(ym => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'month-toggle-btn active';
        btn.setAttribute('data-ym', ym);
        btn.textContent = getMonthLabel(ym);

        btn.addEventListener('click', () => {
          if (selectedProfMonths.has(ym)) {
            if (selectedProfMonths.size > 1) {
              selectedProfMonths.delete(ym);
              btn.classList.remove('active');
            }
          } else {
            selectedProfMonths.add(ym);
            btn.classList.add('active');
          }
          syncProfActiveMonth();
          renderFullProfile();
        });
        profMonthToggleContainer.appendChild(btn);
      });
    }

    // Quick Month Shortcuts for Profile
    const btnAll = document.getElementById('btnProfAllMonths');
    if (btnAll) {
      btnAll.addEventListener('click', () => {
        selectedProfMonths = new Set(dashboardData.months);
        syncProfActiveMonth();
        updateProfMonthToggleButtons();
        renderFullProfile();
      });
    }

    const btnLast3 = document.getElementById('btnProfLast3Months');
    if (btnLast3) {
      btnLast3.addEventListener('click', () => {
        selectedProfMonths = new Set(dashboardData.months.slice(-3));
        syncProfActiveMonth();
        updateProfMonthToggleButtons();
        renderFullProfile();
      });
    }

    const btnCurrentOnly = document.getElementById('btnProfCurrentOnly');
    if (btnCurrentOnly) {
      btnCurrentOnly.addEventListener('click', () => {
        const latest = dashboardData.months[dashboardData.months.length - 1];
        selectedProfMonths = new Set([latest]);
        syncProfActiveMonth();
        updateProfMonthToggleButtons();
        renderFullProfile();
      });
    }

    // Last updated
    const tsEl = document.getElementById('lastUpdatedTs');
    if (tsEl && dashboardData.metadata && dashboardData.metadata.lastUpdated) {
      const dt = new Date(dashboardData.metadata.lastUpdated);
      tsEl.textContent = isNaN(dt) ? dashboardData.metadata.lastUpdated : dt.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    }
  }

  function updateProfMonthToggleButtons() {
    document.querySelectorAll('#profMonthToggleGroup .month-toggle-btn').forEach(btn => {
      const ym = btn.getAttribute('data-ym');
      if (selectedProfMonths.has(ym)) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }

  function renderFullProfile() {
    destroyAllCharts();
    renderProfileHeader();
    renderKPISummary();
    renderMonthlyTrends();
    renderDialComposition();
    renderTalktimeHeatmap();
    renderConversionSection();
    renderBucketAnalysis();
    renderConsistencySection();
  }

  // =========================================================================
  // PROFILE HEADER
  // =========================================================================
  function renderProfileHeader() {
    const conf = RM_CONFIG[activeRM];
    const m = dashboardData.monthlyByRM[activeRM][activeMonth] || {};
    const root = document.documentElement;
    root.style.setProperty('--profile-color', conf.color);

    const nameEl = document.getElementById('profName');
    const zoneBadge = document.getElementById('profZoneBadge');
    const tenureEl = document.getElementById('profTenure');
    const avatarEl = document.getElementById('profAvatar');

    if (nameEl) nameEl.textContent = conf.name;
    if (zoneBadge) {
      zoneBadge.className = `zone-badge ${conf.badgeClass}`;
      zoneBadge.textContent = conf.zone;
    }
    if (tenureEl) {
      tenureEl.textContent = `${conf.role} • Data Tracking: ${conf.dataStart} – Oct 2026`;
    }
    if (avatarEl) {
      avatarEl.textContent = activeRM.substring(0, 2).toUpperCase();
      avatarEl.style.backgroundColor = conf.color;
    }

    // Banner Quick Stats
    const bDials = document.getElementById('profBannerDials');
    const bConn = document.getElementById('profBannerConnRate');
    const bTalk = document.getElementById('profBannerTalktime');
    const bCons = document.getElementById('profBannerConsistency');

    if (bDials) bDials.textContent = formatNumber(m.totalDials || 0);
    if (bConn) bConn.textContent = formatPct(m.connectionRate || 0);
    if (bTalk) bTalk.textContent = formatMinutes(m.avgTalktime || 0);
    if (bCons) bCons.textContent = formatPct(m.consistencyScore || 0, 0);
  }

  // =========================================================================
  // SECTION A: KPI SUMMARY (6 SCORECARDS)
  // =========================================================================
  function renderKPISummary() {
    const prevMonthIdx = dashboardData.months.indexOf(activeMonth) - 1;
    const prevMonth = prevMonthIdx >= 0 ? dashboardData.months[prevMonthIdx] : null;

    const curr = dashboardData.monthlyByRM[activeRM][activeMonth] || {};
    const prev = prevMonth ? dashboardData.monthlyByRM[activeRM][prevMonth] || {} : {};

    const dialsMoM = calcMoM(curr.totalDials, prev.totalDials);
    const connMoM = calcMoM(curr.totalConnected, prev.totalConnected);
    const rateDelta = (curr.connectionRate || 0) - (prev.connectionRate || 0);
    const talkMoM = calcMoM(curr.avgTalktime, prev.avgTalktime);
    const onbMoM = calcMoM(curr.onboardings, prev.onboardings);
    const abMoM = calcMoM(curr.avgActiveAb, prev.avgActiveAb);

    const conf = RM_CONFIG[activeRM];

    // Set KPI Values
    document.getElementById('kpiProfDials').textContent = formatNumber(curr.totalDials || 0);
    document.getElementById('kpiProfConnected').textContent = formatNumber(curr.totalConnected || 0);
    document.getElementById('kpiProfRate').textContent = formatPct(curr.connectionRate || 0);
    document.getElementById('kpiProfTalktime').textContent = formatMinutes(curr.avgTalktime || 0);
    document.getElementById('kpiProfOnboardings').textContent = formatNumber(curr.onboardings || 0);
    document.getElementById('kpiProfActiveAb').textContent = formatNumber(curr.avgActiveAb || curr.lastActiveAb || 0);

    // Set Deltas
    setDelta('deltaProfDials', dialsMoM, '%');
    setDelta('deltaProfConnected', connMoM, '%');
    setDelta('deltaProfRate', rateDelta, '% pts');
    setDelta('deltaProfTalktime', talkMoM, '%');
    setDelta('deltaProfOnboardings', onbMoM, '%');
    setDelta('deltaProfActiveAb', abMoM, '%');

    // Display Daily Average Pace
    const workingDays = curr.workingDays || 1;
    const avgDialsPerDay = Math.round((curr.totalDials || 0) / workingDays);
    const avgConnPerDay = Math.round((curr.totalConnected || 0) / workingDays);

    const paceDialsEl = document.getElementById('paceProfDials');
    if (paceDialsEl) paceDialsEl.textContent = `Avg ${avgDialsPerDay}/day (${workingDays}d)`;

    const paceConnEl = document.getElementById('paceProfConnected');
    if (paceConnEl) paceConnEl.textContent = `Avg ${avgConnPerDay}/day (${workingDays}d)`;
  }

  function setDelta(elementId, delta, suffix = '%') {
    const el = document.getElementById(elementId);
    if (!el) return;
    const isPos = delta >= 0;
    el.className = `kpi-delta ${isPos ? 'positive' : 'negative'}`;
    el.innerHTML = `${isPos ? '↑' : '↓'} ${Math.abs(delta).toFixed(1)}${suffix}`;
  }

  // =========================================================================
  // SECTION B: MONTHLY TRENDS (THEIR DATA ONLY - 8 CLEAN CHARTS)
  // =========================================================================
  function renderMonthlyTrends() {
    const conf = RM_CONFIG[activeRM];
    const col = conf.color;
    const mData = dashboardData.monthlyByRM[activeRM];

    // Determine if single-month daily view or multi-month trend
    const isSingleMonth = selectedProfMonths.size === 1;
    const singleMonthKey = isSingleMonth ? Array.from(selectedProfMonths)[0] : null;

    // Update Section Title & Subtitle dynamically
    const titleEl = document.getElementById('profTrendsSectionTitle');
    const subtitleEl = document.getElementById('profTrendsSectionSubtitle');
    if (isSingleMonth) {
      if (titleEl) titleEl.textContent = `Section B: Day-by-Day Daily Performance (${getMonthLabel(singleMonthKey)})`;
      if (subtitleEl) subtitleEl.textContent = `Day-wise granular activity tracking for ${activeRM} throughout ${getMonthLabel(singleMonthKey)}`;
    } else {
      if (titleEl) titleEl.textContent = 'Section B: Month-on-Month Performance Trends';
      if (subtitleEl) subtitleEl.textContent = `Dedicated multi-month progression isolating ${activeRM}'s performance trajectory across selected months`;
    }

    if (isSingleMonth) {
      // DAY-WISE MODE for selected single month
      const dailyRecords = (dashboardData.rmDaily[activeRM] || [])
        .filter(r => r.date && r.date.startsWith(singleMonthKey))
        .sort((a, b) => a.date.localeCompare(b.date));

      const labels = dailyRecords.map(r => r.date.substring(8, 10)); // Day of month

      // 1. Dials
      createSingleLineChart('chartProfDials', labels, [{
        label: 'Daily Dials',
        data: dailyRecords.map(r => {
          return Number(r.onboarding_dial || 0) + Number(r.active_dial || 0) +
            Number(r.reactive_dial || 0) + Number(r.consistent_dial || 0) +
            Number(r.acquisition_dial || 0) + Number(r.home_service_dial || 0) +
            Number(r.phone_dial || 0) + Number(r.other_dial || 0);
        }),
        borderColor: col,
        backgroundColor: conf.subtleColor,
        fill: true,
        borderWidth: 2.5,
        pointRadius: 3,
        tension: 0.2
      }], 'Calls');

      // 2. Connected Calls
      createSingleLineChart('chartProfConnect', labels, [{
        label: 'Daily Connected',
        data: dailyRecords.map(r => Number(r.total_connected || 0)),
        borderColor: col,
        backgroundColor: conf.subtleColor,
        fill: true,
        borderWidth: 2.5,
        pointRadius: 3,
        tension: 0.2
      }], 'Calls');

      // 3. Connection Rate %
      createSingleLineChart('chartProfRate', labels, [{
        label: 'Daily Connect %',
        data: dailyRecords.map(r => {
          const d = Number(r.onboarding_dial || 0) + Number(r.active_dial || 0) +
            Number(r.reactive_dial || 0) + Number(r.consistent_dial || 0) +
            Number(r.acquisition_dial || 0) + Number(r.home_service_dial || 0) +
            Number(r.phone_dial || 0) + Number(r.other_dial || 0);
          const c = Number(r.total_connected || 0);
          return d > 0 ? Number(((c / d) * 100).toFixed(1)) : 0;
        }),
        borderColor: col,
        backgroundColor: conf.subtleColor,
        fill: true,
        borderWidth: 2.5,
        pointRadius: 3,
        tension: 0.2
      }], '%', '%');

      // 4. Daily Talktime
      createSingleLineChart('chartProfTalktime', labels, [{
        label: 'Daily Talktime (min)',
        data: dailyRecords.map(r => Number(r.talktime || 0)),
        borderColor: col,
        backgroundColor: conf.subtleColor,
        fill: true,
        borderWidth: 2.5,
        pointRadius: 3,
        tension: 0.2
      }], 'Minutes', 'm');

      // 5. Onboardings
      createSingleLineChart('chartProfOnboardings', labels, [{
        label: 'Daily Onboardings',
        data: dailyRecords.map(r => Number(r.onboardings || 0)),
        borderColor: col,
        backgroundColor: conf.subtleColor,
        fill: true,
        borderWidth: 2.5,
        pointRadius: 3,
        tension: 0.2
      }], 'Onboardings');

      // 6. Active Followups (Daily Dial vs Connect)
      createSingleLineChart('chartProfActiveFollowup', labels, [
        {
          label: 'Active - Dial',
          data: dailyRecords.map(r => Number(r.active_dial || 0)),
          borderColor: col,
          backgroundColor: col,
          borderWidth: 2.5,
          pointRadius: 3,
          tension: 0.2
        },
        {
          label: 'Active - Connect',
          data: dailyRecords.map(r => Number(r.active_connect || 0)),
          borderColor: col,
          backgroundColor: col,
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 3,
          tension: 0.2
        }
      ], 'Calls');

      // 7. Reactive Followups (Daily Dial vs Connect)
      createSingleLineChart('chartProfReactiveFollowup', labels, [
        {
          label: 'Reactive - Dial',
          data: dailyRecords.map(r => Number(r.reactive_dial || 0)),
          borderColor: col,
          backgroundColor: col,
          borderWidth: 2.5,
          pointRadius: 3,
          tension: 0.2
        },
        {
          label: 'Reactive - Connect',
          data: dailyRecords.map(r => Number(r.reactive_connect || 0)),
          borderColor: col,
          backgroundColor: col,
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 3,
          tension: 0.2
        }
      ], 'Calls');

      // 8. Consistent Followups (Daily Dial vs Connect)
      createSingleLineChart('chartProfConsistentFollowup', labels, [
        {
          label: 'Consistent - Dial',
          data: dailyRecords.map(r => Number(r.consistent_dial || 0)),
          borderColor: col,
          backgroundColor: col,
          borderWidth: 2.5,
          pointRadius: 3,
          tension: 0.2
        },
        {
          label: 'Consistent - Connect',
          data: dailyRecords.map(r => Number(r.consistent_connect || 0)),
          borderColor: col,
          backgroundColor: col,
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 3,
          tension: 0.2
        }
      ], 'Calls');

    } else {
      // MULTI-MONTH MODE across selected months
      const months = dashboardData.months.filter(m => selectedProfMonths.has(m));
      const labels = months.map(getMonthLabel);

      // 1. Total Dial Calls per Month
      createSingleLineChart('chartProfDials', labels, [{
        label: 'Total Dials',
        data: months.map(m => (mData[m] || {}).totalDials || 0),
        borderColor: col,
        backgroundColor: conf.subtleColor,
        fill: true,
        borderWidth: 3,
        pointRadius: 4,
        tension: 0.25
      }], 'Calls');

      // 2. Total Connected Calls per Month
      createSingleLineChart('chartProfConnect', labels, [{
        label: 'Connected Calls',
        data: months.map(m => (mData[m] || {}).totalConnected || 0),
        borderColor: col,
        backgroundColor: conf.subtleColor,
        fill: true,
        borderWidth: 3,
        pointRadius: 4,
        tension: 0.25
      }], 'Calls');

      // 3. Connection Rate % per Month
      createSingleLineChart('chartProfRate', labels, [{
        label: 'Connection Rate %',
        data: months.map(m => Number(((mData[m] || {}).connectionRate || 0).toFixed(1))),
        borderColor: col,
        backgroundColor: conf.subtleColor,
        fill: true,
        borderWidth: 3,
        pointRadius: 4,
        tension: 0.25
      }], '%', '%');

      // 4. Average Daily Talktime per Month
      createSingleLineChart('chartProfTalktime', labels, [{
        label: 'Avg Daily Talktime (min)',
        data: months.map(m => Math.round((mData[m] || {}).avgTalktime || 0)),
        borderColor: col,
        backgroundColor: conf.subtleColor,
        fill: true,
        borderWidth: 3,
        pointRadius: 4,
        tension: 0.25
      }], 'Minutes', 'm');

      // 5. Total Onboardings per Month
      createSingleLineChart('chartProfOnboardings', labels, [{
        label: 'Onboardings',
        data: months.map(m => (mData[m] || {}).onboardings || 0),
        borderColor: col,
        backgroundColor: conf.subtleColor,
        fill: true,
        borderWidth: 3,
        pointRadius: 4,
        tension: 0.25
      }], 'Onboardings');

      // 6. Active Followups: Dial (solid) + Connect (dashed)
      createSingleLineChart('chartProfActiveFollowup', labels, [
        {
          label: 'Active - Dial',
          data: months.map(m => (mData[m] || {}).active_dial || 0),
          borderColor: col,
          backgroundColor: col,
          borderWidth: 3,
          pointRadius: 4,
          tension: 0.25
        },
        {
          label: 'Active - Connect',
          data: months.map(m => (mData[m] || {}).active_connect || 0),
          borderColor: col,
          backgroundColor: col,
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 3.5,
          tension: 0.25
        }
      ], 'Calls');

      // 7. Reactive Followups: Dial (solid) + Connect (dashed)
      createSingleLineChart('chartProfReactiveFollowup', labels, [
        {
          label: 'Reactive - Dial',
          data: months.map(m => (mData[m] || {}).reactive_dial || 0),
          borderColor: col,
          backgroundColor: col,
          borderWidth: 3,
          pointRadius: 4,
          tension: 0.25
        },
        {
          label: 'Reactive - Connect',
          data: months.map(m => (mData[m] || {}).reactive_connect || 0),
          borderColor: col,
          backgroundColor: col,
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 3.5,
          tension: 0.25
        }
      ], 'Calls');

      // 8. Consistent Followups: Dial (solid) + Connect (dashed)
      createSingleLineChart('chartProfConsistentFollowup', labels, [
        {
          label: 'Consistent - Dial',
          data: months.map(m => (mData[m] || {}).consistent_dial || 0),
          borderColor: col,
          backgroundColor: col,
          borderWidth: 3,
          pointRadius: 4,
          tension: 0.25
        },
        {
          label: 'Consistent - Connect',
          data: months.map(m => (mData[m] || {}).consistent_connect || 0),
          borderColor: col,
          backgroundColor: col,
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 3.5,
          tension: 0.25
        }
      ], 'Calls');
    }
  }

  function createSingleLineChart(canvasId, labels, datasets, unitLabel, unitSuffix = '') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 14,
              boxHeight: 4,
              font: { family: 'Inter', size: 11, weight: 600 },
              color: '#475569'
            }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('en-IN')}${unitSuffix}`
            }
          }
        },
        scales: {
          x: { grid: { color: '#f1f5f9' }, ticks: { font: { family: 'Inter', size: 11 } } },
          y: {
            beginAtZero: true,
            grid: { color: '#f1f5f9' },
            ticks: {
              font: { family: 'Inter', size: 11 },
              callback: v => v.toLocaleString('en-IN') + unitSuffix
            }
          }
        }
      }
    });

    registerChart(canvasId, chart);
  }

  // =========================================================================
  // SECTION C: DIAL COMPOSITION (STACKED BAR + DONUT)
  // =========================================================================
  function renderDialComposition() {
    const mData = dashboardData.monthlyByRM[activeRM];
    const months = dashboardData.months;
    const labels = dashboardData.monthLabels;

    const types = [
      { key: 'onboarding_dial', label: 'Onboarding', color: '#6366F1' },
      { key: 'active_dial', label: 'Active', color: '#10B981' },
      { key: 'reactive_dial', label: 'Reactive', color: '#F59E0B' },
      { key: 'consistent_dial', label: 'Consistent', color: '#EC4899' },
      { key: 'acquisition_dial', label: 'Acquisition', color: '#8B5CF6' },
      { key: 'home_service_dial', label: 'Home Service', color: '#14B8A6' },
      { key: 'phone_dial', label: 'Phone', color: '#06B6D4' },
      { key: 'other_dial', label: 'Other', color: '#94A3B8' }
    ];

    // Stacked Bar Across Months
    const barCanvas = document.getElementById('chartProfDialStacked');
    if (barCanvas) {
      const datasets = types.map(t => ({
        label: t.label,
        data: months.map(m => (mData[m] || {})[t.key] || 0),
        backgroundColor: t.color,
        borderRadius: 3
      }));

      const chart = new Chart(barCanvas.getContext('2d'), {
        type: 'bar',
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } } },
            tooltip: {
              backgroundColor: '#0f172a',
              callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('en-IN')}` }
            }
          },
          scales: {
            x: { stacked: true, grid: { display: false } },
            y: { stacked: true, grid: { color: '#f1f5f9' }, ticks: { callback: v => v.toLocaleString('en-IN') } }
          }
        }
      });
      registerChart('chartProfDialStacked', chart);
    }

    // Donut for Active Month Split
    const donutCanvas = document.getElementById('chartProfDialDonut');
    if (donutCanvas) {
      const curr = mData[activeMonth] || {};
      const donutValues = types.map(t => curr[t.key] || 0);

      const chart = new Chart(donutCanvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: types.map(t => t.label),
          datasets: [{
            data: donutValues,
            backgroundColor: types.map(t => t.color),
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right', labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } } },
            tooltip: {
              backgroundColor: '#0f172a',
              callbacks: {
                label: ctx => {
                  const val = ctx.parsed || 0;
                  const total = curr.totalDials || 1;
                  const pct = ((val / total) * 100).toFixed(1);
                  return ` ${ctx.label}: ${val.toLocaleString('en-IN')} (${pct}%)`;
                }
              }
            }
          }
        }
      });
      registerChart('chartProfDialDonut', chart);
    }
  }

  // =========================================================================
  // SECTION D: TALKTIME HEATMAP (CALENDAR GRID)
  // =========================================================================
  function renderTalktimeHeatmap() {
    const container = document.getElementById('profHeatmapContainer');
    if (!container) return;
    container.innerHTML = '';

    const records = (dashboardData.rmDaily[activeRM] || []).filter(r => r.date && r.date.startsWith(activeMonth));
    const totalTalk = records.reduce((acc, r) => acc + Number(r.talktime || 0), 0);
    const avgTalk = records.length > 0 ? totalTalk / records.length : 0;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
        <span style="font-weight: 700; font-size: 0.95rem;">${getMonthLabel(activeMonth)} Daily Talktime Distribution</span>
        <span style="font-size: 0.82rem; color: var(--text-muted);">
          Total: <strong>${formatMinutes(totalTalk)}</strong> • Avg: <strong>${formatMinutes(avgTalk)}/day</strong>
        </span>
      </div>
    `;

    const grid = document.createElement('div');
    grid.className = 'heatmap-grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(36px, 1fr))';

    records.forEach(r => {
      const mins = Number(r.talktime || 0);
      let lvl = 'hm-lvl-0';
      if (mins > 0 && mins < 30) lvl = 'hm-lvl-1';
      else if (mins >= 30 && mins < 60) lvl = 'hm-lvl-2';
      else if (mins >= 60 && mins < 90) lvl = 'hm-lvl-3';
      else if (mins >= 90) lvl = 'hm-lvl-4';

      const dayNum = parseInt(r.date.split('-')[2], 10);
      const cell = document.createElement('div');
      cell.className = `heatmap-cell ${lvl}`;
      cell.textContent = dayNum;
      cell.title = `Date: ${r.date}\nTalktime: ${mins} minutes\nTotal Connected: ${formatNumber(r.total_connected || 0)}`;
      grid.appendChild(cell);
    });

    wrapper.appendChild(grid);
    container.appendChild(wrapper);
  }

  // =========================================================================
  // SECTION E: CONVERSION SECTION (SENIOR RMS ONLY)
  // =========================================================================
  function renderConversionSection() {
    const sectionContainer = document.getElementById('profConversionSection');
    if (!sectionContainer) return;

    const conf = RM_CONFIG[activeRM];
    if (!conf.hasConversionData) {
      sectionContainer.innerHTML = `
        <div class="card" style="padding: 2.5rem; text-align: center; background: #f8fafc;">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">ℹ️</div>
          <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.4rem;">
            Conversion Metrics Not Applicable
          </h3>
          <p style="color: var(--text-muted); max-width: 500px; margin: 0 auto; font-size: 0.88rem;">
            ${activeRM} is in the <strong>${conf.role}</strong> cohort. Performance tracking is currently focused on input and activity metrics (Dials, Connections, Talktime, and Consistency).
          </p>
        </div>
      `;
      return;
    }

    // Restore full conversion UI
    sectionContainer.innerHTML = `
      <div class="card" style="margin-bottom: 1.75rem;">
        <div class="card-header">
          <div>
            <div class="card-title">Conversion Funnel (${comparisonMonth})</div>
            <div class="card-subtitle">Total Leads → Workable Leads → Conversions</div>
          </div>
        </div>
        <div class="card-body" id="profFunnelContainer"></div>
      </div>

      <div class="grid-2">
        <div class="chart-card">
          <div class="card-title">Daily Paid AB Trend (${comparisonMonth})</div>
          <div class="chart-wrapper">
            <canvas id="chartProfPaidAb"></canvas>
          </div>
        </div>
        <div class="chart-card">
          <div class="card-title">Daily Active Users Trend (${comparisonMonth})</div>
          <div class="chart-wrapper">
            <canvas id="chartProfActiveUsers"></canvas>
          </div>
        </div>
      </div>
    `;

    // Render Funnel
    const funnelContainer = document.getElementById('profFunnelContainer');
    const comp = dashboardData.comparison[comparisonMonth];
    if (comp && comp.rms && comp.rms[activeRM] && comp.rms[activeRM].curr) {
      const curr = comp.rms[activeRM].curr;
      const totalLeads = curr.totalLeads || 1;
      const workable = curr.workableLeads || 0;
      const conv = curr.conversion || 0;
      const convPct = curr.conversionPct || '0%';
      const convNum = parseFloat(convPct) || 0;
      // Proportional bar widths:
      // Total Leads = 100%
      // Workable = (workable / totalLeads) * 100
      // Conversions = (conv / totalLeads) * 100 = (workable/totalLeads) * (conv/workable)
      const convRealPct = ((conv / totalLeads) * 100).toFixed(1);
      const convBarWidth = Math.max(10, Math.min(parseFloat(workPct), (conv / totalLeads) * 100));

      funnelContainer.innerHTML = `
        <div class="funnel-container">
          <div class="funnel-row">
            <div class="funnel-label"><strong>${activeRM} Leads</strong></div>
            <div class="funnel-bars-group">
              <div class="funnel-bar-track" title="Total Leads: ${formatNumber(totalLeads)}">
                <div class="funnel-bar-fill" style="width: 100%; background: #64748b;">
                  Total Leads: ${formatNumber(totalLeads)} (100%)
                </div>
              </div>
              <div class="funnel-bar-track" title="Workable Leads: ${formatNumber(workable)} (${workPct}% of Total)">
                <div class="funnel-bar-fill" style="width: ${workPct}%; background: ${conf.color};">
                  Workable: ${formatNumber(workable)} (${workPct}%)
                </div>
              </div>
              <div class="funnel-bar-track" title="Conversions: ${formatNumber(conv)} (${convPct} of Workable, ${convRealPct}% of Total)">
                <div class="funnel-bar-fill" style="width: ${convBarWidth}%; background: #10b981;">
                  Conversions: ${formatNumber(conv)} (${convPct} of Workable)
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // Render Paid AB
    const paidCanvas = document.getElementById('chartProfPaidAb');
    if (paidCanvas) {
      const ymPrefix = getYearMonthFromLabel(comparisonMonth);
      const filtered = (dashboardData.paidAB || []).filter(r => r.date && r.date.startsWith(ymPrefix));
      const labels = filtered.map(r => r.date.substring(8, 10));

      const chart = new Chart(paidCanvas.getContext('2d'), {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Paid AB',
            data: filtered.map(r => r[activeRM] || 0),
            borderColor: conf.color,
            backgroundColor: conf.subtleColor,
            fill: true,
            borderWidth: 2.5,
            pointRadius: 3,
            tension: 0.2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { beginAtZero: true } }
        }
      });
      registerChart('chartProfPaidAb', chart);
    }

    // Render Active Users
    const actCanvas = document.getElementById('chartProfActiveUsers');
    if (actCanvas) {
      const ymPrefix = getYearMonthFromLabel(comparisonMonth);
      const filtered = (dashboardData.activeUsers || []).filter(r => r.date && r.date.startsWith(ymPrefix));
      const labels = filtered.map(r => r.date.substring(8, 10));

      const chart = new Chart(actCanvas.getContext('2d'), {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Active Users',
            data: filtered.map(r => r[activeRM] || 0),
            borderColor: conf.color,
            backgroundColor: conf.subtleColor,
            fill: true,
            borderWidth: 2.5,
            pointRadius: 3,
            tension: 0.2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { beginAtZero: true } }
        }
      });
      registerChart('chartProfActiveUsers', chart);
    }
  }

  // =========================================================================
  // SECTION F: 25+/25- BUCKET ANALYSIS
  // =========================================================================
  function renderBucketAnalysis() {
    const container = document.getElementById('profBucketSection');
    if (!container) return;

    const conf = RM_CONFIG[activeRM];
    if (!conf.hasConversionData) {
      container.style.display = 'none';
      return;
    }
    container.style.display = 'block';

    const bData = dashboardData.bucketAnalysis[comparisonMonth];
    const rObj = bData ? bData[activeRM] : null;

    if (!rObj) {
      container.innerHTML = `<div class="card" style="padding: 1.5rem; color: var(--text-muted); text-align: center;">No 25+/25- bucket report for ${comparisonMonth}</div>`;
      return;
    }

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">25+ / <25 Volume Bucket Breakdown (${comparisonMonth})</div>
            <div class="card-subtitle">Performance comparison between High and Low volume lead clusters</div>
          </div>
        </div>
        <div class="bucket-wrapper">
          <div class="bucket-column">
            <div class="bucket-header high">
              <span>📈 25+ (High Volume)</span>
            </div>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>AB</th>
                  <th>Workable/AB</th>
                  <th>Paid AB</th>
                  <th>% Paid</th>
                  <th>Conversion</th>
                  <th>Conv %</th>
                </tr>
              </thead>
              <tbody>
                ${rObj.high.map(row => `
                  <tr>
                    <td><strong>${row.category}</strong></td>
                    <td>${formatNumber(row.ab)}</td>
                    <td>${row.workable_per_ab}</td>
                    <td>${formatNumber(row.paid_ab)}</td>
                    <td><span class="cell-badge good">${row.pct_paid}</span></td>
                    <td>${formatNumber(row.conversion)}</td>
                    <td><span class="cell-badge good">${row.conversion_pct}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="bucket-column">
            <div class="bucket-header low">
              <span>📉 <25 (Low Volume)</span>
            </div>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>AB</th>
                  <th>Workable/AB</th>
                  <th>Paid AB</th>
                  <th>% Paid</th>
                  <th>Conversion</th>
                  <th>Conv %</th>
                </tr>
              </thead>
              <tbody>
                ${rObj.low.map(row => `
                  <tr>
                    <td><strong>${row.category}</strong></td>
                    <td>${formatNumber(row.ab)}</td>
                    <td>${row.workable_per_ab}</td>
                    <td>${formatNumber(row.paid_ab)}</td>
                    <td><span class="cell-badge ${parseFloat(row.pct_paid) > 25 ? 'good' : 'warn'}">${row.pct_paid}</span></td>
                    <td>${formatNumber(row.conversion)}</td>
                    <td><span class="cell-badge good">${row.conversion_pct}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // SECTION G: CONSISTENCY SECTION
  // =========================================================================
  function renderConsistencySection() {
    const m = dashboardData.monthlyByRM[activeRM][activeMonth] || {};
    const score = Math.round(m.consistencyScore || 0);
    const conf = RM_CONFIG[activeRM];

    // Gauge
    const canvas = document.getElementById('chartProfGauge');
    if (canvas) {
      const gChart = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          datasets: [{
            data: [score, Math.max(0, 100 - score)],
            backgroundColor: [conf.color, '#e2e8f0'],
            borderWidth: 0,
            circumference: 360
          }]
        },
        options: {
          cutout: '78%',
          responsive: false,
          plugins: { tooltip: { enabled: false } }
        }
      });
      registerChart('chartProfGauge', gChart);
    }

    const scoreNum = document.getElementById('profConsistencyScoreNum');
    if (scoreNum) scoreNum.textContent = `${score}%`;

    const subText = document.getElementById('profConsistencySub');
    if (subText) {
      subText.textContent = `${m.consistentDays || 0} of ${m.workingDays || 0} logged days met 50+ dials threshold`;
    }

    // Working days & avg calls history bar chart
    const histCanvas = document.getElementById('chartProfWorkingDays');
    if (histCanvas) {
      const months = dashboardData.months.slice(-5);
      const labels = months.map(getMonthLabel);
      const mData = dashboardData.monthlyByRM[activeRM];

      const chart = new Chart(histCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Working Days',
              data: months.map(m => (mData[m] || {}).workingDays || 0),
              backgroundColor: '#94a3b8',
              borderRadius: 4
            },
            {
              label: 'Consistent Days (50+ dials)',
              data: months.map(m => (mData[m] || {}).consistentDays || 0),
              backgroundColor: conf.color,
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } } }
          },
          scales: {
            y: { beginAtZero: true, max: 31, grid: { color: '#f1f5f9' } },
            x: { grid: { display: false } }
          }
        }
      });
      registerChart('chartProfWorkingDays', chart);
    }
  }

})();
