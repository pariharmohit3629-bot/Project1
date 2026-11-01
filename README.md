# TruthLens AI – Fake News Detection System

TruthLens AI is a transparent, copy-editor-inspired news verification and claim-checking web application built for an AI/ML hackathon. It combines an in-browser heuristic sanity check with server-side, search-grounded Google Gemini AI to evaluate news stories, extract factual claims, highlight evidence directly inside the user's text, and assess source credibility.

---

## Features

- **Copy-Editor Text Annotation**: Claims are highlighted directly within the user's article text (green for supported, red for contradicted, amber for unverified), with interactive margin notes explaining each finding.
- **Dual-Signal Credibility Assessment**:
  1. **Heuristic Red-Flag Baseline**: An in-browser rule set evaluating uppercase ratio, sensational punctuation, clickbait phrases, emotional language, attributed quotations, and concrete dates and numbers.
  2. **Search-Grounded Gemini Analysis**: Serverless Node.js backend calling Google Gemini (with Google Search grounding), cross-referencing real-time web reporting.
- **Combined Credibility Score**: A horizontal score ruler (0–100) displaying the combined weighted score along with separate markers for Gemini evidence and heuristic signals.
- **Editorial Evidence Breakdown**: Structured sections for heuristic red flags, source reliability assessment, supporting evidence, contradicting evidence, verified external citations, and reader recommendations.
- **In-Browser History Ledger**: Ruled ledger table tracking past analyses (headline, verdict, score, date) stored safely in `localStorage`.
- **Flat Analytics Dashboard**: Chart.js horizontal bar charts for verdict distribution, score trend line over time, and a natural-language summary sentence.
- **Cool Paper-and-Ink Design**: High-contrast, accessibility-first theme (Newsreader serif + Instrument Sans), with full dark mode toggle and zero decorative fluff.
- **Graceful Fallback**: If Gemini encounters rate limits or API outages, the system automatically falls back to the transparent heuristic baseline with clear notices.

---

## Tech Stack

- **Frontend**: Plain HTML5, CSS3 (CSS Custom Properties, two-column CSS Grid), Vanilla JavaScript (ES Modules).
- **Visualizations**: Chart.js (pinned CDN version `4.4.1`).
- **Backend / Serverless**: Node.js serverless functions (`/api/analyze`, `/api/health`) on Vercel with zero npm dependencies (using native `fetch` to call Google Gemini REST API).
- **Local Dev Server**: Lightweight zero-dependency Node.js HTTP server (`dev-server.js`).
- **Testing**: In-browser unit test suite (`tests/test.html`) testing pure heuristic rules and scoring logic.

---

## Project Structure

```
.
├── index.html                # Single-page application (Analyze, History, Dashboard, About)
├── css/
│   └── style.css             # Paper-and-ink styling, marker pen highlights, typography
├── js/
│   ├── app.js                # Application controller, navigation, theme, form handling
│   ├── api.js                # API client with timeout and error mapping
│   ├── annotate.js           # In-text claim highlighter and interactive margin notes
│   ├── redflags.js           # Transparent rule-based heuristic baseline analyzer
│   ├── scoring.js            # Pure function calculating weighted credibility score
│   ├── storage.js            # Safe localStorage history manager with try/catch
│   └── charts.js             # Flat Chart.js visualizations and summary generator
├── api/
│   ├── analyze.js            # Vercel serverless function calling Gemini with search grounding
│   └── health.js             # Health check endpoint ({ ok: true })
├── dev-server.js             # Tiny zero-dependency local Node.js server
├── vercel.json               # Function maxDuration configuration and security headers
├── tests/
│   └── test.html             # In-browser test suite for scoring.js and redflags.js
├── .env.example              # Template with environment variable placeholders
├── .gitignore                # Protects secrets (.env, .env.local, .vercel)
└── README.md                 # Complete documentation and setup guide
```

---

## How to Run Locally

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or newer). No extra dependencies or `npm install` required!

