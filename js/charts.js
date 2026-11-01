/**
 * TruthLens AI - Dashboard Charts
 * Renders flat, editorial data visualizations using Chart.js.
 * Enforces the design brief: horizontal bars for verdicts, flat score line, direct labels, no gradients.
 */

let verdictChartInstance = null;
let trendChartInstance = null;

/**
 * Calculates summary statistics from history records.
 * @param {Array<Object>} history
 * @returns {Object}
 */
export function calculateStats(history = []) {
  if (!history || history.length === 0) {
    return {
      total: 0,
      averageScore: 0,
      mostCommonVerdict: 'None',
      summarySentence: 'No analyses recorded yet. Paste an article to start.'
    };
  }

  const total = history.length;
  let totalScore = 0;
  const verdictCounts = {
    'True': 0,
    'Mostly True': 0,
    'Misleading': 0,
    'False': 0,
    'Unverifiable': 0
  };

  history.forEach(item => {
    const score = item.scoring?.finalScore ?? item.result?.credibility_score ?? 50;
    totalScore += score;
    const verdict = item.scoring?.verdict || item.result?.verdict || 'Unverifiable';
    if (verdictCounts[verdict] !== undefined) {
      verdictCounts[verdict]++;
    } else {
      verdictCounts['Unverifiable']++;
    }
  });

  const averageScore = Math.round(totalScore / total);

  // Find most frequent verdict
  let maxCount = -1;
  let mostCommonVerdict = 'Unverifiable';
  for (const [v, count] of Object.entries(verdictCounts)) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonVerdict = v;
    }
  }

  const summarySentence = `${total} ${total === 1 ? 'analysis' : 'analyses'}, average credibility score ${averageScore}, most often ${mostCommonVerdict}.`;

  return {
    total,
    averageScore,
    mostCommonVerdict,
    verdictCounts,
    summarySentence
  };
}

/**
 * Renders the dashboard view with charts and sentence summary.
 * @param {Array<Object>} history
 * @param {Object} elements - DOM elements for charts and summary
 */
export function renderDashboard(history = [], { summaryEl, verdictCanvas, trendCanvas, emptyEl }) {
  const stats = calculateStats(history);

  if (summaryEl) {
    summaryEl.textContent = stats.summarySentence;
  }

  if (stats.total === 0) {
    if (emptyEl) emptyEl.style.display = 'block';
    if (verdictCanvas) verdictCanvas.style.display = 'none';
    if (trendCanvas) trendCanvas.style.display = 'none';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';
  if (verdictCanvas) verdictCanvas.style.display = 'block';
  if (trendCanvas) trendCanvas.style.display = 'block';

  // Check if Chart.js is loaded
  if (typeof window.Chart === 'undefined') {
    console.warn('[TruthLens Charts] Chart.js is not loaded.');
    return;
  }

  // Detect dark theme
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#E4E9EE' : '#15202B';
  const gridColor = isDark ? '#2C3946' : '#C8D0D8';

  // Destroy previous instances
  if (verdictChartInstance) {
    verdictChartInstance.destroy();
    verdictChartInstance = null;
  }
  if (trendChartInstance) {
    trendChartInstance.destroy();
    trendChartInstance = null;
  }

  // 1. Horizontal bar chart for verdicts
  const verdicts = ['True', 'Mostly True', 'Misleading', 'False', 'Unverifiable'];
  const counts = verdicts.map(v => stats.verdictCounts[v] || 0);

  // Editorial bar colors
  const barColors = isDark
    ? ['#3EA87B', '#5FA886', '#C78C26', '#CF4840', '#8899A8']
    : ['#2E7D5B', '#489B77', '#A8730F', '#B3261E', '#6B7A88'];

  if (verdictCanvas) {
    const ctx = verdictCanvas.getContext('2d');
    verdictChartInstance = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: verdicts,
        datasets: [{
          label: 'Count',
          data: counts,
          backgroundColor: barColors,
          borderWidth: 0,
          borderRadius: 2
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            callbacks: {
              label: (context) => `${context.parsed.x} articles`
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
              color: textColor,
              font: { family: 'Instrument Sans, sans-serif' }
            },
            grid: { color: gridColor }
          },
          y: {
            ticks: {
              color: textColor,
              font: { family: 'Instrument Sans, sans-serif', weight: '500' }
            },
            grid: { display: false }
          }
        }
      }
    });
  }

  // 2. Flat line chart for score trend over time (oldest to newest)
  if (trendCanvas) {
    const chronological = [...history].reverse();
    const trendLabels = chronological.map((_, i) => `#${i + 1}`);
    const trendScores = chronological.map(item => 
      item.scoring?.finalScore ?? item.result?.credibility_score ?? 50
    );

    const ctxTrend = trendCanvas.getContext('2d');
    trendChartInstance = new window.Chart(ctxTrend, {
      type: 'line',
      data: {
        labels: trendLabels,
        datasets: [{
          label: 'Score',
          data: trendScores,
          borderColor: isDark ? '#4F88B8' : '#1F4E79',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointBackgroundColor: isDark ? '#4F88B8' : '#1F4E79',
          pointRadius: 4,
          pointHoverRadius: 6,
          pointStyle: 'rect',
          tension: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                const idx = items[0].dataIndex;
                const record = chronological[idx];
                return record.headline ? record.headline.slice(0, 45) : `Analysis #${idx + 1}`;
              },
              label: (item) => `Score: ${item.parsed.y}/100`
            }
          }
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: {
              stepSize: 20,
              color: textColor,
              font: { family: 'Instrument Sans, sans-serif' }
            },
            grid: { color: gridColor }
          },
          x: {
            ticks: {
              color: textColor,
              font: { family: 'Instrument Sans, sans-serif' }
            },
            grid: { color: gridColor }
          }
        }
      }
    });
  }
}
