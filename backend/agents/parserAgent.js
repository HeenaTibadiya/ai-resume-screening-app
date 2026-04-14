const { Ollama } = require('@langchain/community/llms/ollama');
const { PromptTemplate } = require('@langchain/core/prompts');
const { LLMChain } = require('langchain/chains');

const llm = new Ollama({ model: 'qwen2.5:0.5b', temperature: 0, numPredict: 200 });

const SKILL_HINTS = [
  'react',
  'next.js',
  'typescript',
  'javascript',
  'python',
  'fastapi',
  'node.js',
  'express.js',
  'postgres',
  'sql',
  'mongodb',
  'couchbase',
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

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // Continue with raw matching.
    }
  }

  const candidates = text.match(/{[\s\S]*}/g) || [];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Skip invalid candidate and keep trying.
    }
  }

  return null;
}

function uniqueList(values) {
  const seen = new Set();
  const out = [];
  for (const value of values || []) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function extractExperienceYears(resume) {
  const explicit = String(resume || '').match(/(\d+)\+?\s+years?\s+of\s+experience/i);
  if (explicit) return Number(explicit[1]) || 0;

  const range = String(resume || '').match(/(\d+)\s*[–-]\s*(\d+)\s+years?/i);
  if (range) return Number(range[2]) || Number(range[1]) || 0;

  return 0;
}

function extractCandidateName(resume) {
  const firstLine = String(resume || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || '';

  if (/^[A-Za-z][A-Za-z\s.'-]{2,50}$/.test(firstLine)) {
    return firstLine;
  }

  return '';
}

function extractSkillsFromText(text) {
  const lower = String(text || '').toLowerCase();
  return uniqueList(SKILL_HINTS.filter((skill) => lower.includes(skill)));
}

function extractHighlights(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•▸]\s*/, '').trim())
    .filter((line) => line.length > 24)
    .slice(0, 6);
}

async function runParser(resume, jobDescription) {
  const result = await parserChain.call({ resume, jobDescription });
  const parsed = extractJSON(result?.text) || {};

  return {
    raw: result?.text || '',
    candidateName: parsed.candidateName || extractCandidateName(resume),
    experienceYears: Number(parsed.experienceYears) || extractExperienceYears(resume),
    resumeSkills: uniqueList(parsed.resumeSkills).length ? uniqueList(parsed.resumeSkills) : extractSkillsFromText(resume),
    jobSkills: uniqueList(parsed.jobSkills || parsed.requiredSkills).length
      ? uniqueList(parsed.jobSkills || parsed.requiredSkills)
      : extractSkillsFromText(jobDescription),
    resumeHighlights: uniqueList(parsed.resumeHighlights).length ? uniqueList(parsed.resumeHighlights) : extractHighlights(resume),
    jobHighlights: uniqueList(parsed.jobHighlights).length ? uniqueList(parsed.jobHighlights) : extractHighlights(jobDescription),
  };
}

module.exports = { runParser };