import { useMemo, useState } from 'react';
import axios from 'axios';
import './App.css';

const initialSteps = [
  { key: 'parser', label: 'Parser Agent' },
  { key: 'matching', label: 'Matching Agent' },
  { key: 'feedback', label: 'Feedback Agent' },
];

function scoreTone(score) {
  if (score >= 75) return 'strong';
  if (score >= 45) return 'medium';
  return 'low';
}

function ResultTags({ title, items, tone, empty }) {
  return (
    <section className={`result-card ${tone}`}>
      <div className="result-card-head">
        <h4>{title}</h4>
        <span>{items.length}</span>
      </div>
      <div className="tag-wrap">
        {items.length ? items.map((item, index) => (
          <span key={`${item}-${index}`} className="tag-chip">{item}</span>
        )) : <p className="empty-copy">{empty}</p>}
      </div>
    </section>
  );
}

function AdviceList({ title, items }) {
  return (
    <section className="advice-card">
      <h4>{title}</h4>
      {items.length ? (
        <ul>
          {items.map((item, index) => (
            <li key={`${item}-${index}`}>
              <span>{index + 1}</span>
              <p>{item}</p>
            </li>
          ))}
        </ul>
      ) : <p className="empty-copy">No detailed feedback generated yet.</p>}
    </section>
  );
}

export default function App() {
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeStep, setActiveStep] = useState(0);

  const parsed = result?.parsed || {};
  const matched = result?.matched || {};
  const feedback = result?.feedback || {};
  const score = matched.score || 0;
  const strengths = useMemo(() => feedback.strengths || matched.matchedSkills || [], [feedback, matched]);
  const gaps = useMemo(() => feedback.gaps || matched.missingSkills || [], [feedback, matched]);
  const suggestions = feedback.suggestions || [];
  const rewrittenBullets = feedback.rewrittenBullets || [];

  const analyze = async () => {
    if (!resumeText.trim() && !resumeFile) {
      setError('Please upload a resume file or paste resume text.');
      return;
    }
    if (!jobDescription.trim()) {
      setError('Please add a job description.');
      return;
    }

    setError('');
    setResult(null);
    setLoading(true);
    setActiveStep(0);

    const parserTimer = setTimeout(() => setActiveStep(1), 1200);
    const feedbackTimer = setTimeout(() => setActiveStep(2), 2600);

    try {
      const fd = new FormData();
      if (resumeFile) {
        fd.append('resume', resumeFile);
      }
      fd.append('resumeText', resumeText);
      fd.append('jobDescription', jobDescription);
      const res = await axios.post('http://localhost:5000/analyze', fd);
      setResult(res.data.result);
    } catch {
      setError('Analysis failed. Make sure your backend is running on port 5000.');
    }
    clearTimeout(parserTimer);
    clearTimeout(feedbackTimer);
    setLoading(false);
    setActiveStep(0);
  };

  const onFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setResumeFile(file);
    setError('');
  };

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">AI-Based Resume Screening and Feedback System</p>
          <h1>Transparent resume evaluation with agent-based AI</h1>
          <p className="hero-text">
            Upload a resume, paste the job description, and get a clear match score with strengths, missing skills, and practical improvements.
          </p>
          <div className="hero-stats">
            <div><strong>3</strong><span>AI agents</span></div>
            <div><strong>Qwen2.5</strong><span>Model used</span></div>
            <div><strong>1</strong><span>Unified feedback report</span></div>
          </div>
        </div>
        <div className="hero-card">
          <div className="hero-card-grid">
            {initialSteps.map((step, index) => (
              <div key={step.key} className={`hero-step ${loading && activeStep === index ? 'active' : ''}`}>
                <span>{index + 1}</span>
                <div>
                  <strong>{step.label}</strong>
                  <p>{loading && activeStep === index ? 'Running now' : 'Ready'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="input-panel">
        <div className="section-title">
          <p>Input</p>
          <h2>Upload resume or paste resume text</h2>
        </div>

        <div className="upload-box">
          <label className="upload-zone" htmlFor="resume-upload">
            <input id="resume-upload" type="file" accept=".pdf,.doc,.docx" onChange={onFileChange} />
            <strong>Upload PDF, DOC, or DOCX</strong>
            <span>{resumeFile ? resumeFile.name : 'Choose a resume file to analyze'}</span>
          </label>
        </div>

        <div className="text-grid">
          <label>
            <span>Resume Text</span>
            <textarea
              rows={12}
              value={resumeText}
              onChange={(event) => setResumeText(event.target.value)}
              placeholder="Paste resume content here if you do not want to upload a file."
            />
          </label>

          <label>
            <span>Job Description</span>
            <textarea
              rows={12}
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              placeholder="Paste the target job description, skills, and requirements."
            />
          </label>
        </div>

        {error && <div className="error-box">{error}</div>}

        <button className="primary-btn" onClick={analyze} disabled={loading}>
          {loading ? 'Analyzing resume...' : 'Analyze Resume'}
        </button>
      </section>

      {loading && (
        <section className="progress-panel">
          {initialSteps.map((step, index) => (
            <div key={step.key} className={`progress-step ${activeStep === index ? 'active' : activeStep > index ? 'done' : ''}`}>
              <span>{index + 1}</span>
              <div>
                <strong>{step.label}</strong>
                <p>{activeStep === index ? 'Running' : activeStep > index ? 'Completed' : 'Queued'}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {result && (
        <section className="results-panel">
          <div className={`score-banner ${scoreTone(score)}`}>
            <div className="score-circle">
              <strong>{score}</strong>
              <span>/100</span>
            </div>
            <div className="score-copy">
              <p>Compatibility Score</p>
              <h2>{feedback.summary || 'Resume analysis completed'}</h2>
              <div className="score-meta">
                <span>{matched.matchRatio || '0/0'} matched skills</span>
                <span>{parsed.candidateName || 'Candidate name unavailable'}</span>
                <span>{parsed.experienceYears || 0} years inferred experience</span>
              </div>
            </div>
          </div>

          <div className="results-grid">
            <ResultTags title="Strengths" items={strengths} tone="good" empty="No strengths identified." />
            <ResultTags title="Missing Skills" items={gaps} tone="alert" empty="No major gaps identified." />
          </div>

          <div className="results-grid">
            <ResultTags title="Resume Highlights" items={parsed.resumeHighlights || []} tone="neutral" empty="No resume highlights extracted." />
            <ResultTags title="Job Highlights" items={parsed.jobHighlights || []} tone="neutral" empty="No job highlights extracted." />
          </div>

          <div className="advice-grid">
            <AdviceList title="Improvement Suggestions" items={suggestions} />
            <AdviceList title="Resume-Ready Bullet Rewrites" items={rewrittenBullets} />
          </div>
        </section>
      )}
    </main>
  );
}