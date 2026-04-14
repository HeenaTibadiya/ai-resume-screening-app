const { runParser } = require('./parserAgent');
const { runMatching } = require('./matchingAgent');
const { runFeedback } = require('./feedbackAgent');

async function runPipeline(resume, jobDescription, options = {}) {
  const log = options.log || (() => {});

  log('Pipeline started', {
    resumeLength: resume.length,
    jobDescriptionLength: jobDescription.length,
  });

  log('Parser Agent started');
  const parsed = await runParser(resume, jobDescription);
  log('Parser Agent completed', {
    candidateName: parsed.candidateName || '',
    experienceYears: parsed.experienceYears || 0,
    resumeSkills: parsed.resumeSkills?.length || 0,
    jobSkills: parsed.jobSkills?.length || 0,
  });

  log('Matching Agent started');
  const matched = await runMatching(parsed);
  log('Matching Agent completed', {
    score: matched.score || 0,
    matchedSkills: matched.matchedSkills?.length || 0,
    missingSkills: matched.missingSkills?.length || 0,
  });

  log('Feedback Agent started');
  const feedback = await runFeedback(parsed, matched);
  log('Feedback Agent completed', {
    strengths: feedback.strengths?.length || 0,
    gaps: feedback.gaps?.length || 0,
    suggestions: feedback.suggestions?.length || 0,
    rewrittenBullets: feedback.rewrittenBullets?.length || 0,
  });

  log('Pipeline completed successfully');

  return {
    parsed,
    matched,
    feedback,
  };
}

module.exports = { runPipeline };