/**
 * TruthLens AI - Main Controller
 * Coordinates navigation, theme preferences, form submission,
 * heuristic & AI analysis pipeline, results rendering, and history ledger.
 */

import { analyzeRedFlags } from './redflags.js';
import { calculateFinalScore } from './scoring.js';
import { analyzeArticle } from './api.js';
import { renderAnnotatedArticle, escapeHtml } from './annotate.js';
import { saveAnalysis, getHistory, getAnalysis, deleteAnalysis, clearHistory } from './storage.js';
import { renderDashboard } from './charts.js';

// Pre-packaged realistic sample data
const SAMPLES = {
  real: {
    headline: 'Federal Reserve leaves benchmark interest rate steady at 5.25% to 5.50%',
    text: `WASHINGTON — The Federal Reserve decided on Wednesday to keep its key interest rate unchanged in a range of 5.25% to 5.50%, holding borrowing costs at a 23-year high as officials wait for clearer evidence that inflation is sustainably returning to their 2% target.

In an official statement released after its two-day policy meeting, the Federal Open Market Committee noted that economic activity has continued to expand at a solid pace, with job gains remaining strong and the unemployment rate remaining low at 4.1%.

"Inflation has eased notably over the past year but remains somewhat elevated," Federal Reserve Chair Jerome Powell stated during his press conference. "We are prepared to adjust the stance of monetary policy as appropriate if risks emerge that could impede the attainment of our goals."

Financial markets broadly anticipated the decision. Government statistics released earlier this month confirmed that consumer price inflation slowed to an annual rate of 2.9% in July, down from 3.0% in June.`,
    url: 'https://www.federalreserve.gov/monetarypolicy/fomcpresstatements.htm'
  },
  questionable: {
    headline: 'SHOCKING SECRET: DOCTORS FURIOUS OVER MIRACLE COMPOUND THAT CURES ALL ILLNESSES OVERNIGHT!!',
    text: `YOU WON'T BELIEVE WHAT BIG PHARMA AND THE CORRUPT MAINSTREAM MEDIA ARE HIDING FROM YOU!! A revolutionary miracle mineral discovered deep underground has been 100% proven to destroy all chronic disease and reverse aging in just 24 hours!! 

The greedy medical establishment is completely terrified because this secret cure requires zero prescription drugs and zero hospital visits. Corrupt government regulators have banned discussion of this discovery from television and social media to protect their billions in profits! 

Everyone must share this urgent message before it gets permanently censored and deleted from the internet forever!! Act right now before supplies vanish completely!!`,
    url: ''
  }
};

// DOM Elements
const navLinks = document.querySelectorAll('.nav-link');
const tabPanes = document.querySelectorAll('.tab-pane');
const themeToggleBtn = document.getElementById('theme-toggle');

const form = document.getElementById('analyze-form');
const headlineInput = document.getElementById('input-headline');
const textInput = document.getElementById('input-text');
const urlInput = document.getElementById('input-url');
const charCounter = document.getElementById('char-counter');
const submitBtn = document.getElementById('btn-submit');
const loadingIndicator = document.getElementById('loading-indicator');
const noticeBox = document.getElementById('analysis-notice');

const btnSampleReal = document.getElementById('btn-sample-real');
const btnSampleFake = document.getElementById('btn-sample-fake');

const resultsContainer = document.getElementById('results-container');
const resVerdict = document.getElementById('res-verdict');
const resSummary = document.getElementById('res-summary');
const resExplanation = document.getElementById('res-explanation');
const resRecommendation = document.getElementById('res-recommendation');

const rulerTicksContainer = document.getElementById('ruler-ticks');
const pointerFinal = document.getElementById('pointer-final');
const pointerGemini = document.getElementById('pointer-gemini');
const pointerRedflags = document.getElementById('pointer-redflags');
const labelFinal = document.getElementById('label-final');
const labelGemini = document.getElementById('label-gemini');
const labelRedflags = document.getElementById('label-redflags');

const annotatedMount = document.getElementById('annotated-article-mount');
const listRedflags = document.getElementById('list-redflags');
const sourceDetails = document.getElementById('source-details');
const listSupporting = document.getElementById('list-supporting');
const listContradicting = document.getElementById('list-contradicting');
const groundingSourcesList = document.getElementById('grounding-sources-list');

