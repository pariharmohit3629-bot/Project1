/**
 * TruthLens AI - Heuristic Red-Flag Analyzer
 * Transparent, rule-based baseline scorer.
 * Evaluates stylistic, syntactic, and structural markers of journalistic reporting vs. sensationalist misinformation.
 * NOTE: This is a heuristic baseline, not an AI or trained machine learning model.
 */

export const REDFLAG_CONFIG = {
  weights: {
    allCapsPenalty: 18,
    excessivePunctuationPenalty: 14,
    clickbaitPhrasePenalty: 20,
    sensationalLanguagePenalty: 18,
    brevityPenalty: 12,
    missingSourcePenalty: 8,
    quotesAttributionReward: 12,
    specificityReward: 12,
    baseScore: 50
  },
  thresholds: {
    capsRatioHigh: 0.18,
    capsRatioMedium: 0.10,
    shortTextLength: 200
  },
  clickbaitPatterns: [
    /you won'?t believe/i,
    /shocking truth/i,
    /what happens next/i,
    /will blow your mind/i,
    /secret they don'?t want you to know/i,
    /doctors (?:hate|hate him|are furious)/i,
    /miracle cure/i,
    /this one weird trick/i,
    /mainstream media won'?t (?:tell|show) you/i,
    /banned (?:everywhere|from tv|by government)/i,
    /the truth about/i,
    /bombshell revelation/i
  ],
  sensationalWords: [
    'miracle', 'conspiracy', 'hoax', 'unbelievable', 'horrifying', 'explosive',
    'mind-blowing', 'terrifying', 'undeniable proof', 'scandalous', 'outrageous',
    'apocalyptic', 'demolished', 'obliterated', 'traitor', 'evil'
  ],
  standardAcronyms: new Set([
    'NASA', 'FBI', 'CIA', 'WHO', 'UN', 'EU', 'NATO', 'COVID', 'AI', 'US', 'USA', 'UK', 'CEO', 'CFO', 'GDP'
  ])
};

/**
 * Analyzes text for journalistic indicators vs red flags.
 * @param {string} headline - News headline
 * @param {string} text - Article text
 * @param {string} [url=''] - Source URL if available
 * @returns {Object} Score (0-100), triggered flags list, and metrics
 */
