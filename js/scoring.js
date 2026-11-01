/**
 * TruthLens AI - Scoring Aggregator
 * Pure function combining Gemini evidence analysis and heuristic red-flag signals.
 */

export const SCORING_CONFIG = {
  weights: {
    gemini: 0.70,
    redFlags: 0.30
  },
  unverifiableConfidenceCap: 45,
  fallbackConfidence: 35
};

/**
 * Calculates the combined credibility score and metadata.
 * @param {Object} params
 * @param {Object|null} params.geminiResult - Output from Gemini API or null if unavailable
 * @param {Object} params.redFlagResult - Output from analyzeRedFlags()
 * @returns {Object} Comprehensive score breakdown
 */
export function calculateFinalScore({ geminiResult = null, redFlagResult }) {
  const redFlagScore = Math.max(0, Math.min(100, Math.round(redFlagResult?.score ?? 50)));

  // Fallback branch: Gemini is unavailable
  if (!geminiResult || geminiResult.fallback || typeof geminiResult.credibility_score !== 'number') {
    let heuristicVerdict = 'Unverifiable';
    if (redFlagScore >= 75) heuristicVerdict = 'Mostly True';
    else if (redFlagScore >= 50) heuristicVerdict = 'Unverifiable';
    else if (redFlagScore >= 30) heuristicVerdict = 'Misleading';
    else heuristicVerdict = 'False';

    return {
      finalScore: redFlagScore,
      geminiScore: null,
      redFlagScore,
      weights: {
        gemini: 0,
        redFlags: 1.0
      },
      verdict: heuristicVerdict,
      confidence: SCORING_CONFIG.fallbackConfidence,
      isFallback: true,
      isUnverifiable: heuristicVerdict === 'Unverifiable',
      confidenceNote: 'Heuristic baseline only. Gemini analysis was unavailable; confidence is low.'
    };
  }

  // Normal branch: Both signals are available
  const geminiScore = Math.max(0, Math.min(100, Math.round(geminiResult.credibility_score)));
  const weightedScore = Math.round(
    geminiScore * SCORING_CONFIG.weights.gemini +
    redFlagScore * SCORING_CONFIG.weights.redFlags
  );
  const finalScore = Math.max(0, Math.min(100, weightedScore));

  const verdict = geminiResult.verdict || 'Unverifiable';
  const isUnverifiable = verdict === 'Unverifiable';
  let rawConfidence = typeof geminiResult.confidence === 'number' ? geminiResult.confidence : 60;
  rawConfidence = Math.max(0, Math.min(100, Math.round(rawConfidence)));

  let confidence = rawConfidence;
  let confidenceNote = 'Standard evaluation based on verified evidence.';

  if (isUnverifiable) {
    confidence = Math.min(rawConfidence, SCORING_CONFIG.unverifiableConfidenceCap);
    confidenceNote = 'Evidence is insufficient or conflicting; confidence is capped.';
  }

  return {
    finalScore,
    geminiScore,
    redFlagScore,
    weights: { ...SCORING_CONFIG.weights },
    verdict,
    confidence,
    isFallback: false,
    isUnverifiable,
    confidenceNote
  };
}