const historyTable = document.getElementById('history-table');
const historyTbody = document.getElementById('history-tbody');
const historyEmpty = document.getElementById('history-empty');
const btnClearHistory = document.getElementById('btn-clear-history');

const dashSummarySentence = document.getElementById('dash-summary-sentence');
const chartVerdictsCanvas = document.getElementById('chart-verdicts');
const chartTrendCanvas = document.getElementById('chart-trend');
const dashboardEmpty = document.getElementById('dashboard-empty');

// Setup Ruler Ticks
function initRulerTicks() {
  if (!rulerTicksContainer) return;
  rulerTicksContainer.innerHTML = '';
  for (let i = 0; i <= 100; i += 5) {
    const tick = document.createElement('div');
    tick.className = i % 25 === 0 ? 'ruler-tick major' : 'ruler-tick';
    rulerTicksContainer.appendChild(tick);
  }
}

// Tab Navigation
function switchTab(tabId) {
  navLinks.forEach(link => {
    link.classList.toggle('is-active', link.dataset.tab === tabId);
  });
  tabPanes.forEach(pane => {
    pane.classList.toggle('is-active', pane.id === `pane-${tabId}`);
  });

  if (tabId === 'history') {
    renderHistoryTable();
  } else if (tabId === 'dashboard') {
    const history = getHistory();
    renderDashboard(history, {
      summaryEl: dashSummarySentence,
      verdictCanvas: chartVerdictsCanvas,
      trendCanvas: chartTrendCanvas,
      emptyEl: dashboardEmpty
    });
  }
}

function initNavigation() {
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = link.dataset.tab;
      window.location.hash = tab;
      switchTab(tab);
    });
  });

  document.getElementById('brand-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.hash = 'analyze';
    switchTab('analyze');
  });

  // Handle direct hash navigation
  const currentHash = window.location.hash.replace('#', '') || 'analyze';
  switchTab(currentHash);

  window.addEventListener('hashchange', () => {
    const h = window.location.hash.replace('#', '') || 'analyze';
    switchTab(h);
  });
}

// Theme handling
function initTheme() {
  const saved = localStorage.getItem('truthlens_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialDark = saved ? saved === 'dark' : prefersDark;

  if (initialDark) {
    document.documentElement.setAttribute('data-theme', 'dark');
    if (themeToggleBtn) themeToggleBtn.textContent = 'Light mode';
  } else {
    document.documentElement.removeAttribute('data-theme');
    if (themeToggleBtn) themeToggleBtn.textContent = 'Dark mode';
  }

  themeToggleBtn?.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('truthlens_theme', 'light');
      themeToggleBtn.textContent = 'Dark mode';
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('truthlens_theme', 'dark');
      themeToggleBtn.textContent = 'Light mode';
    }

    // Refresh dashboard if visible
    if (document.getElementById('pane-dashboard')?.classList.contains('is-active')) {
      const history = getHistory();
      renderDashboard(history, {
        summaryEl: dashSummarySentence,
        verdictCanvas: chartVerdictsCanvas,
        trendCanvas: chartTrendCanvas,
        emptyEl: dashboardEmpty
      });
    }
  });
}

// Samples loader
function initSamples() {
  btnSampleReal?.addEventListener('click', () => {
    headlineInput.value = SAMPLES.real.headline;
    textInput.value = SAMPLES.real.text;
    urlInput.value = SAMPLES.real.url;
    updateCharCount();
  });

  btnSampleFake?.addEventListener('click', () => {
    headlineInput.value = SAMPLES.questionable.headline;
    textInput.value = SAMPLES.questionable.text;
    urlInput.value = SAMPLES.questionable.url;
    updateCharCount();
  });
}

// Character counter
function updateCharCount() {
  if (!textInput || !charCounter) return;
  const count = textInput.value.length;
  charCounter.textContent = `${count} characters`;
  if (count < 40) {
    charCounter.style.color = 'var(--pen-unverified)';
  } else if (count > 15000) {
    charCounter.style.color = 'var(--pen-contradicted)';
  } else {
    charCounter.style.color = 'var(--color-ink-muted)';
  }
}