export function analyzeRedFlags(headline = '', text = '', url = '') {
  const combined = `${headline} ${text}`.trim();
  const flags = [];
  let score = REDFLAG_CONFIG.weights.baseScore;

  if (!combined) {
    return {
      score: 50,
      flags: [{
        id: 'empty_text',
        title: 'Empty content',
        severity: 'high',
        description: 'No text was provided for heuristic analysis.'
      }],
      metrics: {}
    };
  }

  // 1. ALL-CAPS analysis (excluding common short acronyms)
  const words = combined.match(/\b[A-Za-z]{2,}\b/g) || [];
  const totalWords = words.length;
  let allCapsWords = 0;

  for (const w of words) {
    if (w === w.toUpperCase() && !REDFLAG_CONFIG.standardAcronyms.has(w)) {
      allCapsWords++;
    }
  }

  const capsRatio = totalWords > 0 ? (allCapsWords / totalWords) : 0;
  if (capsRatio >= REDFLAG_CONFIG.thresholds.capsRatioHigh) {
    score -= REDFLAG_CONFIG.weights.allCapsPenalty;
    flags.push({
      id: 'high_caps',
      title: 'Excessive capitalization',
      severity: 'high',
      description: `${Math.round(capsRatio * 100)}% of words are in ALL-CAPS. Reputable reporting rarely uses capitalization for emphasis.`
    });
  } else if (capsRatio >= REDFLAG_CONFIG.thresholds.capsRatioMedium) {
    score -= Math.round(REDFLAG_CONFIG.weights.allCapsPenalty / 2);
    flags.push({
      id: 'med_caps',
      title: 'Elevated capitalization',
      severity: 'medium',
      description: 'Noticeable proportion of capitalized words detected.'
    });
  }

  // 2. Excessive punctuation (multiple ! or ?)
  const multiExclamation = (combined.match(/!{2,}|\?{2,}|\?!|!\?/g) || []).length;
  const singleExclamation = (combined.match(/!/g) || []).length;
  if (multiExclamation > 0 || singleExclamation > 3) {
    score -= REDFLAG_CONFIG.weights.excessivePunctuationPenalty;
    flags.push({
      id: 'punctuation_abuse',
      title: 'Sensational punctuation',
      severity: 'high',
      description: 'Multiple exclamation or question marks used to elicit an emotional reaction.'
    });
  }

  // 3. Clickbait headlines/phrases
  let clickbaitMatches = 0;
  for (const pattern of REDFLAG_CONFIG.clickbaitPatterns) {
    if (pattern.test(combined)) {
      clickbaitMatches++;
    }
  }

  if (clickbaitMatches > 0) {
    const penalty = Math.min(REDFLAG_CONFIG.weights.clickbaitPhrasePenalty, clickbaitMatches * 10);
    score -= penalty;
    flags.push({
      id: 'clickbait_phrases',
      title: 'Clickbait phrasing detected',
      severity: 'high',
      description: 'Phrases typical of viral engagement bait or fabricated stories were found.'
    });
  }

  // 4. Highly emotional / sensational language count
  const lowerText = combined.toLowerCase();
  const matchedSensationalWords = REDFLAG_CONFIG.sensationalWords.filter(word => 
    new RegExp(`\\b${word}\\b`, 'i').test(lowerText)
  );

  if (matchedSensationalWords.length >= 3) {
    score -= REDFLAG_CONFIG.weights.sensationalLanguagePenalty;
    flags.push({
      id: 'sensational_words',
      title: 'Emotionally charged vocabulary',
      severity: 'medium',
      description: `High density of emotionally manipulative terms: ${matchedSensationalWords.slice(0, 4).join(', ')}.`
    });
  } else if (matchedSensationalWords.length >= 1) {
    score -= Math.round(REDFLAG_CONFIG.weights.sensationalLanguagePenalty / 2);
    flags.push({
      id: 'mild_sensational',
      title: 'Loaded terminology',
      severity: 'low',
      description: `Contains emotionally charged wording: ${matchedSensationalWords.join(', ')}.`
    });
  }

  // 5. Attributed quotes & named sources (Positive signal)
  const quotePattern = /["“][^"”]{8,}["”]\s*(?:said|stated|told|reported|according to|added|noted)/i;
  const attributionPattern = /(?:according to|reported by|spokesperson for|researchers at|confirmed by)\s+[A-Z][a-z]+/i;
  const hasAttributedQuotes = quotePattern.test(combined) || attributionPattern.test(combined);

  if (hasAttributedQuotes) {
    score += REDFLAG_CONFIG.weights.quotesAttributionReward;
  } else if (text.length > 500) {
    flags.push({
      id: 'no_quotes',
      title: 'Lack of attributed sources',
      severity: 'medium',
      description: 'Longer article lacks direct attribution, named witnesses, or cited official sources.'
    });
  }

  // 6. Concrete specificity: dates, numbers, proper nouns (Positive signal)
  const hasDates = /\b(19\d\d|20\d\d|january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(combined);
  const hasNumbers = /\b\d+(?:\.\d+)?%|\$\d+|\b\d{2,}\b/.test(combined);

  if (hasDates && hasNumbers) {
    score += REDFLAG_CONFIG.weights.specificityReward;
  } else if (!hasDates && !hasNumbers && text.length > 300) {
    flags.push({
      id: 'low_specificity',
      title: 'Low factual specificity',
      severity: 'low',
      description: 'Few verifiable dates, concrete statistics, or specific quantities provided.'
    });
  }

  // 7. Brevity check
  if (text.length < REDFLAG_CONFIG.thresholds.shortTextLength) {
    score -= REDFLAG_CONFIG.weights.brevityPenalty;
    flags.push({
      id: 'very_short',
      title: 'Very brief excerpt',
      severity: 'low',
      description: 'Text is very short, limiting contextual depth and corroborating details.'
    });
  }

  // 8. Missing source link or publication indication
  if (!url) {
    score -= REDFLAG_CONFIG.weights.missingSourcePenalty;
    flags.push({
      id: 'unlinked_source',
      title: 'No source URL provided',
      severity: 'info',
      description: 'No direct web link provided. Verification relies solely on text content.'
    });
  }

  // Clamp final score 0 - 100
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score: finalScore,
    flags,
    metrics: {
      totalWords,
      allCapsWords,
      capsRatio: Number(capsRatio.toFixed(3)),
      multiExclamation,
      clickbaitMatches,
      sensationalWordsCount: matchedSensationalWords.length,
      hasAttributedQuotes,
      hasDates,
      hasNumbers
    }
  };
}
