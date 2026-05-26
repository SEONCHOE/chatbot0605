import { readFileSync } from 'fs';
import { join } from 'path';

// 모듈 수준 캐시 — 같은 컨테이너 재사용 시 재로드 안 함
let chunks  = null;
let figures = null;

function loadData() {
  if (chunks) return;
  const base = join(process.cwd(), 'data_for_RAG', 'processed');
  chunks  = JSON.parse(readFileSync(join(base, 'rag_chunks.json'),  'utf8'));
  figures = JSON.parse(readFileSync(join(base, 'rag_figures.json'), 'utf8'));
}

// ── TF-IDF (TF 기반 코사인 유사도) ────────────────────────
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^가-힣a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

function buildFreq(text) {
  const f = {};
  tokenize(text).forEach(t => { f[t] = (f[t] || 0) + 1; });
  return f;
}

function cosineSim(qFreq, docText) {
  const dFreq = buildFreq(docText);
  let dot = 0, qNorm = 0, dNorm = 0;
  for (const [t, qv] of Object.entries(qFreq)) {
    dot   += qv * (dFreq[t] || 0);
    qNorm += qv * qv;
  }
  for (const dv of Object.values(dFreq)) dNorm += dv * dv;
  if (!qNorm || !dNorm) return 0;
  return dot / (Math.sqrt(qNorm) * Math.sqrt(dNorm));
}

// ── Vercel Serverless Handler ─────────────────────────────
export default function handler(req, res) {
  // CORS (같은 오리진이지만 혹시 모를 경우 대비)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    loadData();

    const { query = '', topChunks = 5, topFigures = 3 } = req.body ?? {};
    if (!query.trim()) {
      return res.status(400).json({ error: 'query is required' });
    }

    const qFreq = buildFreq(query);

    const resultChunks = chunks
      .map(c => ({ ...c, score: cosineSim(qFreq, c.text) }))
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topChunks)
      .map(({ score, ...c }) => c);   // score는 클라이언트에 불필요

    const resultFigures = figures
      .map(f => ({ ...f, score: cosineSim(qFreq, f.title + ' ' + f.caption) }))
      .filter(f => f.score > 0.05)
      .sort((a, b) => b.score - a.score)
      .slice(0, topFigures)
      .map(({ score, ...f }) => f);

    return res.status(200).json({ chunks: resultChunks, figures: resultFigures });

  } catch (err) {
    console.error('[/api/search]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
