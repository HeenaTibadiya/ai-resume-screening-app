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
  const [pipelineState, setPipelineState] = useState('idle');
  const [agentStates, setAgentStates] = useState({ parser: 'idle', matching: 'idle', feedback: 'idle' });
  const [agentMessages, setAgentMessages] = useState({ parser: '', matching: '', feedback: '' });

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
    setPipelineState('idle');
    setAgentStates({ parser: 'idle', matching: 'idle', feedback: 'idle' });
    setAgentMessages({ parser: '', matching: '', feedback: '' });

    const requestId = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
    const es = new EventSource(`http://localhost:5000/analyze/status/${requestId}`);

    const handleSSE = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.type === 'pipeline') {
          setPipelineState(data.state);
          if (data.state === 'completed' || data.state === 'failed') {
            es.close();
          }
        } else if (data.type === 'agent') {
          setAgentStates(prev => ({ ...prev, [data.agent]: data.state }));
          setAgentMessages(prev => ({ ...prev, [data.agent]: data.message || '' }));
        }
      } catch {}
    };
    // Backend sends named events: "event: status" — must use addEventListener, not onmessage
    es.addEventListener('status', handleSSE);
    es.onerror = () => es.close();

    try {
      const fd = new FormData();
      if (resumeFile) {
        fd.append('resume', resumeFile);
      }
      fd.append('resumeText', resumeText);
      fd.append('jobDescription', jobDescription);
      fd.append('requestId', requestId);
      const res = await axios.post('http://localhost:5000/analyze', fd);
      setResult(res.data.result);
    } catch {
      setError('Analysis failed. Make sure your backend is running on port 5000.');
      es.close();
    }
    setLoading(false);
  };

  const onFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setResumeFile(file);
    setError('');
  };

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div className="top-bar-left">
          <span className="top-bar-title">Agentic AI Resume Screening &amp; Feedback</span>
          <span className="top-bar-model">Qwen2.5</span>
        </div>
        <div className="top-bar-agents">
          {initialSteps.map((step) => (
            <span
              key={step.key}
              className={`agent-pill ${
                agentStates[step.key] === 'running' ? 'ap-running'
                : agentStates[step.key] === 'completed' ? 'ap-done'
                : agentStates[step.key] === 'failed' ? 'ap-failed'
                : ''
              }`}
            >
              <span className={`ap-dot ${agentStates[step.key] === 'running' ? 'dot-pulse' : ''}`} />
              {step.label}
            </span>
          ))}
        </div>
      </header>

      <div className="page-body">
        {/* ── Left: inputs ── */}
        <aside className="left-col">
          <div className="section-title">
            <h2>Resume &amp; Job Description</h2>
          </div>

          <label className="upload-zone" htmlFor="resume-upload">
            <input id="resume-upload" type="file" accept=".pdf,.doc,.docx" onChange={onFileChange} />
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <strong>{resumeFile ? resumeFile.name : 'Upload PDF, DOC or DOCX'}</strong>
            <span>{resumeFile ? 'File ready' : 'or paste text below'}</span>
          </label>

          <div className="text-stack">
            <label>
              <span>Resume Text</span>
              <textarea
                rows={6}
                value={resumeText}
                onChange={(event) => setResumeText(event.target.value)}
                placeholder="Paste resume content here…"
              />
            </label>
            <label>
              <span>Job Description</span>
              <textarea
                rows={6}
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                placeholder="Paste the target job description…"
              />
            </label>
          </div>

          {error && <div className="error-box">{error}</div>}

          <button className="primary-btn" onClick={analyze} disabled={loading}>
            {loading ? 'Analyzing…' : 'Analyze Resume'}
          </button>
        </aside>

        {/* ── Right: pipeline + results ── */}
        <div className="right-col">
          {(loading || pipelineState !== 'idle') && (
            <section className="progress-panel">
              {initialSteps.map((step, index) => {
                const state = agentStates[step.key];
                const stepCls = state === 'running' ? 'active' : state === 'completed' ? 'done' : state === 'failed' ? 'failed' : '';
                return (
                  <div key={step.key} className={`progress-step ${stepCls}`}>
                    <span className={state === 'running' ? 'spinning' : ''}>
                      {state === 'completed' ? '✓' : state === 'failed' ? '✗' : index + 1}
                    </span>
                    <div>
                      <strong>{step.label}</strong>
                      <p>
                        {state === 'running'
                          ? (agentMessages[step.key] || 'Running…')
                          : state === 'completed' ? 'Completed'
                          : state === 'failed' ? 'Failed'
                          : 'Queued'}
                      </p>
                      {state === 'running' && <div className="agent-bar"><div className="agent-bar-fill" /></div>}
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {!result && !loading && pipelineState === 'idle' && (
            <div className="empty-right">
              <p className="empty-heading">Agentic AI Resume Screening &amp; Feedback</p>
              <p className="empty-sub">Fill in the resume and job description on the left, then hit <strong>Analyze Resume</strong>.</p>
              <div className="agent-cards">
                <div className="agent-card">
                  <div className="ac-icon" style={{background:'linear-gradient(135deg,#103c68,#1d75b8)'}}>📄</div>
                  <div>
                    <strong>Parser Agent</strong>
                    <p>Extracts candidate profile, skills, experience and key highlights from the resume.</p>
                  </div>
                </div>
                <div className="agent-card">
                  <div className="ac-icon" style={{background:'linear-gradient(135deg,#0f6e56,#19a8a3)'}}>🔍</div>
                  <div>
                    <strong>Matching Agent</strong>
                    <p>Compares resume skills against the job description and generates a compatibility score.</p>
                  </div>
                </div>
                <div className="agent-card">
                  <div className="ac-icon" style={{background:'linear-gradient(135deg,#4a3fc0,#7f77dd)'}}>💬</div>
                  <div>
                    <strong>Feedback Agent</strong>
                    <p>Produces improvement suggestions and rewrites weak bullet points for stronger impact.</p>
                  </div>
                </div>
              </div>
            </div>
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
                    <span>{parsed.experienceYears || 0} yrs experience</span>
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
        </div>
      </div>
    </main>
  );
}