import { useMemo, useState } from 'react';
import axios from 'axios';
import { updateResumePdf } from './pdfLibResume.js';
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

function ScoreRing({ score }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(100, Math.max(0, score)) / 100);
  const color = score >= 75 ? '#1aad74' : score >= 45 ? '#f59e0b' : '#ef4444';
  return (
    <div className="score-ring-wrap">
      <svg width="110" height="110" viewBox="0 0 110 110" aria-hidden="true">
        <circle cx="55" cy="55" r={r} fill="none" stroke="#e8f0fa" strokeWidth="9" />
        <circle
          cx="55" cy="55" r={r}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 55 55)"
          className="score-arc"
        />
      </svg>
      <div className="score-ring-inner">
        <strong style={{ color }}>{score}</strong>
        <span>/100</span>
      </div>
    </div>
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
  const [isDragOver, setIsDragOver] = useState(false);

  const parsed = result?.parsed || {};
  const matched = result?.matched || {};
  const feedback = result?.feedback || {};
  const score = matched.score || 0;
  const breakdown = matched.breakdown || {};
  const strengths = useMemo(() => feedback.strengths || matched.matchedSkills || [], [feedback, matched]);
  const gaps = useMemo(() => feedback.gaps || matched.missingSkills || [], [feedback, matched]);
  const jdRequiredSkills = useMemo(() => matched.requiredSkills || parsed.requiredSkills || [], [matched, parsed]);
  const matchedSkillsSet = useMemo(() => new Set((matched.matchedSkills || []).map(s => s.toLowerCase())), [matched]);
  const suggestions = feedback.suggestions || [];
  const rewrittenBullets = feedback.rewrittenBullets || [];

  const originalResumeText = result?.resumeText || '';

  const downloadUpdatedResume = async () => {
    const blob = await updateResumePdf({
      candidateName:   parsed.candidateName   || '',
      score:           matched.score          ?? null,
      matchRatio:      matched.matchRatio     || '',
      experienceYears: parsed.experienceYears || 0,
      summary:         feedback.summary       || '',
      matchedSkills:   matched.matchedSkills  || [],
      missingSkills:   gaps,
      niceToHave:      parsed.niceToHave      || [],
      resumeSkills:    parsed.resumeSkills    || [],
      workExperience:  parsed.workExperience  || [],
      rewrittenBullets,
      suggestions,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-improved-resume-${(parsed.candidateName || 'candidate').replace(/\s+/g, '-')}.pdf`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  };

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
    const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const es = new EventSource(`${API}/analyze/status/${requestId}`);

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
    es.addEventListener('status', handleSSE);
    es.onerror = () => es.close();

    try {
      const fd = new FormData();
      if (resumeFile) fd.append('resume', resumeFile);
      fd.append('resumeText', resumeText);
      fd.append('jobDescription', jobDescription);
      fd.append('requestId', requestId);
      const res = await axios.post(`${API}/analyze`, fd);
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
          <div className="header-icon" aria-hidden="true">
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="hbg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#0f3460"/>
                  <stop offset="100%" stopColor="#147b8d"/>
                </linearGradient>
                <linearGradient id="hbolt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7dd3fc"/>
                  <stop offset="100%" stopColor="#34d399"/>
                </linearGradient>
              </defs>
              <rect width="64" height="64" rx="13" fill="url(#hbg)"/>
              <rect x="14" y="10" width="26" height="34" rx="3" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
              <line x1="19" y1="20" x2="34" y2="20" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="19" y1="25" x2="34" y2="25" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="19" y1="30" x2="29" y2="30" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M35 18 L28 33 L33 33 L29 48 L43 28 L37 28 L41 18 Z" fill="url(#hbolt)"/>
            </svg>
          </div>
          <span className="top-bar-title">Agentic AI Resume Screening &amp; Feedback</span>
          <span className="top-bar-model">Llama 3.1 8b · Groq</span>
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

          <label
            className={`upload-zone${isDragOver ? ' drag-over' : ''}`}
            htmlFor="resume-upload"
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) { setResumeFile(file); setError(''); }
            }}
          >
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

          {/* ── Idle: how-it-works + sample preview ── */}
          {!loading && pipelineState === 'idle' && !result && (
            <div className="empty-right">
              <div className="empty-intro">
                <p className="empty-heading">Agentic AI Resume Screening &amp; Feedback</p>
                <p className="empty-sub">Fill in the resume and job description on the left, then hit <strong>Analyze Resume</strong>.</p>
              </div>

              <div className="agent-cards">
                <div className="agent-card">
                  <div className="ac-icon" style={{background:'linear-gradient(135deg,#103c68,#1d75b8)'}}>📄</div>
                  <div>
                    <strong>Parser Agent</strong>
                    <p>Extracts resumeSkills, requiredSkills, niceToHave, and years of experience from the resume and JD.</p>
                  </div>
                </div>
                <div className="agent-card">
                  <div className="ac-icon" style={{background:'linear-gradient(135deg,#0f6e56,#19a8a3)'}}>🔍</div>
                  <div>
                    <strong>Matching Agent</strong>
                    <p>Computes a weighted compatibility score with a breakdown of required vs nice-to-have skill coverage.</p>
                  </div>
                </div>
                <div className="agent-card">
                  <div className="ac-icon" style={{background:'linear-gradient(135deg,#4a3fc0,#7f77dd)'}}>💬</div>
                  <div>
                    <strong>Feedback Agent</strong>
                    <p>Generates strengths, gaps, actionable suggestions, and ATS-ready rewritten resume bullets.</p>
                  </div>
                </div>
              </div>

              {/* Sample output preview */}
              <p className="preview-label">Sample output preview</p>
              <div className="sample-preview">
                <div className="sp-score-row">
                  <div className="sp-circle"><strong>82</strong><span>/100</span></div>
                  <div className="sp-score-info">
                    <div className="sp-bar-wrap"><div className="sp-bar" style={{width:'82%', background:'linear-gradient(90deg,#1aad74,#19a8a3)'}} /></div>
                    <div className="sp-chips">
                      <span className="sp-chip sp-green">Strong Match</span>
                      <span className="sp-chip">8/10 required</span>
                      <span className="sp-chip">5 yrs experience</span>
                    </div>
                  </div>
                </div>
                <div className="sp-rows">
                  <div className="sp-section">
                    <span className="sp-sec-label sp-good">✦ Strengths</span>
                    <div className="sp-tags">
                      {['React','Node.js','REST APIs','Agile','TypeScript'].map(t => <span key={t} className="sp-tag">{t}</span>)}
                    </div>
                  </div>
                  <div className="sp-section">
                    <span className="sp-sec-label sp-alert">✦ Missing Skills</span>
                    <div className="sp-tags">
                      {['GraphQL','Docker','AWS'].map(t => <span key={t} className="sp-tag sp-tag-alert">{t}</span>)}
                    </div>
                  </div>
                  <div className="sp-section sp-full">
                    <span className="sp-sec-label sp-neutral">✦ Top Suggestion</span>
                    <div className="sp-suggestion">Add measurable achievements to your bullet points (e.g., "Reduced load time by 40%").</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Running: progress + skeleton placeholder ── */}
          {(loading || (pipelineState !== 'idle' && !result)) && (
            <>
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

              <div className="skeleton-panel">
                <div className="sk-score-row">
                  <div className="sk-circle skel" />
                  <div className="sk-score-lines">
                    <div className="skel sk-line" style={{width:'40%', height:'12px'}} />
                    <div className="skel sk-line" style={{width:'70%', height:'20px', marginTop:'8px'}} />
                    <div style={{display:'flex', gap:'8px', marginTop:'10px'}}>
                      <div className="skel sk-line" style={{width:'90px', height:'26px', borderRadius:'999px'}} />
                      <div className="skel sk-line" style={{width:'110px', height:'26px', borderRadius:'999px'}} />
                    </div>
                  </div>
                </div>
                <div className="sk-grid">
                  {[0,1,2,3].map(i => (
                    <div key={i} className="sk-card">
                      <div className="skel sk-line" style={{width:'50%', height:'13px', marginBottom:'12px'}} />
                      <div className="skel sk-line" style={{width:'100%', height:'10px', marginBottom:'7px'}} />
                      <div className="skel sk-line" style={{width:'80%', height:'10px', marginBottom:'7px'}} />
                      <div className="skel sk-line" style={{width:'65%', height:'10px'}} />
                    </div>
                  ))}
                </div>
                <div className="sk-advice">
                  {[0,1].map(i => (
                    <div key={i} className="sk-card">
                      <div className="skel sk-line" style={{width:'55%', height:'13px', marginBottom:'14px'}} />
                      {[90,75,60,80].map((w,j) => (
                        <div key={j} className="skel sk-line" style={{width:`${w}%`, height:'10px', marginBottom:'8px'}} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {result && (
            <section className="results-panel">
              {result && (
                <div className="export-toolbar">
                  <button className="export-btn export-resume" onClick={downloadUpdatedResume}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download AI-Improved Resume PDF
                  </button>
                </div>
              )}

              {/* Score row */}
              <div className="sp-score-row res-score-row">
                <ScoreRing score={score} />
                <div className="sp-score-info">
                  <div className="sp-bar-wrap">
                    <div className="sp-bar" style={{
                      width: `${score}%`,
                      background: score >= 75
                        ? 'linear-gradient(90deg,#1aad74,#19a8a3)'
                        : score >= 45
                        ? 'linear-gradient(90deg,#ba7517,#f59e0b)'
                        : 'linear-gradient(90deg,#d94e3f,#f87171)',
                    }} />
                  </div>
                  <div className="sp-chips">
                    <span className={`sp-chip ${score >= 75 ? 'sp-green' : score >= 45 ? 'sp-amber' : 'sp-red'}`}>
                      {score >= 75 ? 'Strong Match' : score >= 45 ? 'Partial Match' : 'Low Match'}
                    </span>
                    <span className="sp-chip">{matched.matchRatio || '0/0'} required matched</span>
                    {breakdown.niceToHaveScore !== undefined && breakdown.niceToHaveScore > 0 && (
                      <span className="sp-chip">{breakdown.niceToHaveScore}% nice-to-have</span>
                    )}
                    {parsed.candidateName && <span className="sp-chip">{parsed.candidateName}</span>}
                    <span className="sp-chip">{parsed.experienceYears || 0} yrs experience</span>
                  </div>
                  {feedback.summary && <p className="res-summary">{feedback.summary}</p>}
                </div>
              </div>

              {jdRequiredSkills.length > 0 && (
                <div className="jd-skills-block">
                  <span className="sp-sec-label sp-neutral">✦ Job Description Required Skills</span>
                  <div className="sp-tags jd-skills-tags">
                    {jdRequiredSkills.map((t, i) => {
                      const isMatched = matchedSkillsSet.has(t.toLowerCase());
                      return (
                        <span key={i} className={`sp-tag ${isMatched ? 'sp-tag-matched' : 'sp-tag-alert'}`}>
                          {isMatched ? '✓ ' : '✗ '}{t}
                        </span>
                      );
                    })}
                  </div>
                  <div className="jd-legend">
                    <span className="jd-legend-dot jd-dot-matched" /> You have it
                    <span className="jd-legend-dot jd-dot-missing" /> Missing
                  </div>
                </div>
              )}

              {/* Skills grid */}
              <div className="sp-rows">
                <div className="sp-section">
                  <span className="sp-sec-label sp-good">✦ Strengths</span>
                  <div className="sp-tags">
                    {strengths.length ? strengths.map((t, i) => <span key={i} className="sp-tag">{t}</span>) : <span className="res-empty">None identified</span>}
                  </div>
                </div>
                <div className="sp-section">
                  <span className="sp-sec-label sp-alert">✦ Missing Required Skills</span>
                  <div className="sp-tags">
                    {gaps.length ? gaps.map((t, i) => <span key={i} className="sp-tag sp-tag-alert">{t}</span>) : <span className="res-empty">No major gaps</span>}
                  </div>
                </div>
                {(parsed.niceToHave?.length > 0) && (
                  <div className="sp-section">
                    <span className="sp-sec-label sp-neutral">✦ Nice to Have</span>
                    <div className="sp-tags">
                      {parsed.niceToHave.map((t, i) => <span key={i} className="sp-tag">{t}</span>)}
                    </div>
                  </div>
                )}
                {(parsed.resumeSkills?.length > 0) && (
                  <div className="sp-section">
                    <span className="sp-sec-label sp-neutral">✦ All Resume Skills</span>
                    <div className="sp-tags">
                      {parsed.resumeSkills.map((t, i) => <span key={i} className="sp-tag">{t}</span>)}
                    </div>
                  </div>
                )}
              </div>

              {/* Improvement suggestions */}
              {suggestions.length > 0 && (
                <div className="res-advice-block">
                  <span className="sp-sec-label sp-neutral">✦ Improvement Suggestions</span>
                  <div className="res-advice-list">
                    {suggestions.map((s, i) => (
                      <div key={i} className="sp-suggestion res-adv-item">
                        <span className="res-adv-num">{i + 1}</span>
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rewritten bullets */}
              {rewrittenBullets.length > 0 && (
                <div className="res-advice-block bullets-block">
                  <div className="bullets-header">
                    <span className="sp-sec-label sp-bullets-label">✦ AI-Rewritten Bullets</span>
                    <span className="bullets-badge">ATS-ready</span>
                  </div>
                  <p className="bullets-sub">These replace your original bullet points in the downloaded PDF</p>
                  <div className="res-advice-list">
                    {rewrittenBullets.map((s, i) => (
                      <div key={i} className="bullet-item">
                        <span className="bullet-icon">✦</span>
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
