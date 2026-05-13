
const { Ollama } = require('@langchain/community/llms/ollama');
//const { ChatGroq } = require('@langchain/groq');
const { PromptTemplate } = require('@langchain/core/prompts');
const { LLMChain } = require('langchain/chains');

const llm = new Ollama({ model: 'llama3.2:3b', temperature: 0.3, numPredict: 1500, format: 'json' });
//const llm = new ChatGroq({ model: 'llama-3.1-8b-instant', temperature: 0, apiKey: process.env.GROQ_API_KEY });

const prompt = new PromptTemplate({
  inputVariables: ['score', 'matchedSkills', 'missingSkills', 'resumeSkills', 'niceToHave', 'workExperience', 'jobDescription'],
  template: `You are a professional resume coach. Analyse the candidate's resume against the job description and return actionable, specific feedback.
Return ONLY valid JSON with this exact shape:
{{
  "summary": "",
  "strengths": [],
  "gaps": [],
  "suggestions": [],
  "rewrittenBullets": []
}}

Rules:
- summary: one concrete sentence that names the candidate's actual strengths and the key gap for THIS specific role.
- strengths: 3-5 short phrases naming the candidate's actual matched skills or experiences (not generic phrases).
- gaps: the specific missing skills or experience that this role requires but the candidate lacks.
- suggestions: 2-4 specific, actionable steps tailored to the missing skills. Name the exact skill/technology. E.g. "Build a TypeScript project and add it to your GitHub portfolio" not "improve your technical skills".
- rewrittenBullets: take the ORIGINAL BULLETS listed below and rewrite each one to be stronger — add measurable impact, use keywords from the job description, use strong action verbs. Do NOT invent bullets. Rewrite what exists.
- No markdown, no explanation.

Match score: {score}/100
Matched skills: {matchedSkills}
Missing required skills: {missingSkills}
Candidate's skills: {resumeSkills}
Nice-to-have skills: {niceToHave}

Job description (for keyword context):
{jobDescription}

Original resume bullets to rewrite:
{workExperience}`,
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
    rewrittenBullets.push(`Implemented end-to-end features using ${strengths.slice(0, 3).join(', ')} with focus on reliability, performance, and maintainability.`);
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

async function runFeedback(parsed, matched, resume, jobDescription) {
  const fallback = buildFallbackFeedback(parsed, matched);

  let raw = '';
  let feedback = {};

  try {
    const response = await feedbackChain.call({
      score: String(matched && typeof matched.score === 'number' ? matched.score : 0),
      matchedSkills: JSON.stringify(matched && matched.matchedSkills ? matched.matchedSkills : []),
      missingSkills: JSON.stringify(matched && matched.missingSkills ? matched.missingSkills : []),
      resumeSkills: JSON.stringify(parsed && parsed.resumeSkills ? parsed.resumeSkills : []),
      niceToHave: JSON.stringify(parsed && parsed.niceToHave ? parsed.niceToHave : []),
      workExperience: (parsed && parsed.workExperience && parsed.workExperience.length)
        ? parsed.workExperience.map((b, i) => `${i + 1}. ${b}`).join('\n')
        : 'No experience bullets extracted from resume.',
      jobDescription: String(jobDescription || '').slice(0, 800),
    });
    raw = response && (response.text || response.content) ? (response.text || response.content) : '';
    feedback = extractJSON(raw) || {};
  } catch (err) {
    console.error('[FeedbackAgent] LLM call failed:', err.message || err);
    raw = '';
    feedback = {};
  }

  const resumeSkillsLower = (parsed && parsed.resumeSkills ? parsed.resumeSkills : []).map((s) => normalizeSkill(s));

  const strengths = toList(feedback.strengths, 'skill');
  const gaps = toList(feedback.gaps, 'skill').filter((g) => {
    const gKey = normalizeSkill(g);
    // Use whole-word token matching to avoid over-filtering (e.g. java resume skill should not suppress javascript gap)
    return !resumeSkillsLower.some(
      (rs) => rs === gKey || rs.split(' ').includes(gKey) || gKey.split(' ').includes(rs)
    );
  });
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
