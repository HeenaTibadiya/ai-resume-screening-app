const { Ollama } = require('@langchain/community/llms/ollama');
const { PromptTemplate } = require('@langchain/core/prompts');
const { LLMChain } = require('langchain/chains');

const llm = new Ollama({ model: 'qwen2.5:0.5b', temperature: 0.2, numPredict: 280 });

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
Job highlights: {jobHighlights}`
});

const feedbackChain = new LLMChain({ llm, prompt });

function extractJSON(text) {
	if (!text) return null;
	if (typeof text === 'object') return text;

	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fenced?.[1]) {
		try {
			return JSON.parse(fenced[1]);
		} catch {
			// Continue with fallback parsing.
		}
	}

	const candidates = text.match(/{[\s\S]*}/g) || [];
	for (const candidate of candidates) {
		try {
			return JSON.parse(candidate);
		} catch {
			// Ignore bad candidate and continue.
		}
	}

	return null;
}

function toList(value) {
	if (!Array.isArray(value)) return [];
	return value
		.filter((item) => typeof item === 'string')
		.map((item) => item.trim())
		.filter(Boolean);
}

function buildFallbackFeedback(parsed, matched) {
	const matchedSkills = matched.matchedSkills || [];
	const missingSkills = matched.missingSkills || [];
	const suggestions = [];
	const rewrittenBullets = [];

	if (missingSkills.length) {
		suggestions.push(`Add stronger evidence for ${missingSkills.slice(0, 4).join(', ')} to better align with the job description.`);
		rewrittenBullets.push(`Built production-ready features using ${missingSkills.slice(0, 3).join(', ')} while collaborating across product and engineering teams.`);
	}

	if ((parsed.resumeHighlights || []).length < 3) {
		suggestions.push('Include more measurable outcomes, delivery impact, or performance improvements in your experience bullets.');
	}

	if (!rewrittenBullets.length) {
		rewrittenBullets.push('Designed and delivered scalable frontend and full-stack features with emphasis on performance, maintainability, and user experience.');
	}

	return {
		summary: matched.score >= 70
			? 'Your resume is a strong match, but a few targeted edits can improve clarity and relevance.'
			: matched.score >= 40
				? 'Your resume is partially aligned. Better keyword coverage and stronger impact statements would improve the match.'
				: 'Your resume needs clearer alignment with the required technical stack and job expectations.',
		strengths: matchedSkills,
		gaps: missingSkills,
		suggestions,
		rewrittenBullets,
	};
}

async function runFeedback(parsed, matched) {
	const response = await feedbackChain.call({
		score: String(matched.score || 0),
		matchedSkills: JSON.stringify(matched.matchedSkills || []),
		missingSkills: JSON.stringify(matched.missingSkills || []),
		resumeHighlights: JSON.stringify(parsed.resumeHighlights || []),
		jobHighlights: JSON.stringify(parsed.jobHighlights || []),
	});

	const feedback = extractJSON(response?.text) || {};
	const fallback = buildFallbackFeedback(parsed, matched);

	return {
		raw: response?.text || '',
		summary: feedback.summary || fallback.summary,
		strengths: toList(feedback.strengths).length ? toList(feedback.strengths) : fallback.strengths,
		gaps: toList(feedback.gaps).length ? toList(feedback.gaps) : fallback.gaps,
		suggestions: toList(feedback.suggestions).length ? toList(feedback.suggestions) : fallback.suggestions,
		rewrittenBullets: toList(feedback.rewrittenBullets).length ? toList(feedback.rewrittenBullets) : fallback.rewrittenBullets,
	};
}

module.exports = { runFeedback };
