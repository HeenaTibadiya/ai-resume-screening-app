import { useMemo, useRef, useState } from 'react';
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
  const resultsRef = useRef(null);

  // ── PDF export ──
  const exportPDF = async () => {
    const html2pdf = (await import('html2pdf.js')).default;
    const el = resultsRef.current;
    if (!el) return;
    html2pdf()
      .set({
        margin: [10, 12, 10, 12],
        filename: `resume-screening-${parsed.candidateName || 'report'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(el)
      .save();
  };

  // ── Word export ──
  const exportWord = async () => {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx');
    const { saveAs } = await import('file-saver');

    const bulletList = (items) =>
      items.map((t) => new Paragraph({ text: `• ${t}`, indent: { left: 360 } }));

    const section = (title, items) => [
      new Paragraph({ text: title, heading: HeadingLevel.HEADING_2, spacing: { before: 300 } }),
      ...(items.length ? bulletList(items) : [new Paragraph({ text: 'None identified.' })]),
    ];

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: 'Agentic AI Resume Screening & Feedback Report',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: '' }),
          // Meta
          new Paragraph({ text: 'Candidate Overview', heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ children: [new TextRun({ text: 'Name: ', bold: true }), new TextRun(parsed.candidateName || 'N/A')] }),
          new Paragraph({ children: [new TextRun({ text: 'Experience: ', bold: true }), new TextRun(`${parsed.experienceYears || 0} years`)] }),
          new Paragraph({ children: [new TextRun({ text: 'Match Score: ', bold: true }), new TextRun(`${score}/100`)] }),
          new Paragraph({ children: [new TextRun({ text: 'Matched Skills: ', bold: true }), new TextRun(matched.matchRatio || '0/0')] }),
          new Paragraph({ text: '' }),
          // Summary
          new Paragraph({ text: 'Summary', heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ text: feedback.summary || 'No summary available.' }),
          new Paragraph({ text: '' }),
          // Skills sections
          ...section('Strengths / Matched Skills', strengths),
          new Paragraph({ text: '' }),
          ...section('Missing Skills / Gaps', gaps),
          new Paragraph({ text: '' }),
          ...section('Resume Highlights', parsed.resumeHighlights || []),
          new Paragraph({ text: '' }),
          ...section('Job Highlights', parsed.jobHighlights || []),
          new Paragraph({ text: '' }),
          ...section('Improvement Suggestions', suggestions),
          new Paragraph({ text: '' }),
          ...section('Rewritten Resume Bullets', rewrittenBullets),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `resume-screening-${parsed.candidateName || 'report'}.docx`);
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

              {/* Sample output preview */}
              <p className="preview-label">Sample output preview</p>
              <div className="sample-preview">
                <div className="sp-score-row">
                  <div className="sp-circle"><strong>82</strong><span>/100</span></div>
                  <div className="sp-score-info">
                    <div className="sp-bar-wrap"><div className="sp-bar" style={{width:'82%', background:'linear-gradient(90deg,#1aad74,#19a8a3)'}} /></div>
                    <div className="sp-chips">
                      <span className="sp-chip sp-green">Strong Match</span>
                      <span className="sp-chip">8/10 skills matched</span>
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

              {/* Skeleton result cards */}
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
            <section className="results-panel" ref={resultsRef}>
              <div className="export-toolbar">
                <button className="export-btn export-pdf" onClick={exportPDF}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 13h1a2 2 0 0 1 0 4H9v-4z"/><line x1="13" y1="13" x2="13" y2="17"/><line x1="15" y1="13" x2="15" y2="17"/><line x1="17" y1="15" x2="13" y2="15"/></svg>
                  Export PDF
                </button>
                <button className="export-btn export-word" onClick={exportWord}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="8 14 10 18 12 14 14 18 16 14"/></svg>
                  Export Word
                </button>
              </div>

              {/* Score row */}
              <div className="sp-score-row res-score-row">
                <div className="sp-circle res-circle">
                  <strong>{score}</strong>
                  <span>/100</span>
                </div>
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
                    <span className={`sp-chip ${
                      score >= 75 ? 'sp-green' : score >= 45 ? 'sp-amber' : 'sp-red'
                    }`}>
                      {score >= 75 ? 'Strong Match' : score >= 45 ? 'Partial Match' : 'Low Match'}
                    </span>
                    <span className="sp-chip">{matched.matchRatio || '0/0'} skills matched</span>
                    {parsed.candidateName && <span className="sp-chip">{parsed.candidateName}</span>}
                    <span className="sp-chip">{parsed.experienceYears || 0} yrs experience</span>
                  </div>
                  {feedback.summary && <p className="res-summary">{feedback.summary}</p>}
                </div>
              </div>

              {/* Skills grid */}
              <div className="sp-rows">
                <div className="sp-section">
                  <span className="sp-sec-label sp-good">✦ Strengths</span>
                  <div className="sp-tags">
                    {strengths.length ? strengths.map((t, i) => <span key={i} className="sp-tag">{t}</span>) : <span className="res-empty">None identified</span>}
                  </div>
                </div>
                <div className="sp-section">
                  <span className="sp-sec-label sp-alert">✦ Missing Skills</span>
                  <div className="sp-tags">
                    {gaps.length ? gaps.map((t, i) => <span key={i} className="sp-tag sp-tag-alert">{t}</span>) : <span className="res-empty">No major gaps</span>}
                  </div>
                </div>
                {(parsed.resumeHighlights?.length > 0) && (
                  <div className="sp-section">
                    <span className="sp-sec-label sp-neutral">✦ Resume Highlights</span>
                    <div className="sp-tags">
                      {parsed.resumeHighlights.map((t, i) => <span key={i} className="sp-tag">{t}</span>)}
                    </div>
                  </div>
                )}
                {(parsed.jobHighlights?.length > 0) && (
                  <div className="sp-section">
                    <span className="sp-sec-label sp-neutral">✦ Job Highlights</span>
                    <div className="sp-tags">
                      {parsed.jobHighlights.map((t, i) => <span key={i} className="sp-tag">{t}</span>)}
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
                <div className="res-advice-block">
                  <span className="sp-sec-label sp-neutral">✦ Rewritten Resume Bullets</span>
                  <div className="res-advice-list">
                    {rewrittenBullets.map((s, i) => (
                      <div key={i} className="sp-suggestion res-adv-item">
                        <span className="res-adv-num">{i + 1}</span>
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