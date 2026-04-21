const { Ollama } = require('@langchain/community/llms/ollama');
const { PromptTemplate } = require('@langchain/core/prompts');
const { LLMChain } = require('langchain/chains');

const llm = new Ollama({ model: 'qwen2.5:0.5b', temperature: 0, numPredict: 420 });

const SKILL_HINTS = [
  'react',
  'next.js',
  'typescript',
  'javascript',
  'python',
  'fastapi',
  'django',
  'node.js',
  'express.js',
  'postgres',
  'sql',
  'mongodb',
  'couchbase',
  'elasticsearch',
  'kafka',
  'docker',
  'kubernetes',
  'gcp',
  'aws',
  'rest api',
  'microservices',
  'micro frontends',
  'webpack',
  'module federation',
  'material ui',
  'bootstrap',
  'figma',
  'langchain.js',
  'llms',
  'agentic workflows',
  'agile',
  'scrum',
  'responsive design',
  'oauth 2.0',
  'socket.io',
];

const prompt = new PromptTemplate({
  inputVariables: ['resume', 'jobDescription'],
  template: `You are a resume parsing agent.
Return ONLY valid JSON with this exact shape:
{{
  "candidateName": "",
  "experienceYears": 0,
  "resumeSkills": [""],
  "jobSkills": [""],
  "resumeHighlights": [""],
  "jobHighlights": [""]
}}

Rules:
- Use short normalized skill names.
- Infer years of experience from resume when possible.
- Keep arrays unique and concise.
- Do not add markdown or explanation.

Resume:
{resume}

Job Description:
{jobDescription}`
});

const parserChain = new LLMChain({ llm, prompt });

function extractJSON(text) {
  if (!text) return null;
  if (typeof text === 'object') return text;

  const fenced = String(text).match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // Fall through to raw object extraction.
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

function uniqueList(values) {
  const seen = new Set();
  const out = [];
  for (const value of values || []) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = normalizeSkill(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function normalizeExperienceYears(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const exact = Number(trimmed);
    if (Number.isFinite(exact)) {
      return Math.max(0, Math.floor(exact));
    }

    const embedded = trimmed.match(/(\d+)/);
    if (embedded) {
      return Number(embedded[1]) || null;
    }
  }

  return null;
}

function extractExperienceYearsFromRaw(rawText) {
  const text = String(rawText || '');
  const keyMatch = text.match(/"experienceYears"\s*:\s*(\d+)/i);
  if (!keyMatch) return null;
  return Number(keyMatch[1]) || null;
}

function extractExperienceYearsFromResume(resume) {
  const text = String(resume || '');

  const range = text.match(/(\d+)\s*[\u2013-]\s*(\d+)\s+years?/i);
  if (range) return Number(range[2]) || Number(range[1]) || 0;

  const explicit = text.match(/(\d+)\+?\s+years?\s+of\s+experience/i);
  if (explicit) return Number(explicit[1]) || 0;

  const generic = text.match(/(?:over|more than|at least|around|about)?\s*(\d+)\+?\s+years?\b/i);
  if (generic) return Number(generic[1]) || 0;

  return 0;
}

function extractCandidateName(resume) {
  const lines = String(resume || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines.slice(0, 6)) {
    if (/[@\d]/.test(line)) continue;
    if (/^[A-Za-z][A-Za-z\s.'-]{2,50}$/.test(line)) {
      return line;
    }
  }

  return '';
}

function extractSkillsFromText(text) {
  const lower = String(text || '').toLowerCase();
  return uniqueList(SKILL_HINTS.filter((skill) => lower.includes(skill)));
}

function skillAppearsInText(skill, text) {
  return String(text || '').toLowerCase().includes(String(skill || '').toLowerCase());
}

function extractHighlights(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter((line) => line.length > 24)
    .slice(0, 6);
}

async function runParser(resume, jobDescription) {
  let raw = '';
  let parsed = {};

  try {
    const result = await parserChain.call({ resume, jobDescription });
    raw = result && result.text ? result.text : '';
    parsed = extractJSON(raw) || {};
  } catch {
    raw = '';
    parsed = {};
  }

  const llmResumeSkills = uniqueList(parsed.resumeSkills || []);
  const llmJobSkills = uniqueList(parsed.jobSkills || parsed.requiredSkills || []);
  const verifiedJobSkills = llmJobSkills.filter((s) => skillAppearsInText(s, jobDescription));

  const parsedExperience = normalizeExperienceYears(parsed.experienceYears);
  const rawExperience = extractExperienceYearsFromRaw(raw);
  const resumeExperience = extractExperienceYearsFromResume(resume);

  return {
    raw,
    candidateName: parsed.candidateName || extractCandidateName(resume),
    experienceYears: parsedExperience ?? rawExperience ?? resumeExperience,
    resumeSkills: uniqueList([...llmResumeSkills, ...extractSkillsFromText(resume)]),
    jobSkills: uniqueList([...verifiedJobSkills, ...extractSkillsFromText(jobDescription)]),
    resumeHighlights: uniqueList(parsed.resumeHighlights).length ? uniqueList(parsed.resumeHighlights) : extractHighlights(resume),
    jobHighlights: uniqueList(parsed.jobHighlights).length ? uniqueList(parsed.jobHighlights) : extractHighlights(jobDescription),
  };
}

module.exports = { runParser };
