/**
 * RM Performance Dashboard - Ambassador Club
 * Global Team Comparison View Controller (global.html)
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
    fetchDashboardData,
    drawSparkline,
    hideLoader,
    showLoader
  } = window.RM_DASHBOARD;

  // Active State
  let dashboardData = null;
  let selectedRMs = new Set(['Malik', 'Ramya', 'Dipali', 'Shirish', 'Anand']);
  let selectedMonth = '2026-10';
  let selectedMonths = new Set(); // Will initialize to all available months
  let comparisonMonth = 'Oct-2026';
  let activeTab = 'overview';

  // Chart Registry for destroying old instances
  const chartRegistry = {};

  function destroyChart(canvasId) {
    if (chartRegistry[canvasId]) {
      try { chartRegistry[canvasId].destroy(); } catch (e) {}
      delete chartRegistry[canvasId];
    }
    const canvas = typeof canvasId === 'string' ? document.getElementById(canvasId) : canvasId;
    if (canvas && typeof Chart !== 'undefined' && Chart.getChart) {
      try {
        const existing = Chart.getChart(canvas);
        if (existing) existing.destroy();
      } catch (e) {}
    }
  }

  function registerChart(canvasId, chart) {
    chartRegistry[canvasId] = chart;
    return chart;
  }

  function destroyAllCharts() {
    Object.keys(chartRegistry).forEach(id => {
      destroyChart(id);
    });
    if (typeof Chart !== 'undefined' && Chart.instances) {
      Object.keys(Chart.instances).forEach(key => {
        try { Chart.instances[key].destroy(); } catch (e) {}
      });
    }
  }

  // Initialization
  document.addEventListener('DOMContentLoaded', async () => {
    showLoader('Loading team comparison data...');
    try {
      dashboardData = await fetchDashboardData();
      initControls();
      initTabs();
      renderCurrentView();
    } catch (err) {
      console.error(err);
      alert('Error loading dashboard data. Please check the console.');
    } finally {
      hideLoader();
    }
  });

  // UI Event Handlers & Filter Setup
  function initControls() {
    // Initialize selectedMonths Set with all months
    selectedMonths = new Set(dashboardData.months);
    selectedMonth = dashboardData.months[dashboardData.months.length - 1]; // latest month

    function syncSelectedMonth() {
      // Pick the latest month among selectedMonths for single-month components
      const sorted = dashboardData.months.filter(m => selectedMonths.has(m));
      if (sorted.length > 0) {
        selectedMonth = sorted[sorted.length - 1];
        comparisonMonth = getMonthLabel(selectedMonth);
        const compSelect = document.getElementById('compMonthSelect');
        if (compSelect) compSelect.value = comparisonMonth;
      }
    }

    // Unified Month Filter Pills
    const monthToggleContainer = document.getElementById('monthToggleGroup');
    if (monthToggleContainer) {
      monthToggleContainer.innerHTML = '';
      const revMonths = [...dashboardData.months].reverse();
      revMonths.forEach(ym => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'month-toggle-btn active';
        btn.setAttribute('data-ym', ym);
        btn.textContent = getMonthLabel(ym);

        btn.addEventListener('click', () => {
          if (selectedMonths.has(ym)) {
            if (selectedMonths.size > 1) {
              selectedMonths.delete(ym);
              btn.classList.remove('active');
            }
          } else {
            selectedMonths.add(ym);
            btn.classList.add('active');
          }
          syncSelectedMonth();
          renderCurrentView();
        });
        monthToggleContainer.appendChild(btn);
      });
    }

    // Quick Month Shortcuts
    const btnAllMonths = document.getElementById('btnSelectAllMonths');
    if (btnAllMonths) {
      btnAllMonths.addEventListener('click', () => {
        selectedMonths = new Set(dashboardData.months);
        syncSelectedMonth();
        updateMonthToggleButtons();
        renderCurrentView();
      });
    }

    const btnLast3M = document.getElementById('btnSelectLast3Months');
    if (btnLast3M) {
      btnLast3M.addEventListener('click', () => {
        const last3 = dashboardData.months.slice(-3);
        selectedMonths = new Set(last3);
        syncSelectedMonth();
        updateMonthToggleButtons();
        renderCurrentView();
      });
    }

    const btnLatestOnly = document.getElementById('btnSelectLatestOnly');
    if (btnLatestOnly) {
      btnLatestOnly.addEventListener('click', () => {
        const latest = dashboardData.months[dashboardData.months.length - 1];
        selectedMonths = new Set([latest]);
        syncSelectedMonth();
        updateMonthToggleButtons();
        renderCurrentView();
      });
    }

    // RM Filter Pills
    const toggleContainer = document.getElementById('rmToggleGroup');
    if (toggleContainer) {
      toggleContainer.innerHTML = '';
      Object.keys(RM_CONFIG).forEach(rm => {
        const conf = RM_CONFIG[rm];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `rm-toggle-btn active`;
        btn.setAttribute('data-rm', rm);
        btn.innerHTML = `<span class="color-indicator" style="background: ${conf.color}"></span>${conf.name}`;
        
        btn.addEventListener('click', () => {
          if (selectedRMs.has(rm)) {
            if (selectedRMs.size > 1) {
              selectedRMs.delete(rm);
              btn.classList.remove('active');
            }
          } else {
            selectedRMs.add(rm);
            btn.classList.add('active');
          }
          renderCurrentView();
        });
        toggleContainer.appendChild(btn);
      });
    }

    // Quick filter buttons
    const btnAll = document.getElementById('btnSelectAll');
    if (btnAll) {
      btnAll.addEventListener('click', () => {
        selectedRMs = new Set(Object.keys(RM_CONFIG));
        updateRmToggleButtons();
        renderCurrentView();
      });
    }

    const btnSeniors = document.getElementById('btnSelectSeniors');
    if (btnSeniors) {
      btnSeniors.addEventListener('click', () => {
        selectedRMs = new Set(['Malik', 'Ramya', 'Dipali']);
        updateRmToggleButtons();
        renderCurrentView();
      });
    }

    const btnNew = document.getElementById('btnSelectNew');
    if (btnNew) {
      btnNew.addEventListener('click', () => {
        selectedRMs = new Set(['Shirish', 'Anand']);
        updateRmToggleButtons();
        renderCurrentView();
      });
    }

    // Comparison month selector (for Conversions tab)
    const compSelect = document.getElementById('compMonthSelect');
    if (compSelect) {
      compSelect.addEventListener('change', (e) => {
        comparisonMonth = e.target.value;
        renderConversionsTab();
        renderComparisonsTab();
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

  function updateRmToggleButtons() {
    document.querySelectorAll('.rm-toggle-btn').forEach(btn => {
      const rm = btn.getAttribute('data-rm');
      if (selectedRMs.has(rm)) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }

  function updateMonthToggleButtons() {
    document.querySelectorAll('.month-toggle-btn').forEach(btn => {
      const ym = btn.getAttribute('data-ym');
      if (selectedMonths.has(ym)) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }

  function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        activeTab = tab.getAttribute('data-tab');
        const content = document.getElementById(`tab-${activeTab}`);
        if (content) content.classList.add('active');

        // Render relevant charts for the tab
        renderActiveTabContent();
      });
    });
  }

  function renderCurrentView() {
    destroyAllCharts();
    renderActiveTabContent();
  }

  function renderActiveTabContent() {
    switch (activeTab) {
      case 'overview':
        renderOverviewTab();
        break;
      case 'trends':
        renderTrendsTab();
        break;
      case 'dials':
        renderDialAnalysisTab();
        break;
      case 'conversions':
        renderConversionsTab();
        break;
      case 'comparisons':
        renderComparisonsTab();
        break;
      case 'consistency':
        renderConsistencyTab();
        break;
    }
  }

  // =========================================================================
  // SECTION 1: OVERVIEW TAB
  // =========================================================================
  function renderOverviewTab() {
    const container = document.getElementById('overviewKpiContainer');
    if (!container) return;
    container.innerHTML = '';

    const prevMonthIdx = dashboardData.months.indexOf(selectedMonth) - 1;
    const prevMonth = prevMonthIdx >= 0 ? dashboardData.months[prevMonthIdx] : null;

    const isMultiMonth = selectedMonths.size > 1;
    const monthsArr = dashboardData.months.filter(m => selectedMonths.has(m));
    const periodLabel = isMultiMonth 
      ? `${monthsArr.length} Months (${getMonthLabel(monthsArr[0])} – ${getMonthLabel(monthsArr[monthsArr.length - 1])})`
      : getMonthLabel(selectedMonth);

    // Render a row of 6 cards for each selected RM
    Array.from(selectedRMs).forEach(rm => {
      const conf = RM_CONFIG[rm];
      const mData = dashboardData.monthlyByRM[rm] || {};

      let totalDials = 0;
      let totalConnected = 0;
      let totalTalk = 0;
      let totalWorking = 0;
      let totalOnb = 0;
      let totalActiveAb = 0;
      let totalPaidAb = 0;

      monthsArr.forEach(ym => {
        const row = mData[ym] || {};
        totalDials += (row.totalDials || 0);
        totalConnected += (row.totalConnected || 0);
        totalTalk += (row.talktime || 0);
        totalWorking += (row.workingDays || 0);
        totalOnb += (row.onboardings || 0);
        totalActiveAb += (row.activeAbSum || 0);
        totalPaidAb += (row.paidAbSum || 0);
      });

      const connRate = totalDials > 0 ? (totalConnected / totalDials) * 100 : 0;
      const avgTalk = totalWorking > 0 ? (totalTalk / totalWorking) : 0;
      const avgDialsPerDay = totalWorking > 0 ? Math.round(totalDials / totalWorking) : 0;
      const avgConnPerDay = totalWorking > 0 ? Math.round(totalConnected / totalWorking) : 0;

      // For single month, compute MoM delta; for multi-month, show total working days
      const prevMonthIdx = dashboardData.months.indexOf(selectedMonth) - 1;
      const prevMonth = prevMonthIdx >= 0 ? dashboardData.months[prevMonthIdx] : null;
      const prev = prevMonth ? dashboardData.monthlyByRM[rm][prevMonth] || {} : {};
      const dialsMoM = calcMoM(totalDials, prev.totalDials);

      // Monthly dial history for sparkline
      const dialHistory = dashboardData.months.map(m => (dashboardData.monthlyByRM[rm][m] || {}).totalDials || 0);

      const rmSection = document.createElement('div');
      rmSection.style.marginBottom = '2rem';
      rmSection.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.85rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span style="width: 14px; height: 14px; border-radius: 50%; background: ${conf.color};"></span>
            <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary);">${conf.name}</h3>
            <span class="zone-badge ${conf.badgeClass}">${conf.zone}</span>
            <span style="font-size: 0.8rem; color: var(--text-muted);">${conf.role}</span>
            <span style="font-size: 0.78rem; background: #f1f5f9; padding: 0.2rem 0.55rem; border-radius: 4px; font-weight: 600; color: #475569;">
              ${periodLabel}
            </span>
          </div>
          <a href="profile.html?rm=${encodeURIComponent(rm)}" style="font-size: 0.82rem; font-weight: 600; color: ${conf.color}; text-decoration: none;">
            Full Profile →
          </a>
        </div>
        <div class="grid-7">
          <!-- Total Dials -->
          <div class="kpi-card" data-color="${rm.toLowerCase()}">
            <div class="kpi-top">
              <span class="kpi-label">${isMultiMonth ? 'Period Dials' : 'Total Dials'}</span>
            </div>
            <div class="kpi-value">${formatNumber(totalDials)}</div>
            <div class="kpi-footer">
              <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">
                Avg ${avgDialsPerDay}/day (${totalWorking}d)
              </span>
            </div>
          </div>

          <!-- Total Connected -->
          <div class="kpi-card" data-color="${rm.toLowerCase()}">
            <div class="kpi-top">
              <span class="kpi-label">${isMultiMonth ? 'Period Connected' : 'Total Connected'}</span>
            </div>
            <div class="kpi-value">${formatNumber(totalConnected)}</div>
            <div class="kpi-footer">
              <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">
                Avg ${avgConnPerDay}/day
              </span>
            </div>
          </div>

          <!-- Connection Rate % -->
          <div class="kpi-card" data-color="${rm.toLowerCase()}">
            <div class="kpi-top">
              <span class="kpi-label">Connect Rate</span>
            </div>
            <div class="kpi-value">${formatPct(connRate)}</div>
            <div class="kpi-footer">
              <span style="font-size: 0.75rem; color: var(--text-muted);">
                ${formatNumber(totalConnected)} / ${formatNumber(totalDials)}
              </span>
            </div>
          </div>

          <!-- Avg Talktime -->
          <div class="kpi-card" data-color="${rm.toLowerCase()}">
            <div class="kpi-top">
              <span class="kpi-label">Avg Daily Talk</span>
            </div>
            <div class="kpi-value">${formatMinutes(avgTalk)}</div>
            <div class="kpi-footer">
              <span style="font-size: 0.75rem; color: var(--text-muted);">
                ${formatMinutes(totalTalk)} total
              </span>
            </div>
          </div>

          <!-- Onboardings -->
          <div class="kpi-card" data-color="${rm.toLowerCase()}">
            <div class="kpi-top">
              <span class="kpi-label">Onboardings</span>
            </div>
            <div class="kpi-value">${formatNumber(totalOnb)}</div>
            <div class="kpi-footer">
              <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">
                ${isMultiMonth ? 'Period Total' : 'Monthly Total'}
              </span>
            </div>
          </div>

          <!-- Active ABs -->
          <div class="kpi-card" data-color="${rm.toLowerCase()}">
            <div class="kpi-top">
              <span class="kpi-label">Active ABs</span>
            </div>
            <div class="kpi-value">${formatNumber(totalActiveAb)}</div>
            <div class="kpi-footer">
              <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">
                All Days Sum
              </span>
            </div>
          </div>

          <!-- Paid ABs -->
          <div class="kpi-card" data-color="${rm.toLowerCase()}">
            <div class="kpi-top">
              <span class="kpi-label">Paid ABs</span>
            </div>
            <div class="kpi-value">${conf.hasConversionData ? formatNumber(totalPaidAb) : 'N/A'}</div>
            <div class="kpi-footer">
              <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">
                ${conf.hasConversionData ? 'All Days Sum' : 'New Joiner'}
              </span>
            </div>
          </div>
        </div>
      `;
      container.appendChild(rmSection);

      // Render sparkline
      setTimeout(() => {
        drawSparkline(`spark-${rm}-dials`, dialHistory, conf.color);
      }, 50);
    });

    renderZoneSummary();
  }

  function renderZoneSummary() {
    const container = document.getElementById('zoneSummaryContainer');
    if (!container) return;
    container.innerHTML = '';

    const isMultiMonth = selectedMonths.size > 1;
    const monthsArr = dashboardData.months.filter(m => selectedMonths.has(m));

    const zones = [
      { name: 'North & Chennai', badge: 'badge-north', rms: ['Malik'] },
      { name: 'West Zone', badge: 'badge-west', rms: ['Dipali'] },
      { name: 'South Zone', badge: 'badge-south', rms: ['Ramya'] },
      { name: 'New Joiners', badge: 'badge-new', rms: ['Shirish', 'Anand'] }
    ];

    zones.forEach(z => {
      let totalDials = 0;
      let totalConnected = 0;
      let totalTalk = 0;
      let totalWorking = 0;
      let totalOnb = 0;

      z.rms.forEach(rm => {
        monthsArr.forEach(ym => {
          const m = (dashboardData.monthlyByRM[rm] || {})[ym];
          if (m) {
            totalDials += m.totalDials || 0;
            totalConnected += m.totalConnected || 0;
            totalTalk += m.talktime || 0;
            totalWorking += m.workingDays || 0;
            totalOnb += m.onboardings || 0;
          }
        });
      });

      const connRate = totalDials > 0 ? (totalConnected / totalDials) * 100 : 0;
      const avgTalk = totalWorking > 0 ? totalTalk / totalWorking : 0;

      const card = document.createElement('div');
      card.className = 'zone-card';
      card.innerHTML = `
        <div class="zone-header">
          <span style="font-weight: 700; font-size: 0.95rem;">${z.name}</span>
          <span class="zone-badge ${z.badge}">${z.rms.join(', ')}</span>
        </div>
        <div class="zone-metrics-grid">
          <div class="zone-metric-item">
            <span class="val">${formatNumber(totalDials)}</span>
            <span class="lbl">${isMultiMonth ? 'Period Dials' : 'Dials'}</span>
          </div>
          <div class="zone-metric-item">
            <span class="val">${formatPct(connRate)}</span>
            <span class="lbl">Connect %</span>
          </div>
          <div class="zone-metric-item">
            <span class="val">${formatMinutes(avgTalk)}</span>
            <span class="lbl">Avg Talk</span>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // =========================================================================
  // SECTION 2: TRENDS TAB (8 CHARTS: 5 STANDALONE + 3 PAIRED)
  // =========================================================================
  function renderTrendsTab() {
    // Filter months based on multi-month selection
    const allMonths = dashboardData.months;
    const months = allMonths.filter(m => selectedMonths.has(m));
    const labels = months.map(getMonthLabel);
    const rms = Array.from(selectedRMs);

    // 1. Total Dial Calls per Month
    const dialDatasets = rms.map(rm => ({
      label: rm,
      data: months.map(m => (dashboardData.monthlyByRM[rm][m] || {}).totalDials || 0),
      borderColor: RM_CONFIG[rm].color,
      backgroundColor: RM_CONFIG[rm].color,
      borderWidth: 2.5,
      pointRadius: 4,
      pointHoverRadius: 6,
      tension: 0.25
    }));
    createLineChart('chartTrendDials', labels, dialDatasets, 'Calls');

    // 2. Total Connected Calls per Month
    const connDatasets = rms.map(rm => ({
      label: rm,
      data: months.map(m => (dashboardData.monthlyByRM[rm][m] || {}).totalConnected || 0),
      borderColor: RM_CONFIG[rm].color,
      backgroundColor: RM_CONFIG[rm].color,
      borderWidth: 2.5,
      pointRadius: 4,
      pointHoverRadius: 6,
      tension: 0.25
    }));
    createLineChart('chartTrendConnect', labels, connDatasets, 'Calls');

    // 3. Connection Rate % per Month
    const rateDatasets = rms.map(rm => ({
      label: rm,
      data: months.map(m => Number(((dashboardData.monthlyByRM[rm][m] || {}).connectionRate || 0).toFixed(1))),
      borderColor: RM_CONFIG[rm].color,
      backgroundColor: RM_CONFIG[rm].color,
      borderWidth: 2.5,
      pointRadius: 4,
      pointHoverRadius: 6,
      tension: 0.25
    }));
    createLineChart('chartTrendRate', labels, rateDatasets, '%', '%');

    // 4. Average Daily Talktime per Month
    const talkDatasets = rms.map(rm => ({
      label: rm,
      data: months.map(m => Math.round((dashboardData.monthlyByRM[rm][m] || {}).avgTalktime || 0)),
      borderColor: RM_CONFIG[rm].color,
      backgroundColor: RM_CONFIG[rm].color,
      borderWidth: 2.5,
      pointRadius: 4,
      pointHoverRadius: 6,
      tension: 0.25
    }));
    createLineChart('chartTrendTalktime', labels, talkDatasets, 'Minutes', 'm');

    // 5. Total Onboardings per Month
    const onbDatasets = rms.map(rm => ({
      label: rm,
      data: months.map(m => (dashboardData.monthlyByRM[rm][m] || {}).onboardings || 0),
      borderColor: RM_CONFIG[rm].color,
      backgroundColor: RM_CONFIG[rm].color,
      borderWidth: 2.5,
      pointRadius: 4,
      pointHoverRadius: 6,
      tension: 0.25
    }));
    createLineChart('chartTrendOnboardings', labels, onbDatasets, 'Onboardings');

    // 6. Active Followups: Paired (Dial = solid, Connect = dashed)
    const activeFollowupDatasets = [];
    rms.forEach(rm => {
      const col = RM_CONFIG[rm].color;
      activeFollowupDatasets.push({
        label: `${rm} - Dial`,
        data: months.map(m => (dashboardData.monthlyByRM[rm][m] || {}).active_dial || 0),
        borderColor: col,
        backgroundColor: col,
        borderWidth: 2.5,
        borderDash: [],
        pointRadius: 3.5,
        tension: 0.2
      });
      activeFollowupDatasets.push({
        label: `${rm} - Connect`,
        data: months.map(m => (dashboardData.monthlyByRM[rm][m] || {}).active_connect || 0),
        borderColor: col,
        backgroundColor: col,
        borderWidth: 2,
        borderDash: [5, 4],
        pointRadius: 3,
        tension: 0.2
      });
    });
    createLineChart('chartTrendActiveFollowup', labels, activeFollowupDatasets, 'Calls');

    // 7. Reactive Followups: Paired
    const reactiveFollowupDatasets = [];
    rms.forEach(rm => {
      const col = RM_CONFIG[rm].color;
      reactiveFollowupDatasets.push({
        label: `${rm} - Dial`,
        data: months.map(m => (dashboardData.monthlyByRM[rm][m] || {}).reactive_dial || 0),
        borderColor: col,
        backgroundColor: col,
        borderWidth: 2.5,
        borderDash: [],
        pointRadius: 3.5,
        tension: 0.2
      });
      reactiveFollowupDatasets.push({
        label: `${rm} - Connect`,
        data: months.map(m => (dashboardData.monthlyByRM[rm][m] || {}).reactive_connect || 0),
        borderColor: col,
        backgroundColor: col,
        borderWidth: 2,
        borderDash: [5, 4],
        pointRadius: 3,
        tension: 0.2
      });
    });
    createLineChart('chartTrendReactiveFollowup', labels, reactiveFollowupDatasets, 'Calls');

    // 8. Consistent Followups: Paired
    const consistentFollowupDatasets = [];
    rms.forEach(rm => {
      const col = RM_CONFIG[rm].color;
      consistentFollowupDatasets.push({
        label: `${rm} - Dial`,
        data: months.map(m => (dashboardData.monthlyByRM[rm][m] || {}).consistent_dial || 0),
        borderColor: col,
        backgroundColor: col,
        borderWidth: 2.5,
        borderDash: [],
        pointRadius: 3.5,
        tension: 0.2
      });
      consistentFollowupDatasets.push({
        label: `${rm} - Connect`,
        data: months.map(m => (dashboardData.monthlyByRM[rm][m] || {}).consistent_connect || 0),
        borderColor: col,
        backgroundColor: col,
        borderWidth: 2,
        borderDash: [5, 4],
        pointRadius: 3,
        tension: 0.2
      });
    });
    createLineChart('chartTrendConsistentFollowup', labels, consistentFollowupDatasets, 'Calls');
  }

  function createLineChart(canvasId, labels, datasets, unitLabel, unitSuffix = '') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    destroyChart(canvasId);

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 14,
              boxHeight: 4,
              font: { family: 'Inter', size: 11, weight: 600 },
              usePointStyle: false,
              color: '#475569'
            }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleFont: { family: 'Inter', size: 12, weight: 700 },
            bodyFont: { family: 'Inter', size: 12 },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: function (context) {
                const val = context.parsed.y !== null ? context.parsed.y.toLocaleString('en-IN') : 0;
                return ` ${context.dataset.label}: ${val}${unitSuffix}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: '#f1f5f9' },
            ticks: { font: { family: 'Inter', size: 11 }, color: '#64748b' }
          },
          y: {
            beginAtZero: true,
            grid: { color: '#f1f5f9' },
            ticks: {
              font: { family: 'Inter', size: 11 },
              color: '#64748b',
              callback: function (value) {
                return value.toLocaleString('en-IN') + unitSuffix;
              }
            }
          }
        }
      }
    });

    registerChart(canvasId, chart);
  }

  // =========================================================================
  // SECTION 3: DIAL ANALYSIS TAB
  // =========================================================================
  function renderDialAnalysisTab() {
    renderStackedDialComposition();
    renderConnectRateByType();
    renderDialMomMatrix();
    renderTeamTalktimeHeatmap();
  }

  function renderStackedDialComposition() {
    const canvas = document.getElementById('chartDialComposition');
    if (!canvas) return;

    destroyChart('chartDialComposition');

    const rms = Array.from(selectedRMs);
    const isMultiMonth = selectedMonths.size > 1;
    const monthsArr = dashboardData.months.filter(m => selectedMonths.has(m));
    const titleEl = canvas.closest('.chart-card')?.querySelector('.card-subtitle');
    if (titleEl) {
      titleEl.textContent = `Breakdown across 8 call categories for ${isMultiMonth ? monthsArr.length + ' selected months (' + monthsArr.map(getMonthLabel).join(', ') + ')' : getMonthLabel(selectedMonth)}`;
    }

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

    const datasets = types.map(t => ({
      label: t.label,
      data: rms.map(rm => {
        return monthsArr.reduce((sum, ym) => sum + ((dashboardData.monthlyByRM[rm]?.[ym] || {})[t.key] || 0), 0);
      }),
      backgroundColor: t.color,
      borderRadius: 4
    }));

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: rms,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('en-IN')} dials`
            }
          }
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: {
            stacked: true,
            grid: { color: '#f1f5f9' },
            ticks: { callback: v => v.toLocaleString('en-IN') }
          }
        }
      }
    });

    registerChart('chartDialComposition', chart);
  }

  function renderConnectRateByType() {
    const canvas = document.getElementById('chartConnectRateByType');
    if (!canvas) return;

    destroyChart('chartConnectRateByType');

    const rms = Array.from(selectedRMs);
    const isMultiMonth = selectedMonths.size > 1;
    const monthsArr = dashboardData.months.filter(m => selectedMonths.has(m));
    const titleEl = canvas.closest('.chart-card')?.querySelector('.card-subtitle');
    if (titleEl) {
      titleEl.textContent = `Connection success rate per call category (${isMultiMonth ? monthsArr.length + ' selected months' : getMonthLabel(selectedMonth)})`;
    }

    const dialCategories = [
      { name: 'Active', dKey: 'active_dial', cKey: 'active_connect' },
      { name: 'Reactive', dKey: 'reactive_dial', cKey: 'reactive_connect' },
      { name: 'Consistent', dKey: 'consistent_dial', cKey: 'consistent_connect' },
      { name: 'Onboarding', dKey: 'onboarding_dial', cKey: 'onboarding_connect' },
      { name: 'Acquisition', dKey: 'acquisition_dial', cKey: 'acquisition_connect' },
      { name: 'Home Service', dKey: 'home_service_dial', cKey: 'home_service_connect' },
      { name: 'Phone', dKey: 'phone_dial', cKey: 'phone_connect' }
    ];

    const datasets = rms.map(rm => {
      const rates = dialCategories.map(cat => {
        let d = 0;
        let c = 0;
        monthsArr.forEach(ym => {
          const m = (dashboardData.monthlyByRM[rm] || {})[ym] || {};
          d += m[cat.dKey] || 0;
          c += m[cat.cKey] || 0;
        });
        return d > 0 ? Number(((c / d) * 100).toFixed(1)) : 0;
      });
      return {
        label: rm,
        data: rates,
        backgroundColor: RM_CONFIG[rm].color,
        borderRadius: 4
      };
    });

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dialCategories.map(c => c.name),
        datasets: datasets
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } } },
          tooltip: {
            backgroundColor: '#0f172a',
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.x}% connect rate`
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            max: 100,
            grid: { color: '#f1f5f9' },
            ticks: { callback: v => v + '%' }
          },
          y: { grid: { display: false } }
        }
      }
    });

    registerChart('chartConnectRateByType', chart);
  }

  function renderTeamTalktimeHeatmap() {
    const container = document.getElementById('teamHeatmapContainer');
    if (!container) return;
    container.innerHTML = '';

    const rms = Array.from(selectedRMs);
    const isMultiMonth = selectedMonths.size > 1;
    const monthsArr = dashboardData.months.filter(m => selectedMonths.has(m));

    rms.forEach(rm => {
      const conf = RM_CONFIG[rm];
      const records = (dashboardData.rmDaily[rm] || []).filter(r => r.date && monthsArr.some(ym => r.date.startsWith(ym)));

      const row = document.createElement('div');
      row.className = 'heatmap-rm-row';
      row.innerHTML = `
        <div class="heatmap-rm-header">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${conf.color};"></span>
            <span>${rm}</span>
          </div>
          <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 500;">
            ${records.length} logged days (${isMultiMonth ? monthsArr.length + ' Months' : getMonthLabel(selectedMonth)})
          </span>
        </div>
      `;

      const grid = document.createElement('div');
      grid.className = 'heatmap-grid';

      records.forEach(r => {
        const mins = Number(r.talktime || 0);
        let lvlClass = 'hm-lvl-0';
        if (mins > 0 && mins < 30) lvlClass = 'hm-lvl-1';
        else if (mins >= 30 && mins < 60) lvlClass = 'hm-lvl-2';
        else if (mins >= 60 && mins < 90) lvlClass = 'hm-lvl-3';
        else if (mins >= 90) lvlClass = 'hm-lvl-4';

        const dayNum = parseInt(r.date.split('-')[2], 10);
        const cell = document.createElement('div');
        cell.className = `heatmap-cell ${lvlClass}`;
        cell.textContent = dayNum;
        cell.title = `${rm} on ${r.date}: ${mins} minutes talktime (${formatNumber(r.total_connected || 0)} connected)`;
        grid.appendChild(cell);
      });

      row.appendChild(grid);
      container.appendChild(row);
    });
  }

  // Month-on-Month Dial & Connection Comparison Matrix
  function renderDialMomMatrix() {
    const container = document.getElementById('dialMomComparisonContainer');
    if (!container) return;
    container.innerHTML = '';

    const rms = Array.from(selectedRMs);
    const months = dashboardData.months.filter(m => selectedMonths.has(m));

    if (rms.length === 0 || months.length === 0) {
      container.innerHTML = '<div style="padding: 2rem; color: var(--text-muted); text-align: center;">Please select at least 1 RM and 1 Month to view comparison.</div>';
      return;
    }

    let html = `
      <table class="data-table" style="width: 100%; font-size: 0.84rem;">
        <thead>
          <tr>
            <th style="min-width: 140px;">Relationship Manager</th>
            <th style="min-width: 100px;">Metric</th>
    `;

    months.forEach(ym => {
      html += `<th style="text-align: right; min-width: 90px;">${getMonthLabel(ym)}</th>`;
    });

    html += `
            <th style="text-align: right; min-width: 90px; background: #f8fafc;">Total / Avg</th>
          </tr>
        </thead>
        <tbody>
    `;

    rms.forEach(rm => {
      const conf = RM_CONFIG[rm];
      const mData = dashboardData.monthlyByRM[rm] || {};

      let totalDials = 0;
      let totalConn = 0;
      let totalTalk = 0;
      let totalDays = 0;

      // Row 1: Dials
      html += `
        <tr style="border-top: 2px solid var(--border-light);">
          <td rowspan="4" style="vertical-align: top; font-weight: 700; background: #ffffff;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.2rem;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background: ${conf.color}"></span>
              <span>${rm}</span>
            </div>
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.2rem; font-weight: normal;">
              ${conf.zone}
            </div>
          </td>
          <td style="font-weight: 600; color: #4338ca;">Total Dials</td>
      `;

      months.forEach(ym => {
        const d = mData[ym]?.totalDials || 0;
        totalDials += d;
        html += `<td style="text-align: right; font-weight: 600;">${d > 0 ? formatNumber(d) : '<span style=\"color:#cbd5e1;\">—</span>'}</td>`;
      });
      html += `<td style="text-align: right; font-weight: 700; background: #f8fafc; color: #4338ca;">${formatNumber(totalDials)}</td></tr>`;

      // Row 2: Connected Calls
      html += `<tr><td style="font-weight: 600; color: #059669;">Connected Calls</td>`;
      months.forEach(ym => {
        const c = mData[ym]?.totalConnected || 0;
        totalConn += c;
        html += `<td style="text-align: right; font-weight: 600;">${c > 0 ? formatNumber(c) : '<span style=\"color:#cbd5e1;\">—</span>'}</td>`;
      });
      html += `<td style="text-align: right; font-weight: 700; background: #f8fafc; color: #059669;">${formatNumber(totalConn)}</td></tr>`;

      // Row 3: Connection Rate %
      html += `<tr><td style="color: var(--text-muted);">Connect Rate %</td>`;
      months.forEach(ym => {
        const rate = mData[ym]?.connectionRate || 0;
        const d = mData[ym]?.totalDials || 0;
        html += `<td style="text-align: right;">${d > 0 ? formatPct(rate) : '<span style=\"color:#cbd5e1;\">—</span>'}</td>`;
      });
      const overallRate = totalDials > 0 ? (totalConn / totalDials) * 100 : 0;
      html += `<td style="text-align: right; font-weight: 600; background: #f8fafc;">${formatPct(overallRate)}</td></tr>`;

      // Row 4: Avg Daily Talktime
      html += `<tr><td style="color: var(--text-muted);">Avg Daily Talktime</td>`;
      months.forEach(ym => {
        const talk = mData[ym]?.avgTalktime || 0;
        const days = mData[ym]?.workingDays || 0;
        totalTalk += (mData[ym]?.talktime || 0);
        totalDays += days;
        html += `<td style="text-align: right;">${days > 0 ? formatMinutes(talk) : '<span style=\"color:#cbd5e1;\">—</span>'}</td>`;
      });
      const overallAvgTalk = totalDays > 0 ? (totalTalk / totalDays) : 0;
      html += `<td style="text-align: right; font-weight: 600; background: #f8fafc;">${formatMinutes(overallAvgTalk)}</td></tr>`;
    });

    html += `
        </tbody>
      </table>
    `;

    container.innerHTML = html;
  }

  // =========================================================================
  // SECTION 4: CONVERSIONS TAB
  // =========================================================================
  function renderConversionsTab() {
    renderConversionFunnel();
    renderTotalLeadsTrend();
    renderWorkableLeadsTrend();
    renderLeadsMomMatrix();
    renderConversionTrend();
    renderProjectionsVsActuals();
    renderPaidAbTrend();
    renderActiveUsersTrend();
  }

  function renderConversionFunnel() {
    const container = document.getElementById('conversionFunnelContainer');
    if (!container) return;
    container.innerHTML = '';

    const comp = dashboardData.comparison[comparisonMonth];
    if (!comp || !comp.rms) {
      container.innerHTML = `<div style="padding: 2rem; color: var(--text-muted); text-align: center;">No conversion data available for ${comparisonMonth}</div>`;
      return;
    }

    const seniorRMs = ['Malik', 'Dipali', 'Ramya'].filter(rm => selectedRMs.has(rm));
    if (seniorRMs.length === 0) {
      container.innerHTML = `<div style="padding: 2rem; color: var(--text-muted); text-align: center;">Conversion reporting is only applicable to Senior RMs (Malik, Dipali, Ramya). Please select at least one senior RM.</div>`;
      return;
    }

    seniorRMs.forEach(rm => {
      const rData = comp.rms[rm];
      if (!rData || !rData.curr) return;

      const curr = rData.curr;
      const totalLeads = curr.totalLeads || 1;
      const workable = curr.workableLeads || 0;
      const conv = curr.conversion || 0;
      const convPct = curr.conversionPct || '0%';

      const workPct = ((workable / totalLeads) * 100).toFixed(1);
      const conf = RM_CONFIG[rm];

      const item = document.createElement('div');
      item.className = 'funnel-row';
        const convRealPct = ((conv / totalLeads) * 100).toFixed(1);
        const convBarWidth = Math.max(8, Math.min(parseFloat(workPct), (conv / totalLeads) * 100));

        item.innerHTML = `
        <div class="funnel-label">
          <div style="display: flex; align-items: center; gap: 0.4rem;">
            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${conf.color}"></span>
            <strong>${rm}</strong>
          </div>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${convPct} of Workable</span>
        </div>
        <div class="funnel-bars-group">
          <!-- Total Leads -->
          <div class="funnel-bar-track" title="Total Leads: ${formatNumber(totalLeads)}">
            <div class="funnel-bar-fill" style="width: 100%; background: #64748b;">
              Total Leads: ${formatNumber(totalLeads)} (100%)
            </div>
          </div>
          <!-- Workable Leads -->
          <div class="funnel-bar-track" title="Workable Leads: ${formatNumber(workable)} (${workPct}% of Total)">
            <div class="funnel-bar-fill" style="width: ${workPct}%; background: ${conf.color};">
              Workable: ${formatNumber(workable)} (${workPct}%)
            </div>
          </div>
          <!-- Conversions -->
          <div class="funnel-bar-track" title="Conversions: ${formatNumber(conv)} (${convPct} of Workable, ${convRealPct}% of Total)">
            <div class="funnel-bar-fill" style="width: ${convBarWidth}%; background: #10b981;">
              Conversions: ${formatNumber(conv)} (${convPct} of Workable)
            </div>
          </div>
        </div>
      `;
      container.appendChild(item);
    });
  }

  function getActiveComparisonMonths() {
    const ymToComp = { '2026-07': 'Jul-2026', '2026-08': 'Aug-2026', '2026-09': 'Sep-2026', '2026-10': 'Oct-2026' };
    const filtered = dashboardData.months.filter(m => selectedMonths.has(m) && ymToComp[m]).map(m => ymToComp[m]);
    return filtered.length > 0 ? filtered : ['Jul-2026', 'Aug-2026', 'Sep-2026', 'Oct-2026'];
  }

  function renderTotalLeadsTrend() {
    const canvas = document.getElementById('chartTotalLeadsTrend');
    if (!canvas) return;

    destroyChart('chartTotalLeadsTrend');

    const compMonths = getActiveComparisonMonths();
    const seniorRMs = ['Malik', 'Dipali', 'Ramya'].filter(rm => selectedRMs.has(rm));

    const datasets = seniorRMs.map(rm => {
      const dataPoints = compMonths.map(m => {
        const c = dashboardData.comparison[m];
        if (c && c.rms && c.rms[rm] && c.rms[rm].curr) {
          return c.rms[rm].curr.totalLeads || 0;
        }
        return 0;
      });

      return {
        label: rm,
        data: dataPoints,
        borderColor: RM_CONFIG[rm].color,
        backgroundColor: RM_CONFIG[rm].color,
        borderWidth: 2.5,
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.2
      };
    });

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: compMonths,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } } },
          tooltip: {
            backgroundColor: '#0f172a',
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('en-IN')} Total Leads`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: '#f1f5f9' },
            ticks: { callback: v => v.toLocaleString('en-IN') }
          },
          x: { grid: { color: '#f1f5f9' } }
        }
      }
    });

    registerChart('chartTotalLeadsTrend', chart);
  }

  function renderWorkableLeadsTrend() {
    const canvas = document.getElementById('chartWorkableLeadsTrend');
    if (!canvas) return;

    destroyChart('chartWorkableLeadsTrend');

    const compMonths = getActiveComparisonMonths();
    const seniorRMs = ['Malik', 'Dipali', 'Ramya'].filter(rm => selectedRMs.has(rm));

    const datasets = seniorRMs.map(rm => {
      const dataPoints = compMonths.map(m => {
        const c = dashboardData.comparison[m];
        if (c && c.rms && c.rms[rm] && c.rms[rm].curr) {
          return c.rms[rm].curr.workableLeads || 0;
        }
        return 0;
      });

      return {
        label: rm,
        data: dataPoints,
        borderColor: RM_CONFIG[rm].color,
        backgroundColor: RM_CONFIG[rm].color,
        borderWidth: 2.5,
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.2
      };
    });

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: compMonths,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } } },
          tooltip: {
            backgroundColor: '#0f172a',
            callbacks: {
              label: (ctx) => {
                const rm = ctx.dataset.label;
                const m = compMonths[ctx.dataIndex];
                const c = dashboardData.comparison[m]?.rms?.[rm]?.curr;
                const total = c?.totalLeads || 0;
                const pct = total > 0 ? ((ctx.parsed.y / total) * 100).toFixed(1) : 0;
                return ` ${rm}: ${ctx.parsed.y.toLocaleString('en-IN')} Workable (${pct}% of Total)`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: '#f1f5f9' },
            ticks: { callback: v => v.toLocaleString('en-IN') }
          },
          x: { grid: { color: '#f1f5f9' } }
        }
      }
    });

    registerChart('chartWorkableLeadsTrend', chart);
  }

  function renderLeadsMomMatrix() {
    const container = document.getElementById('leadsMomComparisonContainer');
    if (!container) return;
    container.innerHTML = '';

    const compMonths = getActiveComparisonMonths();
    const seniorRMs = ['Malik', 'Dipali', 'Ramya'].filter(rm => selectedRMs.has(rm));

    if (seniorRMs.length === 0) {
      container.innerHTML = '<div style="padding: 2rem; color: var(--text-muted); text-align: center;">Please select Senior RMs (Malik, Dipali, Ramya) in the filter bar.</div>';
      return;
    }

    let html = `
      <table class="data-table" style="width: 100%; font-size: 0.84rem;">
        <thead>
          <tr>
            <th style="min-width: 140px;">Relationship Manager</th>
            <th style="min-width: 130px;">Lead Metric</th>
    `;

    compMonths.forEach(m => {
      html += `<th style="text-align: right; min-width: 100px;">${m}</th>`;
    });

    html += `
            <th style="text-align: right; min-width: 110px; background: #f8fafc;">Period Total / Avg</th>
          </tr>
        </thead>
        <tbody>
    `;

    seniorRMs.forEach(rm => {
      const conf = RM_CONFIG[rm];
      let sumTotalLeads = 0;
      let sumWorkable = 0;
      let sumConv = 0;

      // Row 1: Total Leads
      html += `
        <tr style="border-top: 2px solid var(--border-light);">
          <td rowspan="5" style="vertical-align: top; font-weight: 700; background: #ffffff;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.2rem;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background: ${conf.color}"></span>
              <span>${rm}</span>
            </div>
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.2rem; font-weight: normal;">
              ${conf.zone} • Senior RM
            </div>
          </td>
          <td style="font-weight: 600; color: #475569;">Total Incoming Leads</td>
      `;

      compMonths.forEach(m => {
        const val = dashboardData.comparison[m]?.rms?.[rm]?.curr?.totalLeads || 0;
        sumTotalLeads += val;
        html += `<td style="text-align: right; font-weight: 600;">${val > 0 ? val.toLocaleString('en-IN') : '—'}</td>`;
      });
      html += `<td style="text-align: right; font-weight: 700; background: #f8fafc; color: #475569;">${sumTotalLeads.toLocaleString('en-IN')}</td></tr>`;

      // Row 2: Workable Leads
      html += `<tr><td style="font-weight: 600; color: #4f46e5;">Workable Leads</td>`;
      compMonths.forEach(m => {
        const val = dashboardData.comparison[m]?.rms?.[rm]?.curr?.workableLeads || 0;
        sumWorkable += val;
        html += `<td style="text-align: right; font-weight: 600; color: #4f46e5;">${val > 0 ? val.toLocaleString('en-IN') : '—'}</td>`;
      });
      html += `<td style="text-align: right; font-weight: 700; background: #f8fafc; color: #4f46e5;">${sumWorkable.toLocaleString('en-IN')}</td></tr>`;

      // Row 3: Workable %
      html += `<tr><td style="color: var(--text-muted);">Workable % (Eligibility)</td>`;
      compMonths.forEach(m => {
        const c = dashboardData.comparison[m]?.rms?.[rm]?.curr;
        const tot = c?.totalLeads || 0;
        const work = c?.workableLeads || 0;
        const pct = tot > 0 ? ((work / tot) * 100).toFixed(1) : 0;
        html += `<td style="text-align: right; color: var(--text-secondary);">${tot > 0 ? pct + '%' : '—'}</td>`;
      });
      const avgWorkPct = sumTotalLeads > 0 ? ((sumWorkable / sumTotalLeads) * 100).toFixed(1) : 0;
      html += `<td style="text-align: right; font-weight: 600; background: #f8fafc;">${avgWorkPct}%</td></tr>`;

      // Row 4: Conversions
      html += `<tr><td style="font-weight: 600; color: #10b981;">Conversions</td>`;
      compMonths.forEach(m => {
        const val = dashboardData.comparison[m]?.rms?.[rm]?.curr?.conversion || 0;
        sumConv += val;
        html += `<td style="text-align: right; font-weight: 600; color: #10b981;">${val > 0 ? val.toLocaleString('en-IN') : '—'}</td>`;
      });
      html += `<td style="text-align: right; font-weight: 700; background: #f8fafc; color: #10b981;">${sumConv.toLocaleString('en-IN')}</td></tr>`;

      // Row 5: Conversion Rate %
      html += `<tr><td style="color: var(--text-muted);">Conversion % of Workable</td>`;
      compMonths.forEach(m => {
        const c = dashboardData.comparison[m]?.rms?.[rm]?.curr;
        const pctStr = c?.conversionPct || '0%';
        html += `<td style="text-align: right; font-weight: 600;">${pctStr}</td>`;
      });
      const avgConvPct = sumWorkable > 0 ? ((sumConv / sumWorkable) * 100).toFixed(1) : 0;
      html += `<td style="text-align: right; font-weight: 700; background: #f8fafc; color: #047857;">${avgConvPct}%</td></tr>`;
    });

    html += `
        </tbody>
      </table>
    `;

    container.innerHTML = html;
  }

  function renderConversionTrend() {
    const canvas = document.getElementById('chartConversionTrend');
    if (!canvas) return;

    destroyChart('chartConversionTrend');

    const compMonths = getActiveComparisonMonths();
    const seniorRMs = ['Malik', 'Dipali', 'Ramya'].filter(rm => selectedRMs.has(rm));

    const datasets = seniorRMs.map(rm => {
      const dataPoints = compMonths.map(m => {
        const c = dashboardData.comparison[m];
        if (c && c.rms && c.rms[rm] && c.rms[rm].curr) {
          return parseFloat(c.rms[rm].curr.conversionPct) || 0;
        }
        return 0;
      });

      return {
        label: rm,
        data: dataPoints,
        borderColor: RM_CONFIG[rm].color,
        backgroundColor: RM_CONFIG[rm].color,
        borderWidth: 2.5,
        pointRadius: 5,
        tension: 0.2
      };
    });

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: compMonths,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } } },
          tooltip: {
            backgroundColor: '#0f172a',
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}% conversion`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            grid: { color: '#f1f5f9' },
            ticks: { callback: v => v + '%' }
          },
          x: { grid: { color: '#f1f5f9' } }
        }
      }
    });

    registerChart('chartConversionTrend', chart);
  }

  function renderProjectionsVsActuals() {
    const canvas = document.getElementById('chartProjVsActual');
    if (!canvas) return;

    const comp = dashboardData.comparison[comparisonMonth];
    if (!comp || !comp.rms) return;

    const seniorRMs = ['Malik', 'Dipali', 'Ramya'].filter(rm => selectedRMs.has(rm));
    const actuals = [];
    const targets = [];
    const projections = [];

    seniorRMs.forEach(rm => {
      const r = comp.rms[rm];
      actuals.push(r && r.curr ? r.curr.conversion : 0);
      targets.push(r && r.target ? r.target.conversion : 0);
      projections.push(r && r.projection ? r.projection : 0);
    });

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: seniorRMs,
        datasets: [
          { label: 'Target', data: targets, backgroundColor: '#94a3b8', borderRadius: 4 },
          { label: 'Actual (MTD)', data: actuals, backgroundColor: '#4f46e5', borderRadius: 4 },
          { label: 'Projection', data: projections, backgroundColor: '#10b981', borderRadius: 4 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } } },
          tooltip: {
            backgroundColor: '#0f172a',
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('en-IN')}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: '#f1f5f9' },
            ticks: { callback: v => v.toLocaleString('en-IN') }
          },
          x: { grid: { display: false } }
        }
      }
    });

    registerChart('chartProjVsActual', chart);
  }

  function renderPaidAbTrend() {
    const canvas = document.getElementById('chartPaidAbTrend');
    if (!canvas) return;

    destroyChart('chartPaidAbTrend');

    const records = dashboardData.paidAB || [];
    const seniorRMs = ['Malik', 'Dipali', 'Ramya'].filter(rm => selectedRMs.has(rm));
    const titleEl = canvas.closest('.chart-card')?.querySelector('.card-title');

    // Available months in paidAB: 2026-07 to 2026-10
    const availPaidMonths = dashboardData.months.filter(m => selectedMonths.has(m) && ['2026-07', '2026-08', '2026-09', '2026-10'].includes(m));
    const targetMonths = availPaidMonths.length > 0 ? availPaidMonths : ['2026-10'];
    const isMultiMonth = targetMonths.length > 1;

    let filtered = [];
    let labels = [];

    if (isMultiMonth) {
      if (titleEl) titleEl.textContent = `Daily Paid AB Comparison (${targetMonths.map(getMonthLabel).join(', ')})`;
      filtered = records.filter(r => r.date && targetMonths.some(ym => r.date.startsWith(ym)));
      const mNames = { '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct' };
      labels = filtered.map(r => `${r.date.substring(8, 10)}-${mNames[r.date.substring(5, 7)] || ''}`);
    } else {
      const ym = targetMonths[0];
      if (titleEl) titleEl.textContent = `Daily Paid AB Trend (${getMonthLabel(ym)})`;
      filtered = records.filter(r => r.date && r.date.startsWith(ym));
      labels = filtered.map(r => r.date.substring(8, 10));
    }

    if (seniorRMs.length === 0) {
      labels = ['Select Senior RMs in filter'];
    }

    const datasets = seniorRMs.map(rm => ({
      label: rm,
      data: filtered.map(r => r[rm] || 0),
      borderColor: RM_CONFIG[rm].color,
      backgroundColor: RM_CONFIG[rm].color,
      borderWidth: 2,
      pointRadius: isMultiMonth ? 1.8 : 2.5,
      tension: 0.2
    }));

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } } },
          tooltip: {
            backgroundColor: '#0f172a',
            callbacks: {
              title: (items) => `Date: ${filtered[items[0].dataIndex]?.date || items[0].label}`,
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y} Paid ABs`
            }
          }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 10 }, maxRotation: 45 } }
        }
      }
    });

    registerChart('chartPaidAbTrend', chart);
  }

  function renderActiveUsersTrend() {
    const canvas = document.getElementById('chartActiveUsersTrend');
    if (!canvas) return;

    destroyChart('chartActiveUsersTrend');

    const records = dashboardData.activeUsers || [];
    const seniorRMs = ['Malik', 'Dipali', 'Ramya'].filter(rm => selectedRMs.has(rm));
    const titleEl = canvas.closest('.chart-card')?.querySelector('.card-title');

    const availActiveMonths = dashboardData.months.filter(m => selectedMonths.has(m) && ['2026-07', '2026-08', '2026-09', '2026-10'].includes(m));
    const targetMonths = availActiveMonths.length > 0 ? availActiveMonths : ['2026-10'];
    const isMultiMonth = targetMonths.length > 1;

    let filtered = [];
    let labels = [];

    if (isMultiMonth) {
      if (titleEl) titleEl.textContent = `Daily Active Users Comparison (${targetMonths.map(getMonthLabel).join(', ')})`;
      filtered = records.filter(r => r.date && targetMonths.some(ym => r.date.startsWith(ym)));
      const mNames = { '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct' };
      labels = filtered.map(r => `${r.date.substring(8, 10)}-${mNames[r.date.substring(5, 7)] || ''}`);
    } else {
      const ym = targetMonths[0];
      if (titleEl) titleEl.textContent = `Daily Active Users Trend (${getMonthLabel(ym)})`;
      filtered = records.filter(r => r.date && r.date.startsWith(ym));
      labels = filtered.map(r => r.date.substring(8, 10));
    }

    if (seniorRMs.length === 0) {
      labels = ['Select Senior RMs in filter'];
    }

    const datasets = seniorRMs.map(rm => ({
      label: rm,
      data: filtered.map(r => r[rm] || 0),
      borderColor: RM_CONFIG[rm].color,
      backgroundColor: RM_CONFIG[rm].color,
      borderWidth: 2,
      pointRadius: isMultiMonth ? 1.8 : 2.5,
      tension: 0.2
    }));

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } } },
          tooltip: {
            backgroundColor: '#0f172a',
            callbacks: {
              title: (items) => `Date: ${filtered[items[0].dataIndex]?.date || items[0].label}`,
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y} Active Users`
            }
          }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 10 }, maxRotation: 45 } }
        }
      }
    });

    registerChart('chartActiveUsersTrend', chart);
  }

  // =========================================================================
  // SECTION 5: COMPARISONS TAB (RADAR, 25+/25- TABLES, RANKING)
  // =========================================================================
  function renderComparisonsTab() {
    renderRadarChart();
    renderRankingTable();
    renderBucketTables();
  }

  function renderRadarChart() {
    const canvas = document.getElementById('chartRadarComparison');
    if (!canvas) return;

    destroyChart('chartRadarComparison');

    const seniorRMs = ['Malik', 'Dipali', 'Ramya'].filter(rm => selectedRMs.has(rm));
    const metrics = [
      'Dial Volume',
      'Connect Rate',
      'Daily Talktime',
      'Onboardings',
      'Active ABs',
      'Conversion %'
    ];

    const isMultiMonth = selectedMonths.size > 1;
    const monthsArr = dashboardData.months.filter(m => selectedMonths.has(m));
    const titleEl = canvas.closest('.chart-card')?.querySelector('.card-subtitle');
    if (titleEl) {
      titleEl.textContent = `Balanced performance profile across 6 key metrics (${isMultiMonth ? monthsArr.length + ' selected months' : getMonthLabel(selectedMonth)})`;
    }

    // Compute raw metrics for each Senior RM across selected months
    const compObj = dashboardData.comparison[comparisonMonth] || {};
    const rawScores = {};

    seniorRMs.forEach(rm => {
      let dials = 0;
      let connected = 0;
      let talk = 0;
      let working = 0;
      let onb = 0;
      let activeAb = 0;

      monthsArr.forEach(ym => {
        const m = (dashboardData.monthlyByRM[rm] || {})[ym] || {};
        dials += m.totalDials || 0;
        connected += m.totalConnected || 0;
        talk += m.talktime || 0;
        working += m.workingDays || 0;
        onb += m.onboardings || 0;
        activeAb += m.activeAbSum || 0;
      });

      const connRate = dials > 0 ? (connected / dials) * 100 : 0;
      const avgTalk = working > 0 ? talk / working : 0;
      const conv = compObj.rms && compObj.rms[rm] && compObj.rms[rm].curr
        ? parseFloat(compObj.rms[rm].curr.conversionPct) || 0
        : 0;

      rawScores[rm] = [
        dials,
        connRate,
        avgTalk,
        onb,
        activeAb,
        conv
      ];
    });

    // Normalize each metric across RMs to 0-100 scale
    const maxVals = metrics.map((_, idx) => {
      let max = 0;
      seniorRMs.forEach(rm => {
        if (rawScores[rm][idx] > max) max = rawScores[rm][idx];
      });
      return max > 0 ? max : 1;
    });

    const datasets = seniorRMs.map(rm => {
      const normalized = rawScores[rm].map((val, idx) => Math.round((val / maxVals[idx]) * 100));
      const col = RM_CONFIG[rm].color;
      return {
        label: rm,
        data: normalized,
        borderColor: col,
        backgroundColor: RM_CONFIG[rm].subtleColor,
        borderWidth: 2.5,
        pointBackgroundColor: col,
        pointBorderColor: '#ffffff',
        pointHoverRadius: 6
      };
    });

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: metrics,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } } },
          tooltip: {
            backgroundColor: '#0f172a',
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.r}/100 score`
            }
          }
        },
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: { display: false, stepSize: 20 },
            pointLabels: { font: { family: 'Inter', size: 11, weight: 600 }, color: '#334155' },
            grid: { color: '#e2e8f0' },
            angleLines: { color: '#e2e8f0' }
          }
        }
      }
    });

    registerChart('chartRadarComparison', chart);
  }

  function renderRankingTable() {
    const tableBody = document.querySelector('#rankingTable tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const rms = Array.from(selectedRMs);
    const isMultiMonth = selectedMonths.size > 1;
    const monthsArr = dashboardData.months.filter(m => selectedMonths.has(m));
    const compObj = dashboardData.comparison[comparisonMonth] || {};

    const rows = rms.map(rm => {
      let dials = 0;
      let connected = 0;
      let talk = 0;
      let working = 0;
      let onb = 0;
      let consistent = 0;

      monthsArr.forEach(ym => {
        const m = (dashboardData.monthlyByRM[rm] || {})[ym] || {};
        dials += m.totalDials || 0;
        connected += m.totalConnected || 0;
        talk += m.talktime || 0;
        working += m.workingDays || 0;
        onb += m.onboardings || 0;
        consistent += m.consistentDays || 0;
      });

      const connRate = dials > 0 ? (connected / dials) * 100 : 0;
      const avgTalk = working > 0 ? talk / working : 0;
      const consistency = working > 0 ? (consistent / working) * 100 : 0;
      const conv = compObj.rms && compObj.rms[rm] && compObj.rms[rm].curr
        ? compObj.rms[rm].curr.conversionPct
        : 'N/A';

      return {
        rm,
        role: RM_CONFIG[rm].role,
        zone: RM_CONFIG[rm].zone,
        dials,
        connected,
        connRate,
        avgTalk,
        onb,
        convPct: conv,
        consistency
      };
    });

    // Sort by Dials descending by default
    rows.sort((a, b) => b.dials - a.dials);

    rows.forEach((r, idx) => {
      const tr = document.createElement('tr');
      const rankBadge = idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : 'rank-other';
      const conf = RM_CONFIG[r.rm];

      tr.innerHTML = `
        <td style="text-align: center;"><span class="rank-badge ${rankBadge}">${idx + 1}</span></td>
        <td>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${conf.color};"></span>
            <strong>${r.rm}</strong>
          </div>
        </td>
        <td><span class="zone-badge ${conf.badgeClass}">${r.zone}</span></td>
        <td><strong>${formatNumber(r.dials)}</strong></td>
        <td>${formatNumber(r.connected)}</td>
        <td><span class="cell-badge ${r.connRate >= 30 ? 'good' : 'warn'}">${formatPct(r.connRate)}</span></td>
        <td>${formatMinutes(r.avgTalk)}</td>
        <td>${formatNumber(r.onb)}</td>
        <td>${r.convPct}</td>
        <td><span class="cell-badge ${r.consistency >= 80 ? 'good' : 'warn'}">${formatPct(r.consistency, 0)}</span></td>
      `;
      tableBody.appendChild(tr);
    });
  }

  function renderBucketTables() {
    const container = document.getElementById('bucketAnalysisContainer');
    if (!container) return;
    container.innerHTML = '';

    const allBucketMonths = ['Jul-2026', 'Aug-2026', 'Sep-2026', 'Oct-2026'];
    const availBucketLabels = dashboardData.months
      .filter(m => selectedMonths.has(m))
      .map(getMonthLabel)
      .filter(lbl => allBucketMonths.includes(lbl) && dashboardData.bucketAnalysis[lbl]);

    const targetBucketLabels = availBucketLabels.length > 0 ? availBucketLabels : ['Oct-2026'];
    const seniorRMs = ['Malik', 'Dipali', 'Ramya'].filter(rm => selectedRMs.has(rm));

    if (seniorRMs.length === 0) {
      container.innerHTML = `<div style="padding: 2rem; color: var(--text-muted); text-align: center;">25+/25- Volume Bucket Breakdown tracks Senior RMs (Malik, Dipali, Ramya). Please select at least one senior RM.</div>`;
      return;
    }

    // Header with Month Switcher Tabs
    const headerWrapper = document.createElement('div');
    headerWrapper.style.display = 'flex';
    headerWrapper.style.justifyContent = 'space-between';
    headerWrapper.style.alignItems = 'center';
    headerWrapper.style.marginBottom = '1.5rem';
    headerWrapper.style.flexWrap = 'wrap';
    headerWrapper.style.gap = '0.5rem';

    headerWrapper.innerHTML = `
      <div>
        <h3 style="font-size: 1.15rem; font-weight: 700;">25+ / <25 Volume Bucket Breakdown</h3>
        <p style="font-size: 0.8rem; color: var(--text-muted);">Compare High (25+) vs Low (<25) volume lead clusters across months</p>
      </div>
      <div class="month-toggles" id="globalBucketMonthTabs" style="display: flex; gap: 0.35rem;">
        <button type="button" class="month-toggle-btn active" data-bmonth="all">All Selected Months</button>
        ${targetBucketLabels.map(lbl => `<button type="button" class="month-toggle-btn" data-bmonth="${lbl}">${lbl}</button>`).join('')}
      </div>
    `;
    container.appendChild(headerWrapper);

    const tablesContainer = document.createElement('div');
    container.appendChild(tablesContainer);

    function renderMonthTables(monthFilter) {
      tablesContainer.innerHTML = '';
      const monthsToRender = monthFilter === 'all' ? targetBucketLabels : [monthFilter];

      monthsToRender.forEach(mLabel => {
        const bData = dashboardData.bucketAnalysis[mLabel];
        if (!bData) return;

        const monthSection = document.createElement('div');
        monthSection.style.marginBottom = '2.5rem';
        monthSection.innerHTML = `
          <div style="font-weight: 700; font-size: 1rem; margin-bottom: 1rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
            <span class="zone-badge badge-north" style="background: #f1f5f9; color: #334155; font-size: 0.85rem; padding: 0.25rem 0.6rem;">${mLabel}</span>
            <span>Lead Volume Cluster Breakdown</span>
          </div>
        `;

        seniorRMs.forEach(rm => {
          const rObj = bData[rm];
          if (!rObj) return;
          const conf = RM_CONFIG[rm];

          const rmBlock = document.createElement('div');
          rmBlock.style.marginBottom = '1.75rem';
          rmBlock.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background: ${conf.color}"></span>
              <strong style="font-size: 0.95rem;">${rm}</strong>
              <span style="font-size: 0.75rem; color: var(--text-muted);">(${conf.zone})</span>
            </div>
            <div class="bucket-wrapper">
              <!-- High Volume 25+ -->
              <div class="bucket-column">
                <div class="bucket-header high">
                  <span>📈 25+ (High Volume)</span>
                  <span style="font-size: 0.75rem; opacity: 0.9;">High Activity</span>
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

              <!-- Low Volume <25 -->
              <div class="bucket-column">
                <div class="bucket-header low">
                  <span>📉 <25 (Low Volume)</span>
                  <span style="font-size: 0.75rem; opacity: 0.9;">Low Activity</span>
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
          `;
          monthSection.appendChild(rmBlock);
        });

        tablesContainer.appendChild(monthSection);
      });
    }

    renderMonthTables('all');

    document.querySelectorAll('#globalBucketMonthTabs .month-toggle-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('#globalBucketMonthTabs .month-toggle-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const bMonth = e.target.getAttribute('data-bmonth');
        renderMonthTables(bMonth);
      });
    });
  }

  // =========================================================================
  // SECTION 6: CONSISTENCY TAB
  // =========================================================================
  function renderConsistencyTab() {
    renderWorkingDaysChart();
    renderAvgCallsChart();
    renderConsistencyGauge();
    renderDailySparklines();
  }

  function renderWorkingDaysChart() {
    const canvas = document.getElementById('chartWorkingDays');
    if (!canvas) return;

    destroyChart('chartWorkingDays');

    const rms = Array.from(selectedRMs);
    const months = selectedMonths.size > 1
      ? dashboardData.months.filter(m => selectedMonths.has(m))
      : dashboardData.months.slice(-5); // last 5 months
    const labels = months.map(getMonthLabel);

    const datasets = rms.map(rm => ({
      label: rm,
      data: months.map(m => (dashboardData.monthlyByRM[rm][m] || {}).workingDays || 0),
      backgroundColor: RM_CONFIG[rm].color,
      borderRadius: 4
    }));

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } } },
          tooltip: {
            backgroundColor: '#0f172a',
            callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y} working days` }
          }
        },
        scales: {
          y: { beginAtZero: true, max: 31, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false } }
        }
      }
    });

    registerChart('chartWorkingDays', chart);
  }

  function renderAvgCallsChart() {
    const canvas = document.getElementById('chartAvgDailyCalls');
    if (!canvas) return;

    destroyChart('chartAvgDailyCalls');

    const rms = Array.from(selectedRMs);
    const months = selectedMonths.size > 1
      ? dashboardData.months.filter(m => selectedMonths.has(m))
      : dashboardData.months.slice(-5);
    const labels = months.map(getMonthLabel);

    const datasets = rms.map(rm => ({
      label: rm,
      data: months.map(m => {
        const item = dashboardData.monthlyByRM[rm][m];
        if (!item || item.workingDays === 0) return 0;
        return Math.round(item.totalDials / item.workingDays);
      }),
      backgroundColor: RM_CONFIG[rm].color,
      borderRadius: 4
    }));

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } } },
          tooltip: {
            backgroundColor: '#0f172a',
            callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y} dials/day` }
          }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false } }
        }
      }
    });

    registerChart('chartAvgDailyCalls', chart);
  }

  function renderConsistencyGauge() {
    const container = document.getElementById('consistencyGaugeCards');
    if (!container) return;
    container.innerHTML = '';

    const rms = Array.from(selectedRMs);
    const isMultiMonth = selectedMonths.size > 1;
    const monthsArr = dashboardData.months.filter(m => selectedMonths.has(m));

    rms.forEach(rm => {
      let consistentDays = 0;
      let workingDays = 0;

      monthsArr.forEach(ym => {
        const m = (dashboardData.monthlyByRM[rm] || {})[ym] || {};
        consistentDays += (m.consistentDays || 0);
        workingDays += (m.workingDays || 0);
      });

      const score = workingDays > 0 ? Math.round((consistentDays / workingDays) * 100) : 0;
      const conf = RM_CONFIG[rm];

      const card = document.createElement('div');
      card.className = 'card';
      card.style.textAlign = 'center';
      card.innerHTML = `
        <div style="font-weight: 700; margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: center; gap: 0.4rem;">
          <span style="width: 10px; height: 10px; border-radius: 50%; background: ${conf.color};"></span>
          ${rm}
        </div>
        <div style="position: relative; width: 140px; height: 140px; margin: 0 auto;">
          <canvas id="gauge-${rm}" width="140" height="140"></canvas>
          <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <span style="font-size: 1.6rem; font-weight: 800; color: var(--text-primary);">${score}%</span>
            <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: 600;">CONSISTENCY</span>
          </div>
        </div>
        <div style="margin-top: 0.75rem; font-size: 0.75rem; color: var(--text-muted);">
          ${consistentDays} / ${workingDays} days with 50+ connected calls (${isMultiMonth ? monthsArr.length + 'M' : getMonthLabel(selectedMonth)})
        </div>
      `;
      container.appendChild(card);

      setTimeout(() => {
        const c = document.getElementById(`gauge-${rm}`);
        if (!c) return;
        destroyChart(`gauge-${rm}`);
        const gChart = new Chart(c.getContext('2d'), {
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
        registerChart(`gauge-${rm}`, gChart);
      }, 50);
    });
  }

  function renderDailySparklines() {
    const container = document.getElementById('dailySparklineContainer');
    if (!container) return;
    container.innerHTML = '';

    const rms = Array.from(selectedRMs);
    const isMultiMonth = selectedMonths.size > 1;
    const monthsArr = dashboardData.months.filter(m => selectedMonths.has(m));
    const titleEl = container.closest('.card')?.querySelector('.card-subtitle');
    if (titleEl) {
      titleEl.textContent = `Daily dial volume patterns throughout ${isMultiMonth ? monthsArr.length + ' selected months (' + monthsArr.map(getMonthLabel).join(', ') + ')' : getMonthLabel(selectedMonth)}`;
    }

    rms.forEach(rm => {
      let totalPeriodDials = 0;
      let allDailyDials = [];

      monthsArr.forEach(ym => {
        const m = (dashboardData.monthlyByRM[rm] || {})[ym] || {};
        totalPeriodDials += (m.totalDials || 0);
        (m.dailyDials || []).forEach(d => {
          allDailyDials.push(d.dials || 0);
        });
      });

      const conf = RM_CONFIG[rm];

      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.justifyContent = 'space-between';
      item.style.padding = '0.75rem 1rem';
      item.style.background = '#f8fafc';
      item.style.borderRadius = '8px';
      item.style.border = '1px solid #e2e8f0';

      item.innerHTML = `
        <div style="width: 140px;">
          <div style="font-weight: 700; font-size: 0.9rem;">${rm}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">${allDailyDials.length} logging days ${isMultiMonth ? '(' + monthsArr.length + 'M)' : ''}</div>
        </div>
        <div style="flex: 1; height: 35px; margin: 0 1rem;">
          <canvas id="sp-daily-${rm}" width="400" height="35" style="width: 100%; height: 35px;"></canvas>
        </div>
        <div style="text-align: right; width: 110px;">
          <div style="font-weight: 700; font-size: 0.95rem;">${formatNumber(totalPeriodDials)}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">${isMultiMonth ? 'Period Dials' : 'Total Dials'}</div>
        </div>
      `;
      container.appendChild(item);

      setTimeout(() => {
        drawSparkline(`sp-daily-${rm}`, allDailyDials, conf.color);
      }, 50);
    });
  }

})();