// Loading state manager
let loadingInterval = null;
function startLoading() {
  if (submitBtn) submitBtn.disabled = true;
  if (!loadingIndicator) return;
  loadingIndicator.classList.add('is-active');

  const steps = [
    'Reading the article...',
    'Extracting factual claims...',
    'Checking sources against live evidence...'
  ];
  let stepIdx = 0;
  loadingIndicator.textContent = steps[0];

  loadingInterval = setInterval(() => {
    stepIdx = (stepIdx + 1) % steps.length;
    loadingIndicator.textContent = steps[stepIdx];
  }, 2200);
}

function stopLoading() {
  if (submitBtn) submitBtn.disabled = false;
  if (loadingIndicator) {
    loadingIndicator.classList.remove('is-active');
  }
  if (loadingInterval) {
    clearInterval(loadingInterval);
    loadingInterval = null;
  }
}

// Results display renderer
function displayResults({ headline, text, url, scoring, result, redFlags, isFallback = false, fallbackReason = '' }) {
  if (!resultsContainer) return;
  resultsContainer.classList.add('is-active');

  // 1. Notice banner
  if (isFallback && noticeBox) {
    noticeBox.style.display = 'block';
    noticeBox.textContent = `Gemini analysis unavailable: ${fallbackReason}. Displaying heuristic red-flag evaluation.`;
  } else if (noticeBox) {
    noticeBox.style.display = 'none';
  }

  // 2. Verdict Typography
  const verdict = scoring.verdict || 'Unverifiable';
  resVerdict.textContent = verdict;
  resVerdict.className = `verdict-title verdict-${verdict.toLowerCase().replace(/\s+/g, '-')}`;

  resSummary.textContent = result?.summary || (
    verdict === 'True' || verdict === 'Mostly True' 
      ? 'Factual claims are corroborated by reporting with sound journalistic structure.'
      : verdict === 'False' || verdict === 'Misleading'
      ? 'Significant contradictions or deceptive style markers identified in this excerpt.'
      : 'Evidence is insufficient or conflicting; claims cannot be definitively verified.'
  );

  resExplanation.textContent = result?.explanation || scoring.confidenceNote || '';

  // 3. Score Ruler Markers
  const finalScore = scoring.finalScore;
  const redFlagScore = scoring.redFlagScore;
  const geminiScore = scoring.geminiScore;

  pointerFinal.style.left = `${finalScore}%`;
  labelFinal.textContent = `Final ${finalScore}`;

  pointerRedflags.style.left = `${redFlagScore}%`;
  labelRedflags.textContent = `Heuristic ${redFlagScore}`;

  if (geminiScore !== null && typeof geminiScore === 'number') {
    pointerGemini.style.display = 'block';
    pointerGemini.style.left = `${geminiScore}%`;
    labelGemini.textContent = `Gemini ${geminiScore}`;
  } else {
    pointerGemini.style.display = 'none';
  }

  // 4. Annotated Article Text + Margin Notes
  const claims = result?.claims || [];
  renderAnnotatedArticle(annotatedMount, text, claims);

  // 5. Red-Flags Section
  listRedflags.innerHTML = '';
  if (redFlags?.flags && redFlags.flags.length > 0) {
    redFlags.flags.forEach(flag => {
      const li = document.createElement('li');
      li.className = 'editorial-list-item';
      li.innerHTML = `<strong>${escapeHtml(flag.title)}:</strong> ${escapeHtml(flag.description)}`;
      listRedflags.appendChild(li);
    });
  } else {
    const li = document.createElement('li');
    li.className = 'editorial-list-item';
    li.textContent = 'No significant syntactic or stylistic red flags triggered in this excerpt.';
    listRedflags.appendChild(li);
  }

  // 6. Source Assessment
  sourceDetails.innerHTML = '';
  const sa = result?.source_assessment;
  if (sa) {
    sourceDetails.innerHTML = `
      <p class="editorial-list-item">
        <strong>Source identified:</strong> ${escapeHtml(sa.source_name || 'Unattributed')}
        <br>
        <strong>Reliability tier:</strong> ${escapeHtml(sa.reliability || 'Unknown')}
        ${sa.notes ? `<br><strong>Notes:</strong> ${escapeHtml(sa.notes)}` : ''}
      </p>
    `;
  } else {
    sourceDetails.innerHTML = `<p class="editorial-list-item">No source attribution provided in the text or URL.</p>`;
  }

  // 7. Supporting Evidence
  listSupporting.innerHTML = '';
  const supList = result?.supporting_evidence || [];
  if (supList.length > 0) {
    supList.forEach(item => {
      const li = document.createElement('li');
      li.className = 'editorial-list-item';
      li.innerHTML = `${escapeHtml(item.point)}${item.source ? ` <span class="source-citation">— ${escapeHtml(item.source)}</span>` : ''}`;
      listSupporting.appendChild(li);
    });
  } else {
    const li = document.createElement('li');
    li.className = 'editorial-list-item';
    li.textContent = 'No verified supporting evidence documented for this submission.';
    listSupporting.appendChild(li);
  }

  // 8. Contradicting Evidence
  listContradicting.innerHTML = '';
  const conList = result?.contradicting_evidence || [];
  if (conList.length > 0) {
    conList.forEach(item => {
      const li = document.createElement('li');
      li.className = 'editorial-list-item';
      li.innerHTML = `${escapeHtml(item.point)}${item.source ? ` <span class="source-citation">— ${escapeHtml(item.source)}</span>` : ''}`;
      listContradicting.appendChild(li);
    });
  } else {
    const li = document.createElement('li');
    li.className = 'editorial-list-item';
    li.textContent = 'No direct counter-evidence or documented debunking found for these claims.';
    listContradicting.appendChild(li);
  }

  // 9. Verified Sources (Real links only, https only)
  groundingSourcesList.innerHTML = '';
  const sources = result?.sources || [];
  if (sources.length > 0) {
    sources.forEach(src => {
      if (src.uri && /^https:\/\//i.test(src.uri)) {
        const p = document.createElement('p');
        p.className = 'source-item';
        p.innerHTML = `<a href="${escapeHtml(src.uri)}" target="_blank" rel="noopener noreferrer">${escapeHtml(src.title || src.uri)}</a>`;
        groundingSourcesList.appendChild(p);
      }
    });
  } else {
    groundingSourcesList.innerHTML = `<p class="source-item" style="color: var(--color-ink-muted);">No external search citations were attached to this result.</p>`;
  }

  // 10. Recommendation
  resRecommendation.textContent = result?.recommendation || 'Compare key statements against coverage from multiple independent news wire services.';

  // Scroll smoothly to results
  resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Synthesize heuristic claims when Gemini is unavailable
function synthesizeFallbackClaims(text, redFlags) {
  const claims = [];
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 15);

  if (sentences.length > 0) {
    // Pick first sentence as representative
    const firstSentence = sentences[0].slice(0, 180);
    const isSevere = redFlags.score < 40;
    claims.push({
      claim: firstSentence,
      text_span: firstSentence,
      status: isSevere ? 'contradicted' : (redFlags.score > 65 ? 'supported' : 'unverified'),
      explanation: isSevere 
        ? 'Matches stylistic patterns of sensationalism or deceptive framing.'
        : 'Requires corroboration from reliable reporting.'
    });
  }

  return claims;
}

