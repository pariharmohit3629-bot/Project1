/**
 * TruthLens AI - LocalStorage History Manager
 * Safely stores, retrieves, and deletes past news analyses.
 * Gracefully handles localStorage restrictions and quota exhaustion.
 */

const STORAGE_KEY = 'truthlens_analyses_history_v1';
const MAX_HISTORY_ITEMS = 50;

/**
 * Checks if localStorage is available and writable in the current browsing context.
 * @returns {boolean}
 */
export function isStorageAvailable() {
  try {
    const testKey = '__truthlens_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Retrieves all stored analyses, sorted by timestamp descending.
 * @returns {Array<Object>}
 */
export function getHistory() {
  if (!isStorageAvailable()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[TruthLens Storage] Failed to read history:', err);
    return [];
  }
}

/**
 * Retrieves a single analysis record by ID.
 * @param {string} id
 * @returns {Object|null}
 */
export function getAnalysis(id) {
  if (!id) return null;
  const history = getHistory();
  return history.find(item => item.id === id) || null;
}

/**
 * Saves a new analysis entry to localStorage.
 * Keeps at most MAX_HISTORY_ITEMS items.
 * @param {Object} record
 * @returns {string|null} ID of saved record
 */
export function saveAnalysis(record) {
  if (!isStorageAvailable() || !record) return null;
  try {
    const history = getHistory();
    const id = record.id || `tl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newRecord = {
      ...record,
      id,
      timestamp: record.timestamp || new Date().toISOString()
    };

    // Prepend and enforce limit
    const updated = [newRecord, ...history.filter(h => h.id !== id)].slice(0, MAX_HISTORY_ITEMS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return id;
  } catch (err) {
    console.warn('[TruthLens Storage] Failed to save analysis (quota may be exceeded):', err);
    return null;
  }
}

/**
 * Deletes a single analysis record by ID.
 * @param {string} id
 * @returns {boolean} Success state
 */
export function deleteAnalysis(id) {
  if (!isStorageAvailable() || !id) return false;
  try {
    const history = getHistory();
    const updated = history.filter(item => item.id !== id);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (err) {
    console.warn('[TruthLens Storage] Failed to delete record:', err);
    return false;
  }
}

/**
 * Clears all stored history.
 * @returns {boolean}
 */
export function clearHistory() {
  if (!isStorageAvailable()) return false;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (err) {
    console.warn('[TruthLens Storage] Failed to clear history:', err);
    return false;
  }
}
