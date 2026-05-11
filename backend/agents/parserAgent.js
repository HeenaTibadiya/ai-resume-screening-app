const { Ollama } = require('@langchain/community/llms/ollama');
const { PromptTemplate } = require('@langchain/core/prompts');
const { LLMChain } = require('langchain/chains');

const llm = new Ollama({ model: 'llama3.2:3b', temperature: 0, numPredict: 1500, format: 'json' });

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
  // .NET / Microsoft stack
  'c#',
  '.net',
  '.net core',
  'asp.net',
  'asp.net core',
  'blazor',
  'entity framework',
  'wpf',
  'winforms',
  'xamarin',
  'maui',
  'azure',
  'azure devops',
  'nuget',
  'visual studio',
  // Java ecosystem
  'java',
  'spring',
  'spring boot',
  'maven',
  'gradle',
  'hibernate',
  'jpa',
  // Mobile
  'swift',
  'kotlin',
  'flutter',
  'react native',
  // Other common
  'graphql',
  'redis',
  'nginx',
  'linux',
  'bash',
  'terraform',
  'ansible',
  'jenkins',
  'github actions',
  'ci/cd',
  'jest',
  'cypress',
  'playwright',
  'ruby',
  'rails',
  'go',
  'rust',
  'php',
  'laravel',
  'vue',
  'angular',
  'svelte',
  'tailwind',
  'sass',
];

const prompt = new PromptTemplate({
  inputVariables: ['resume', 'jobDescription'],
  template: `You are a resume parsing agent.
Return ONLY valid JSON with this exact shape:
{{
  "candidateName": "",
  "experienceYears": 0,
  "resumeSkills": [],
  "requiredSkills": [],
  "niceToHave": [],
  "workExperience": []
}}

Rules:
- resumeSkills: all technical and soft skills explicitly mentioned in the resume.
- requiredSkills: must-have skills from the job description (look for "required", "must have", "essential").
- niceToHave: preferred or bonus skills from the job description (look for "nice to have", "preferred", "plus", "desirable").
- experienceYears: total years of professional experience calculated from the resume's work history dates.
- workExperience: copy the 4-6 most impactful bullet points verbatim from the resume's experience/work history section. These must be the candidate's actual words, not summaries.
- Use short normalized skill names. Keep arrays unique and concise.
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

  // Calculate from work history date ranges: "Month YYYY – Month YYYY" or "Month YYYY – Present"
  const MONTHS = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
    jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7,
    sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const dateRangeRx = /(\w+)\s+(\d{4})\s*[\u2013\u2014\-]\s*(?:(\w+)\s+(\d{4})|present|current)/gi;
  let earliest = null;
  let latest = null;
  let m;
  while ((m = dateRangeRx.exec(text)) !== null) {
    const sm = (m[1] || '').toLowerCase();
    const sy = parseInt(m[2]);
    if (!(sm in MONTHS) || isNaN(sy) || sy < 1980 || sy > 2030) continue;
    const start = new Date(sy, MONTHS[sm]);
    if (!earliest || start < earliest) earliest = start;
    if (m[3] && m[4]) {
      const em = (m[3] || '').toLowerCase();
      const ey = parseInt(m[4]);
      if (em in MONTHS && !isNaN(ey) && ey >= sy) {
        const end = new Date(ey, MONTHS[em]);
        if (!latest || end > latest) latest = end;
      }
    } else {
      const now = new Date();
      if (!latest || now > latest) latest = now;
    }
  }
  if (earliest && latest && latest > earliest) {
    return Math.max(0, Math.floor((latest - earliest) / (1000 * 60 * 60 * 24 * 365.25)));
  }

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

function skillHintAppearsInText(hint, lowerText) {
  const idx = lowerText.indexOf(hint);
  if (idx === -1) return false;
  // Ensure the match is not a substring of a longer word/token
  const before = idx > 0 ? lowerText[idx - 1] : ' ';
  const after = idx + hint.length < lowerText.length ? lowerText[idx + hint.length] : ' ';
  const isBoundary = (ch) => /[\s,;/()\[\]"'|]/.test(ch);
  return isBoundary(before) && isBoundary(after);
}

function extractSkillsFromText(text) {
  const lower = String(text || '').toLowerCase();
  return uniqueList(SKILL_HINTS.filter((skill) => skillHintAppearsInText(skill, lower)));
}

function skillAppearsInText(skill, text) {
  return String(text || '').toLowerCase().includes(String(skill || '').toLowerCase());
}

async function runParser(resume, jobDescription) {
  let raw = '';
  let parsed = {};

  const resumeTruncated = String(resume || '').slice(0, 2000);
  const jobTruncated = String(jobDescription || '').slice(0, 1000);

  try {
    const result = await parserChain.call({ resume: resume, jobDescription: jobDescription });
    raw = result && result.text ? result.text : '';
    parsed = extractJSON(raw) || {};
  } catch {
    raw = '';
    parsed = {};
  }

  const llmResumeSkills = uniqueList(parsed.resumeSkills || []);
  const llmRequiredSkills = uniqueList(parsed.requiredSkills || parsed.jobSkills || []);
  const llmNiceToHave = uniqueList(parsed.niceToHave || []);

  const verifiedRequired = llmRequiredSkills.filter((s) => skillAppearsInText(s, jobDescription));
  const verifiedNiceToHave = llmNiceToHave.filter((s) => skillAppearsInText(s, jobDescription));

  const parsedExperience = normalizeExperienceYears(parsed.experienceYears);
  const rawExperience = extractExperienceYearsFromRaw(raw);
  const resumeExperience = extractExperienceYearsFromResume(resume);

  const workExperience = Array.isArray(parsed.workExperience)
    ? uniqueList(parsed.workExperience.filter((b) => typeof b === 'string' && b.trim().length > 10))
    : [];

  return {
    raw,
    candidateName: parsed.candidateName || extractCandidateName(resume),
    experienceYears: parsedExperience || rawExperience || resumeExperience || 0,
    resumeSkills: uniqueList([...llmResumeSkills, ...extractSkillsFromText(resume)]),
    requiredSkills: uniqueList([...verifiedRequired, ...extractSkillsFromText(jobDescription)]),
    niceToHave: verifiedNiceToHave,
    workExperience,
  };
}

module.exports = { runParser };