// History Table Renderer
function renderHistoryTable() {
  const history = getHistory();
  if (!historyTable || !historyTbody || !historyEmpty) return;

  historyTbody.innerHTML = '';

  if (history.length === 0) {
    historyTable.style.display = 'none';
    historyEmpty.style.display = 'block';
    return;
  }

  historyTable.style.display = 'table';
  historyEmpty.style.display = 'none';

  history.forEach(item => {
    const tr = document.createElement('tr');
    tr.className = 'ledger-row';

    const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : 'Recent';

    const headlineText = item.headline || (item.text ? item.text.slice(0, 50) + '...' : 'Untitled Analysis');
    const verdict = item.scoring?.verdict || item.result?.verdict || 'Unverifiable';
    const score = item.scoring?.finalScore ?? item.result?.credibility_score ?? 50;

    tr.innerHTML = `
      <td>${escapeHtml(dateStr)}</td>
      <td>
        <a href="#analyze" class="ledger-headline" data-open-id="${escapeHtml(item.id)}">${escapeHtml(headlineText)}</a>
      </td>
      <td><span class="ledger-verdict verdict-${verdict.toLowerCase().replace(/\s+/g, '-')}">${escapeHtml(verdict)}</span></td>
      <td><strong>${score}</strong>/100</td>
      <td>
        <button type="button" class="ledger-delete-btn" data-delete-id="${escapeHtml(item.id)}">Delete</button>
      </td>
    `;

    historyTbody.appendChild(tr);
  });

  // Attach row click listeners
  historyTbody.querySelectorAll('[data-open-id]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const id = link.getAttribute('data-open-id');
      const record = getAnalysis(id);
      if (record) {
        headlineInput.value = record.headline || '';
        textInput.value = record.text || '';
        urlInput.value = record.url || '';
        updateCharCount();
        switchTab('analyze');
        displayResults({
          headline: record.headline,
          text: record.text,
          url: record.url,
          scoring: record.scoring,
          result: record.result,
          redFlags: record.redFlags,
          isFallback: record.scoring?.isFallback
        });
      }
    });
  });

  historyTbody.querySelectorAll('[data-delete-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-delete-id');
      if (id) {
        deleteAnalysis(id);
        renderHistoryTable();
      }
    });
  });
}

