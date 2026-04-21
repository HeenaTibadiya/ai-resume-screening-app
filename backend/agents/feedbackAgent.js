const { Ollama } = require('@langchain/community/llms/ollama');
const { PromptTemplate } = require('@langchain/core/prompts');
const { LLMChain } = require('langchain/chains');

const llm = new Ollama({ model: 'qwen2.5:0.5b', temperature: 0.2, numPredict: 320 });

const prompt = new PromptTemplate({
  inputVariables: ['score', 'matchedSkills', 'missingSkills', 'resumeHighlights', 'jobHighlights'],
  template: `You are a resume feedback agent.
Return ONLY valid JSON with this exact shape:
{{
  "summary": "",
  "strengths": [""],
  "gaps": [""],
  "suggestions": [""],
  "rewrittenBullets": [""]
}}

Rules:
- suggestions should be practical and clear.
- rewrittenBullets should sound ATS-friendly and resume-ready.
- No markdown, no explanation.

Match score: {score}
Matched skills: {matchedSkills}
Missing skills: {missingSkills}
Resume highlights: {resumeHighlights}
Job highlights: {jobHighlights}`,
});

const feedbackChain = new LLMChain({ llm, prompt });

function extractJSON(text) {
  if (!text) return null;
  if (typeof text === 'object') return text;

  const fenced = String(text).match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // Fall through.
    }
  }

  const candidates = String(text).match(/{[\s\S]*}/g) || [];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try next candidate.
    }
  }

  return null;
}

function normalizeSkill(skill) {
  return String(skill || '')
    .toLowerCase()
    .replace(/[^a-z0-9.+#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueList(values, mode = 'text') {
  const seen = new Set();
  const out = [];
  for (const value of values || []) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = mode === 'skill' ? normalizeSkill(trimmed) : trimmed.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function toList(value, mode = 'text') {
  if (!Array.isArray(value)) return [];
  return uniqueList(value, mode);
}

function buildFallbackFeedback(parsed, matched) {
  const strengths = uniqueList(matched && matched.matchedSkills ? matched.matchedSkills : [], 'skill');
  const gaps = uniqueList(matched && matched.missingSkills ? matched.missingSkills : [], 'skill');
  const suggestions = [];
  const rewrittenBullets = [];

  if (gaps.length) {
    suggestions.push(`Add project evidence for ${gaps.slice(0, 4).join(', ')} with measurable outcomes.`);
    rewrittenBullets.push(`Implemented end-to-end features using ${gaps.slice(0, 3).join(', ')} with focus on reliability, performance, and maintainability.`);
  }

  if ((parsed && parsed.resumeHighlights ? parsed.resumeHighlights : []).length < 3) {
    suggestions.push('Include more quantified results in resume bullets, such as latency reductions, throughput gains, or delivery impact.');
  }

  if (!suggestions.length) {
    suggestions.push('Tailor your top 3 bullets to mirror the job priorities and keep achievements metric-driven.');
  }

  if (!rewrittenBullets.length) {
    rewrittenBullets.push('Designed and delivered scalable full-stack features with emphasis on performance, maintainability, and user impact.');
  }

  const score = matched && typeof matched.score === 'number' ? matched.score : 0;
  const summary =
    score >= 70
      ? 'Your resume is a strong match, with only minor improvements needed for clarity and impact.'
      : score >= 40
        ? 'Your resume is partially aligned; stronger keyword coverage and quantified outcomes will improve fit.'
        : 'Your resume needs clearer alignment with the role requirements and stronger evidence of required skills.';

  return { summary, strengths, gaps, suggestions, rewrittenBullets };
}

async function runFeedback(parsed, matched) {
  const fallback = buildFallbackFeedback(parsed, matched);

  let raw = '';
  let feedback = {};

  try {
    const response = await feedbackChain.call({
      score: String(matched && typeof matched.score === 'number' ? matched.score : 0),
      matchedSkills: JSON.stringify(matched && matched.matchedSkills ? matched.matchedSkills : []),
      missingSkills: JSON.stringify(matched && matched.missingSkills ? matched.missingSkills : []),
      resumeHighlights: JSON.stringify(parsed && parsed.resumeHighlights ? parsed.resumeHighlights : []),
      jobHighlights: JSON.stringify(parsed && parsed.jobHighlights ? parsed.jobHighlights : []),
    });
    raw = response && response.text ? response.text : '';
    feedback = extractJSON(raw) || {};
  } catch {
    raw = '';
    feedback = {};
  }

  const strengths = toList(feedback.strengths, 'skill');
  const gaps = toList(feedback.gaps, 'skill');
  const suggestions = toList(feedback.suggestions, 'text');
  const rewrittenBullets = toList(feedback.rewrittenBullets, 'text');

  return {
    raw,
    summary: typeof feedback.summary === 'string' && feedback.summary.trim() ? feedback.summary.trim() : fallback.summary,
    strengths: strengths.length ? strengths : fallback.strengths,
    gaps: gaps.length ? gaps : fallback.gaps,
    suggestions: suggestions.length ? suggestions : fallback.suggestions,
    rewrittenBullets: rewrittenBullets.length ? rewrittenBullets : fallback.rewrittenBullets,
  };
}

module.exports = { runFeedback };
