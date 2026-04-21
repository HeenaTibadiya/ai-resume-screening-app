const { runParser } = require('./parserAgent');
const { runMatching } = require('./matchingAgent');
const { runFeedback } = require('./feedbackAgent');

async function runPipeline(resume, jobDescription, options = {}) {
  const log = options.log || (() => {});
  const onStatus = options.onStatus || (() => {});

  async function executeAgent(agent, label, runningMessage, completedMessage, task) {
    log(`${label} started`);
    onStatus({
      type: 'agent',
      agent,
      label,
      state: 'running',
      message: runningMessage,
    });

    try {
      const result = await task();
      onStatus({
        type: 'agent',
        agent,
        label,
        state: 'completed',
        message: completedMessage,
      });
      return result;
    } catch (error) {
      onStatus({
        type: 'agent',
        agent,
        label,
        state: 'failed',
        message: error.message || `${label} failed`,
      });
      throw error;
    }
  }

  log('Pipeline started', {
    resumeLength: resume.length,
    jobDescriptionLength: jobDescription.length,
  });

  const parsed = await executeAgent(
    'parser',
    'Parser Agent',
    'Extracting candidate profile and skill signals',
    'Profile extraction complete',
    () => runParser(resume, jobDescription),
  );
  log('Parser Agent completed', {
    candidateName: parsed.candidateName || '',
    experienceYears: parsed.experienceYears || 0,
    resumeSkills: parsed.resumeSkills?.length || 0,
    jobSkills: parsed.jobSkills?.length || 0,
  });

  const matched = await executeAgent(
    'matching',
    'Matching Agent',
    'Comparing resume evidence against the role',
    'Match score and skill gaps ready',
    () => runMatching(parsed),
  );
  log('Matching Agent completed', {
    score: matched.score || 0,
    matchedSkills: matched.matchedSkills?.length || 0,
    missingSkills: matched.missingSkills?.length || 0,
  });

  const feedback = await executeAgent(
    'feedback',
    'Feedback Agent',
    'Drafting summary, strengths, and rewrite suggestions',
    'Improvement guidance generated',
    () => runFeedback(parsed, matched),
  );
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