function initHistoryActions() {
  btnClearHistory?.addEventListener('click', () => {
    if (confirm('Clear all stored verification history?')) {
      clearHistory();
      renderHistoryTable();
    }
  });
}

// Form Submission Handler
function initForm() {
  textInput?.addEventListener('input', updateCharCount);

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const headline = headlineInput.value.trim();
    const text = textInput.value.trim();
    const url = urlInput.value.trim();

    if (text.length < 40) {
      alert('Please provide at least 40 characters of article text to evaluate.');
      textInput.focus();
      return;
    }

    if (text.length > 15000) {
      alert('The article text exceeds 15,000 characters. Please provide a shorter excerpt.');
      textInput.focus();
      return;
    }

    // 1. Run local heuristic baseline analysis immediately
    const redFlagResult = analyzeRedFlags(headline, text, url);

    // 2. Start server-side AI evaluation
    startLoading();

    const apiResponse = await analyzeArticle({ headline, text, url });
    stopLoading();

    let scoring = null;
    let result = null;
    let isFallback = false;
    let fallbackReason = '';

    if (apiResponse.success && apiResponse.data) {
      result = apiResponse.data;
      scoring = calculateFinalScore({ geminiResult: result, redFlagResult });
    } else {
      isFallback = true;
      fallbackReason = apiResponse.error || 'Server-side evaluation unavailable.';
      scoring = calculateFinalScore({ geminiResult: null, redFlagResult });
      
      // Synthesize fallback result object so the editorial view displays smoothly
      const fallbackClaims = synthesizeFallbackClaims(text, redFlagResult);
      result = {
        verdict: scoring.verdict,
        confidence: scoring.confidence,
        credibility_score: scoring.finalScore,
        summary: `Heuristic assessment: ${scoring.verdict}. Stylistic markers suggest a credibility rating of ${scoring.finalScore}/100.`,
        explanation: `${fallbackReason} The analysis below is based entirely on syntax, capitalization, sensationalism, and source attribution heuristics.`,
        claims: fallbackClaims,
        source_assessment: {
          source_name: url ? 'Linked website' : 'Unspecified',
          reliability: 'Unknown',
          notes: 'Source could not be cross-referenced via live search.'
        },
        supporting_evidence: [],
        contradicting_evidence: [],
        sources: url ? [{ title: 'Provided URL', uri: url }] : [],
        recommendation: 'Cross-check key assertions against trusted wire services.'
      };
    }

    // Save record to local storage
    saveAnalysis({
      headline,
      text,
      url,
      scoring,
      result,
      redFlags: redFlagResult
    });

    // Display the results
    displayResults({
      headline,
      text,
      url,
      scoring,
      result,
      redFlags: redFlagResult,
      isFallback,
      fallbackReason
    });
  });
}

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  initRulerTicks();
  initTheme();
  initNavigation();
  initSamples();
  initHistoryActions();
  initForm();
});
