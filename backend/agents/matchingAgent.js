//const { Ollama } = require('@langchain/community/llms/ollama');
const { ChatGroq } = require('@langchain/groq');
const { PromptTemplate } = require('@langchain/core/prompts');
const { LLMChain } = require('langchain/chains');

//const llm = new Ollama({ model: 'llama3.2:3b', temperature: 0, numPredict: 500, format: 'json' });
const llm = new ChatGroq({ model: 'llama-3.1-8b-instant', temperature: 0, apiKey: process.env.GROQ_API_KEY });

const prompt = new PromptTemplate({
  inputVariables: ['resumeSkills', 'requiredSkills', 'niceToHave'],
  template: `You are a resume skill matching agent.
Return ONLY valid JSON with this exact shape:
{{"score": 0, "matchedSkills": [], "missingSkills": []}}

Rules:
- matchedSkills: skills from requiredSkills that appear in or closely match resumeSkills.
- missingSkills: skills from requiredSkills NOT found in resumeSkills.
- score: integer 0-100 = (matchedSkills.length / total requiredSkills.length) * 100.
- No markdown, no explanation.

Resume skills: {resumeSkills}
Required skills: {requiredSkills}
Nice to have: {niceToHave}`,
});

const matchingChain = new LLMChain({ llm, prompt });

function normalizeSkill(skill) {
  const ALIASES = {
    'js': 'javascript',
    'ts': 'typescript',
    'postgres': 'postgresql',
    'postgresql': 'postgresql',
    'pg': 'postgresql',
    'node': 'node.js',
    'nodejs': 'node.js',
    'react.js': 'react',
    'reactjs': 'react',
    'vue.js': 'vue',
    'vuejs': 'vue',
    'angular.js': 'angular',
    'angularjs': 'angular',
    'next': 'next.js',
    'nextjs': 'next.js',
    'express': 'express.js',
    'expressjs': 'express.js',
    'k8s': 'kubernetes',
    'tf': 'terraform',
    'mongo': 'mongodb',
    'py': 'python',
    'rb': 'ruby',
    'css3': 'css',
    'html5': 'html',
    'rest apis': 'rest api',
    'rest': 'rest api',
    'restful': 'rest api',
    'graphql api': 'graphql',
    'gha': 'github actions',
    'gh actions': 'github actions',
  };
  const normalized = String(skill || '')
    .toLowerCase()
    .replace(/[^a-z0-9.+#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return ALIASES[normalized] || normalized;
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

// Expand slash-compound skills so they match individually.
// "HTML5/CSS3" → ["HTML5", "CSS3"], "HTML/CSS" → ["HTML", "CSS"], "C/C++" → ["C", "C++"]
function expandSkills(skills) {
  const out = [];
  for (const skill of skills || []) {
    const s = String(skill || '').trim();
    if (!s) continue;
    if (s.includes('/')) {
      for (const part of s.split('/')) {
        const p = part.trim();
        if (p) out.push(p);
      }
    } else {
      out.push(s);
    }
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
  if (resumeSkill === requiredSkill) return true;
  // Use whole-word token matching to avoid false positives (e.g. java != javascript, sql != nosql)
  if (resumeSkill.split(' ').includes(requiredSkill)) return true;
  if (requiredSkill.split(' ').includes(resumeSkill)) return true;
  return false;
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
  const resumeSkills = uniqueList(expandSkills(parsed && parsed.resumeSkills ? parsed.resumeSkills : []));
  const requiredSkills = uniqueList(expandSkills(parsed && parsed.requiredSkills ? parsed.requiredSkills : []));
  const niceToHave = uniqueList(expandSkills(parsed && parsed.niceToHave ? parsed.niceToHave : []));

  const fallback = deterministicMatching(resumeSkills, requiredSkills);

  // Nice-to-have deterministic match
  const niceMatched = niceToHave.filter((skill) => {
    const skillKey = normalizeSkill(skill);
    return resumeSkills.some((r) => isSkillMatch(normalizeSkill(r), skillKey));
  });
  const niceToHaveScore = niceToHave.length ? Math.round((niceMatched.length / niceToHave.length) * 100) : 0;

  let raw = '';
  try {
    const response = await matchingChain.call({
      resumeSkills: JSON.stringify(resumeSkills),
      requiredSkills: JSON.stringify(requiredSkills),
      niceToHave: JSON.stringify(niceToHave),
    });
    raw = response && (response.text || response.content) ? (response.text || response.content) : '';

    const llmResult = extractJSON(raw);
    const llmMatched = toList(llmResult && llmResult.matchedSkills ? llmResult.matchedSkills : []);
    const verifiedMatched = verifyLLMMatchedSkills(llmMatched, requiredSkills);

    if (verifiedMatched.length >= fallback.matchedSkills.length) {
      const missingSkills = requiredSkills.filter((skill) => !verifiedMatched.includes(skill));
      const requiredScore = requiredSkills.length ? Math.round((verifiedMatched.length / requiredSkills.length) * 100) : 0;
      const score = Math.round(requiredScore * 0.8 + niceToHaveScore * 0.2);
      return {
        raw,
        score,
        breakdown: { requiredScore, niceToHaveScore },
        requiredSkills,
        matchedSkills: verifiedMatched,
        missingSkills,
        matchRatio: `${verifiedMatched.length}/${requiredSkills.length || 0}`,
      };
    }
  } catch (err) {
    console.error('[MatchingAgent] LLM call failed:', err.message || err);
    // Use deterministic fallback.
  }

  const requiredScore = fallback.score;
  const score = Math.round(requiredScore * 0.8 + niceToHaveScore * 0.2);
  return {
    raw,
    score,
    breakdown: { requiredScore, niceToHaveScore },
    requiredSkills,
    matchedSkills: fallback.matchedSkills,
    missingSkills: fallback.missingSkills,
    matchRatio: `${fallback.matchedSkills.length}/${requiredSkills.length || 0}`,
  };
}

module.exports = { runMatching };
