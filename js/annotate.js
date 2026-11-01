/**
 * TruthLens AI - Article Text Annotator
 * Renders editorial markup on user text, highlighting claims in-place and linking them to margin notes.
 * Enforces strict XSS safety by escaping all text and model outputs.
 */

export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Finds claim text spans in original text and generates annotated HTML structure.
 * @param {HTMLElement} containerEl - Target element to render into
 * @param {string} originalText - The user-pasted text
 * @param {Array<Object>} claims - Claims returned from Gemini
 */
export function renderAnnotatedArticle(containerEl, originalText, claims = []) {
  if (!containerEl) return;
  containerEl.innerHTML = '';

  const cleanText = originalText || '';
  const validClaims = Array.isArray(claims) ? claims : [];

  // Match spans in text
  // We locate occurrences of claim.text_span without overlaps
  const matches = [];
  const unanchoredClaims = [];

  validClaims.forEach((claim, idx) => {
    const span = (claim.text_span || '').trim();
    if (!span || span.length < 5) {
      unanchoredClaims.push({ claim, index: idx });
      return;
    }

    // Try finding exact or case-insensitive match
    let startIdx = cleanText.indexOf(span);
    if (startIdx === -1) {
      startIdx = cleanText.toLowerCase().indexOf(span.toLowerCase());
    }

    // If still not found, try matching first 30 characters
    if (startIdx === -1 && span.length > 30) {
      const sub = span.slice(0, 30);
      startIdx = cleanText.toLowerCase().indexOf(sub.toLowerCase());
    }

    if (startIdx !== -1) {
      // Check for overlap with existing matches
      const endIdx = startIdx + span.length;
      const overlaps = matches.some(m => 
        (startIdx >= m.start && startIdx < m.end) || 
        (endIdx > m.start && endIdx <= m.end)
      );

      if (!overlaps) {
        matches.push({
          start: startIdx,
          end: endIdx,
          claim,
          index: idx
        });
      } else {
        unanchoredClaims.push({ claim, index: idx });
      }
    } else {
      unanchoredClaims.push({ claim, index: idx });
    }
  });

  // Sort matches by start position
  matches.sort((a, b) => a.start - b.start);

  // Build annotated text with marker tags
  let annotatedHtml = '';
  let cursor = 0;

  for (const m of matches) {
    // Text before highlight
    annotatedHtml += escapeHtml(cleanText.slice(cursor, m.start));
    
    // Highlighted span
    const matchedText = cleanText.slice(m.start, m.end);
    const status = m.claim.status || 'unverified';
    annotatedHtml += `<mark class="claim-highlight highlight-${status}" data-claim-id="${m.index}" tabindex="0" title="Claim: ${escapeHtml(m.claim.claim)}">${escapeHtml(matchedText)}</mark>`;
    cursor = m.end;
  }
  annotatedHtml += escapeHtml(cleanText.slice(cursor));

  // Convert double newlines into paragraphs
  const paragraphs = annotatedHtml.split(/\n\s*\n/).filter(p => p.trim());
  const formattedArticleHtml = paragraphs.length > 0 
    ? paragraphs.map(p => `<p class="article-paragraph">${p.replace(/\n/g, '<br>')}</p>`).join('')
    : `<p class="article-paragraph">${annotatedHtml}</p>`;

  // Create two-column layout wrapper
  const editorLayout = document.createElement('div');
  editorLayout.className = 'editor-layout';

  // Left column: article text
  const articleCol = document.createElement('div');
  articleCol.className = 'article-column';
  articleCol.innerHTML = formattedArticleHtml;

  // Right column: margin notes
  const notesCol = document.createElement('div');
  notesCol.className = 'margin-notes-column';

  // Render margin notes for anchored claims
  if (matches.length > 0) {
    const notesTitle = document.createElement('div');
    notesTitle.className = 'margin-notes-header';
    notesTitle.textContent = 'Claims & margin notes';
    notesCol.appendChild(notesTitle);

    matches.forEach(m => {
      const note = createNoteElement(m.claim, m.index, true);
      notesCol.appendChild(note);
    });
  } else if (unanchoredClaims.length === 0) {
    const emptyNote = document.createElement('p');
    emptyNote.className = 'margin-notes-empty';
    emptyNote.textContent = 'No specific factual claims extracted from this text.';
    notesCol.appendChild(emptyNote);
  }

  editorLayout.appendChild(articleCol);
  editorLayout.appendChild(notesCol);
  containerEl.appendChild(editorLayout);

  // If there are unanchored claims, append a section beneath
  if (unanchoredClaims.length > 0) {
    const unanchoredSec = document.createElement('div');
    unanchoredSec.className = 'unanchored-notes-section';
    
    const unanchoredTitle = document.createElement('h4');
    unanchoredTitle.className = 'section-subheading';
    unanchoredTitle.textContent = 'Additional verified claims (unanchored)';
    unanchoredSec.appendChild(unanchoredTitle);

    const unanchoredGrid = document.createElement('div');
    unanchoredGrid.className = 'unanchored-grid';

    unanchoredClaims.forEach(u => {
      const note = createNoteElement(u.claim, u.index, false);
      unanchoredGrid.appendChild(note);
    });

    unanchoredSec.appendChild(unanchoredGrid);
    containerEl.appendChild(unanchoredSec);
  }

  // Interactive bidirectional linking
  setupInteractiveLinking(containerEl);
}

function createNoteElement(claim, claimId, isAnchored) {
  const noteEl = document.createElement('article');
  const status = claim.status || 'unverified';
  noteEl.className = `margin-note note-${status}`;
  noteEl.setAttribute('data-claim-id', claimId);
  noteEl.setAttribute('tabindex', '0');

  const statusLabel = status.toUpperCase();

  noteEl.innerHTML = `
    <header class="margin-note-head">
      <span class="note-status-indicator status-${status}">${escapeHtml(statusLabel)}</span>
      ${isAnchored ? '<span class="note-anchor-label">In text</span>' : ''}
    </header>
    <div class="note-claim-text">${escapeHtml(claim.claim || '')}</div>
    ${claim.explanation ? `<p class="note-explanation">${escapeHtml(claim.explanation)}</p>` : ''}
  `;

  return noteEl;
}

function setupInteractiveLinking(containerEl) {
  const highlights = containerEl.querySelectorAll('.claim-highlight');
  const notes = containerEl.querySelectorAll('.margin-note');

  function clearActive() {
    highlights.forEach(h => h.classList.remove('is-active'));
    notes.forEach(n => n.classList.remove('is-active'));
  }

  function activate(claimId) {
    clearActive();
    if (claimId === null || claimId === undefined) return;

    const matchedHighlight = containerEl.querySelector(`.claim-highlight[data-claim-id="${claimId}"]`);
    const matchedNote = containerEl.querySelector(`.margin-note[data-claim-id="${claimId}"]`);

    if (matchedHighlight) {
      matchedHighlight.classList.add('is-active');
    }
    if (matchedNote) {
      matchedNote.classList.add('is-active');
      matchedNote.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  highlights.forEach(h => {
    h.addEventListener('click', () => {
      const id = h.getAttribute('data-claim-id');
      activate(id);
    });
    h.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const id = h.getAttribute('data-claim-id');
        activate(id);
      }
    });
  });

  notes.forEach(n => {
    n.addEventListener('click', () => {
      const id = n.getAttribute('data-claim-id');
      activate(id);
    });
    n.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const id = n.getAttribute('data-claim-id');
        activate(id);
      }
    });
  });
}
