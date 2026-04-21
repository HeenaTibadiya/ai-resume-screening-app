const { Ollama } = require('@langchain/community/llms/ollama');
const { PromptTemplate } = require('@langchain/core/prompts');
const { LLMChain } = require('langchain/chains');

const llm = new Ollama({ model: 'qwen2.5:0.5b', temperature: 0, numPredict: 200 });

const prompt = new PromptTemplate({
	inputVariables: ['resumeSkills', 'jobSkills'],
	template: `You are a resume skill matching agent.
Return ONLY valid JSON with this exact shape:
{{"score": 0, "matchedSkills": [], "missingSkills": []}}

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
		const key = normalizeSkill(value);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		out.push(String(value).trim());
	}
	return out;
}

function isSkillMatch(resumeSkill, requiredSkill) {
	if (!resumeSkill || !requiredSkill) return false;
	return (
		resumeSkill === requiredSkill ||
		resumeSkill.includes(requiredSkill) ||
		requiredSkill.includes(resumeSkill)
	);
}

function extractJSON(text) {
	if (!text) return null;
	if (typeof text === 'object') return text;

	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fenced?.[1]) {
		try { return JSON.parse(fenced[1]); } catch { /* continue */ }
	}

	const candidates = text.match(/{[\s\S]*}/g) || [];
	for (const candidate of candidates) {
		try { return JSON.parse(candidate); } catch { /* continue */ }
	}

	return null;
}

function toList(value) {
	if (!Array.isArray(value)) return [];
	return value.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
}

function deterministicMatching(resumeSkills, jobSkills) {
	const normalizedResume = resumeSkills.map((skill) => ({
		raw: skill,
		key: normalizeSkill(skill),
	}));

	const matchedSkills = [];
	const missingSkills = [];

	for (const skill of jobSkills) {
		const normalizedSkill = normalizeSkill(skill);
		const found = normalizedResume.find((r) => isSkillMatch(r.key, normalizedSkill));
		if (found) {
			matchedSkills.push(skill);
		} else {
			missingSkills.push(skill);
		}
	}

	const score = jobSkills.length ? Math.round((matchedSkills.length / jobSkills.length) * 100) : 0;
	return { score, matchedSkills, missingSkills };
}

async function runMatching(parsed) {
	const resumeSkills = uniqueList(parsed?.resumeSkills || []);
	const jobSkills = uniqueList(parsed?.jobSkills || []);
	console.log('Running Matching Agent with', { resumeSkills, jobSkills });

	// Always use deterministic matching as the source of truth.
	// The 0.5b LLM regularly misidentifies which list is which, so we cannot
	// trust its matchedSkills/missingSkills output directly.
	const fallback = deterministicMatching(resumeSkills, jobSkills);

	// Optionally attempt LLM for score hints, but reconcile its output
	// against the deterministic result before using it.
	try {
		const response = await matchingChain.call({
			resumeSkills: JSON.stringify(resumeSkills),
			jobSkills: JSON.stringify(jobSkills),
		});

		console.log('Matching Agent response:', response.text);
		const result = extractJSON(response?.text);
		const llmMatched = toList(result?.matchedSkills);

		if (result && typeof result.score === 'number' && llmMatched.length > 0) {
			// Only accept LLM matchedSkills that are actual job skills — discard hallucinations
			const verifiedMatched = jobSkills.filter((js) => {
				const jk = normalizeSkill(js);
				return llmMatched.some((lm) => {
					const lk = normalizeSkill(lm);
					return isSkillMatch(jk, lk);
				});
			});

			// If LLM found at least as many matches as deterministic, prefer it
			if (verifiedMatched.length >= fallback.matchedSkills.length) {
				const verifiedMissing = jobSkills.filter((js) => !verifiedMatched.includes(js));
				const score = jobSkills.length ? Math.round((verifiedMatched.length / jobSkills.length) * 100) : 0;
				return {
					raw: response?.text || '',
					score,
					matchedSkills: verifiedMatched,
					missingSkills: verifiedMissing,
					matchRatio: `${verifiedMatched.length}/${jobSkills.length}`,
				};
			}
		}
	} catch {
		// Fall through to deterministic fallback
	}

	// Deterministic fallback
	return {
		raw: '',
		...fallback,
		matchRatio: `${fallback.matchedSkills.length}/${jobSkills.length || 0}`,
	};
}

module.exports = { runMatching };
