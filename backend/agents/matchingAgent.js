const { Ollama } = require('@langchain/community/llms/ollama');
const { PromptTemplate } = require('@langchain/core/prompts');
const { LLMChain } = require('langchain/chains');

const llm = new Ollama({ model: 'qwen2.5:0.5b', temperature: 0, numPredict: 260 });

const prompt = new PromptTemplate({
  inputVariables: ['resumeSkills', 'jobSkills'],
  template: `You are a resume skill matching agent.
Return ONLY valid JSON with this exact shape:
{{"score": 0, "matchedSkills": [""], "missingSkills": [""]}}

Rules:
- matchedSkills: job skills that appear in or closely match the resume skills.
- missingSkills: job skills NOT found in the resume.
- score: integer 0-100 = (matchedSkills.length / total jobSkills) * 100.
- No markdown, no explanation.

Resume skills: {resumeSkills}
Job skills: {jobSkills}`,
});

const matchingChain = new LLMChain({ llm, prompt });

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
    const raw = String(value || '').trim();
    if (!raw) continue;
    const key = normalizeSkill(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
  }
  return out;
}

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
      // Try next.
    }
  }

  return null;
}

function toList(value) {
  if (!Array.isArray(value)) return [];
  return uniqueList(value.filter((item) => typeof item === 'string'));
}

function isSkillMatch(resumeSkill, requiredSkill) {
  if (!resumeSkill || !requiredSkill) return false;
  return (
    resumeSkill === requiredSkill ||
    resumeSkill.includes(requiredSkill) ||
    requiredSkill.includes(resumeSkill)
  );
}

function deterministicMatching(resumeSkills, jobSkills) {
  const normalizedResume = resumeSkills.map((skill) => ({
    raw: skill,
    key: normalizeSkill(skill),
  }));

  const matchedSkills = [];
  const missingSkills = [];

  for (const jobSkill of jobSkills) {
    const jobKey = normalizeSkill(jobSkill);
    const found = normalizedResume.some((resumeSkill) => isSkillMatch(resumeSkill.key, jobKey));
    if (found) {
      matchedSkills.push(jobSkill);
    } else {
      missingSkills.push(jobSkill);
    }
  }

  const score = jobSkills.length ? Math.round((matchedSkills.length / jobSkills.length) * 100) : 0;
  return { score, matchedSkills, missingSkills };
}

function verifyLLMMatchedSkills(llmMatchedSkills, jobSkills) {
  const out = [];
  for (const jobSkill of jobSkills) {
    const jobKey = normalizeSkill(jobSkill);
    const found = llmMatchedSkills.some((m) => isSkillMatch(normalizeSkill(m), jobKey));
    if (found) out.push(jobSkill);
  }
  return uniqueList(out);
}

async function runMatching(parsed) {
  const resumeSkills = uniqueList(parsed && parsed.resumeSkills ? parsed.resumeSkills : []);
  const jobSkills = uniqueList(parsed && parsed.jobSkills ? parsed.jobSkills : []);

  const fallback = deterministicMatching(resumeSkills, jobSkills);

  let raw = '';
  try {
    const response = await matchingChain.call({
      resumeSkills: JSON.stringify(resumeSkills),
      jobSkills: JSON.stringify(jobSkills),
    });
    raw = response && response.text ? response.text : '';

    const llm = extractJSON(raw);
    const llmMatched = toList(llm && llm.matchedSkills ? llm.matchedSkills : []);
    const verifiedMatched = verifyLLMMatchedSkills(llmMatched, jobSkills);

    if (verifiedMatched.length >= fallback.matchedSkills.length) {
      const missingSkills = jobSkills.filter((skill) => !verifiedMatched.includes(skill));
      const score = jobSkills.length ? Math.round((verifiedMatched.length / jobSkills.length) * 100) : 0;
      return {
        raw,
        score,
        matchedSkills: verifiedMatched,
        missingSkills,
        matchRatio: `${verifiedMatched.length}/${jobSkills.length || 0}`,
      };
    }
  } catch {
    // Use deterministic fallback.
  }

  return {
    raw,
    score: fallback.score,
    matchedSkills: fallback.matchedSkills,
    missingSkills: fallback.missingSkills,
    matchRatio: `${fallback.matchedSkills.length}/${jobSkills.length || 0}`,
  };
}

module.exports = { runMatching };
