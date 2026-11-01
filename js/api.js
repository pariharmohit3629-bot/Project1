/**
 * TruthLens AI - API Client
 * Wraps communication with the backend /api/analyze endpoint with timeouts and clear error mapping.
 */

const REQUEST_TIMEOUT_MS = 55000;

/**
 * Sends article content to /api/analyze for Gemini fact-checking.
 * @param {Object} params
 * @param {string} params.headline
 * @param {string} params.text
 * @param {string} [params.url]
 * @returns {Promise<{success: boolean, data?: Object, error?: string, code?: string, fallback_available?: boolean}>}
 */
export async function analyzeArticle({ headline = '', text = '', url = '' }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        headline: headline.trim(),
        text: text.trim(),
        url: url ? url.trim() : ''
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const code = data?.code || `HTTP_${response.status}`;
      let message = data?.error || 'An error occurred during analysis.';

      if (response.status === 429) {
        message = 'Gemini hit its free-tier limit. Wait a minute and try again, or read the red-flag check below.';
      } else if (response.status === 503) {
        message = 'Gemini API key is not configured. Falling back to the heuristic red-flag check.';
      } else if (response.status === 404) {
        message = 'Configured Gemini model was not found. Falling back to heuristic baseline.';
      }

      return {
        success: false,
        error: message,
        code,
        fallback_available: data?.fallback_available ?? true
      };
    }

    if (!data) {
      return {
        success: false,
        error: 'Received empty response from server.',
        code: 'EMPTY_RESPONSE',
        fallback_available: true
      };
    }

    return {
      success: true,
      data
    };
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      return {
        success: false,
        error: 'The request timed out. The server took longer than expected to respond.',
        code: 'TIMEOUT',
        fallback_available: true
      };
    }

    return {
      success: false,
      error: `Could not connect to the analysis service: ${err.message}`,
      code: 'NETWORK_ERROR',
      fallback_available: true
    };
  }
}