### 2. Environment Setup
1. Copy `.env.example` to create your local `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Open `.env.local` and add your Google Gemini API key:
   ```env
   GEMINI_API_KEY=your_actual_api_key_here
   GEMINI_MODEL=gemini-3.8-flash
   ENABLE_GROUNDING=true
   ```
   *(Get an API key at [Google AI Studio](https://aistudio.google.com/)).*

### 3. Start the Development Server
Run the local dev server:
```bash
node dev-server.js
```

Open your browser to:
- **Application**: [http://127.0.0.1:5000](http://127.0.0.1:5000)
- **Unit Test Runner**: [http://127.0.0.1:5000/tests/test.html](http://127.0.0.1:5000/tests/test.html)

---

## How to Deploy on Vercel

1. Push your repository to GitHub (`pariharmohit3629-bot/Project1`).
2. Log into [Vercel](https://vercel.com/) and click **"Add New Project"**.
3. Import the `Project1` repository.
4. Configure Project Settings:
   - **Framework Preset**: Select **"Other"**.
   - **Root Directory**: `./` (leave default).
   - **Build Command**: Leave empty (no build step).
   - **Output Directory**: Leave empty.
5. In **Environment Variables**, add:
   - `GEMINI_API_KEY` = your Google Gemini API key
   - `GEMINI_MODEL` = `gemini-3.8-flash`
   - `ENABLE_GROUNDING` = `true`
6. Click **Deploy**. Vercel will deploy the static root and host the serverless functions in `/api`.

---

## API Reference

### 1. `POST /api/analyze`
Submits an article for credibility and claim verification.

**Headers:**
- `Content-Type: application/json`

**Request Body:**
```json
{
  "headline": "Federal Reserve leaves benchmark interest rate steady",
  "text": "WASHINGTON — The Federal Reserve decided on Wednesday to keep...",
  "url": "https://www.federalreserve.gov/monetarypolicy/fomcpresstatements.htm"
}
```

**Response (`200 OK`):**
```json
{
  "verdict": "True",
  "confidence": 92,
  "credibility_score": 95,
  "summary": "Factual claims are corroborated by primary government reporting.",
  "explanation": "Multiple official sources confirm the interest rate pause.",
  "claims": [
    {
      "claim": "Interest rates remain unchanged between 5.25% and 5.50%",
      "text_span": "keep its key interest rate unchanged in a range of 5.25% to 5.50%",
      "status": "supported",
      "explanation": "Confirmed by FOMC policy release."
    }
  ],
  "red_flags": [],
  "source_assessment": {
    "source_name": "Federal Reserve Board",
    "reliability": "High",
    "notes": "Official central bank communication."
  },
  "supporting_evidence": [
    {
      "point": "FOMC July 2024 statement confirms rate target.",
      "source": "https://www.federalreserve.gov"
    }
  ],
  "contradicting_evidence": [],
  "sources": [
    {
      "title": "FOMC Statement",
      "uri": "https://www.federalreserve.gov"
    }
  ],
  "recommendation": "Review primary FOMC press release transcripts.",
  "analyzed_at": "2026-11-01T07:00:00.000Z"
}
```

### 2. `GET /api/health`
Lightweight endpoint for uptime monitors.

**Response (`200 OK`):**
```json
{
  "ok": true,
  "timestamp": "2026-11-01T07:00:00.000Z",
  "service": "TruthLens AI"
}
```

---

## Limitations

- **Heuristic Baseline**: The client-side red-flag check is a transparent heuristic rule system, not a trained machine learning model. It evaluates stylistic patterns (capitalization, punctuation, attribution, clickbait phrasing) and cannot verify deep factual veracity on its own.
- **Search Latency and Coverage**: Gemini live search grounding depends on public search indexes. Extremely fresh breaking news (within minutes of occurrence) may lack sufficient indexed reporting.
- **Satire and Irony**: Subtle parody or satire written with conventional journalistic grammar may pass stylistic checks.

---

## Disclaimer

> **TruthLens AI provides automated analysis, not definitive proof.** Heuristic and AI predictions are estimates and source verification depends on available evidence. Readers should always consult multiple primary sources.

---

## Future Improvements

1. **Fine-Tuned NLP Models**: Incorporate lightweight ONNX-runtime transformers directly in the browser for local semantic claim extraction.
2. **Multilingual Analysis**: Extend heuristic rules and multilingual prompt grounding to verify articles in non-English languages.
3. **Domain Authority & WHOIS Integration**: Integrate automated domain age, ownership, and journalistic ethics rating checks.
4. **Automated Fact-Checking API Aggregation**: Connect with the Google Fact Check Tools API and ClaimReview schema data.
