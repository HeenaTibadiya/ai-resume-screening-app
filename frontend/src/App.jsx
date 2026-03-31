import { useState } from 'react';
import axios from 'axios';

// ── robust JSON extractor ─────────────────────────────────────────────────
function extractJSON(str) {
  if (!str) return null;
  if (typeof str === 'object') return str;
  try {
    const fenced = str.match(/```[\s\S]*?({[\s\S]*?})[\s\S]*?```/);
    if (fenced) return JSON.parse(fenced[1]);
    const plain = str.match(/{[\s\S]*}/);
    if (plain) return JSON.parse(plain[0]);
  } catch {}
  return null;
}

// ── colours ───────────────────────────────────────────────────────────────
const C = {
  bg: '#F0F4F8', card: '#FFFFFF', navy: '#1A2E4A',
  blue: '#2563EB', blueLight: '#EFF6FF', blueBorder: '#BFDBFE',
  green: '#16A34A', greenLight: '#F0FDF4', greenBorder: '#BBF7D0',
  red: '#DC2626', redLight: '#FEF2F2', redBorder: '#FECACA',
  amber: '#D97706', amberLight: '#FFFBEB', amberBorder: '#FDE68A',
  purple: '#7C3AED', purpleLight: '#F5F3FF', purpleBorder: '#DDD6FE',
  teal: '#0D9488', tealLight: '#F0FDFA', tealBorder: '#99F6E4',
  text: '#1E293B', textSub: '#64748B', border: '#E2E8F0',
};

const s = {
  app: { minHeight: '100vh', background: C.bg, fontFamily: "'Segoe UI', system-ui, Arial, sans-serif", color: C.text },
  header: { background: C.navy, padding: '0 40px', display: 'flex', alignItems: 'center', height: 64, gap: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' },
  logoBox: { width: 36, height: 36, background: C.blue, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 },
  headerSub: { color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: 0 },
  headerBadge: { marginLeft: 'auto', background: 'rgba(37,99,235,0.25)', border: '1px solid rgba(37,99,235,0.5)', color: '#93C5FD', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  hero: { background: `linear-gradient(135deg, ${C.navy} 0%, #1e3a5f 100%)`, padding: '44px 40px 48px', textAlign: 'center' },
  heroChip: { display: 'inline-block', background: 'rgba(37,99,235,0.25)', border: '1px solid rgba(37,99,235,0.4)', color: '#93C5FD', padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 },
  heroH1: { color: '#fff', fontSize: 34, fontWeight: 800, margin: '0 0 10px', lineHeight: 1.25 },
  heroSpan: { color: '#60A5FA' },
  heroP: { color: 'rgba(255,255,255,0.55)', fontSize: 15, maxWidth: 500, margin: '0 auto 24px', lineHeight: 1.7 },
  stepsRow: { display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' },
  step: { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.65)', fontSize: 13 },
  stepNum: { width: 22, height: 22, background: C.blue, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 },
  main: { maxWidth: 980, margin: '0 auto', padding: '28px 20px' },
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 20 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  fieldLabel: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 10 },
  labelIcon: { width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 },
  textarea: { width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 13, padding: '12px 14px', resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box', background: '#FAFBFC', transition: 'border 0.2s' },
  btn: { width: '100%', marginTop: 20, padding: '14px', background: C.blue, border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 },
  errBox: { background: C.redLight, border: `1px solid ${C.redBorder}`, borderRadius: 10, padding: '10px 14px', color: C.red, fontSize: 13, marginTop: 14 },
  pipelineCard: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '18px 28px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 20, textAlign: 'center' },
  pipelineRow: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10 },
  agentChip: (active) => ({ background: active ? C.blueLight : '#F8FAFC', border: `1px solid ${active ? C.blue : C.border}`, borderRadius: 20, padding: '6px 16px', color: active ? C.blue : C.textSub, fontSize: 13, fontWeight: 600 }),
  spinner: { width: 18, height: 18, border: '3px solid rgba(255,255,255,0.35)', borderTop: '3px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
};

// ── Score Circle ──────────────────────────────────────────────────────────
function ScoreCircle({ score }) {
  const color = score >= 70 ? ['#16A34A','#4ADE80','rgba(22,163,74,0.25)']
              : score >= 40 ? ['#D97706','#FCD34D','rgba(217,119,6,0.25)']
              : ['#DC2626','#F87171','rgba(220,38,38,0.25)'];
  const label = score >= 70 ? '✅ Strong Match' : score >= 40 ? '⚠️ Partial Match' : '❌ Low Match';
  const desc  = score >= 70 ? 'Your resume aligns well with this role.'
              : score >= 40 ? 'You meet some requirements but have notable gaps.'
              : 'Significant improvements needed for this role.';
  return (
    <div style={{ ...s.card, display: 'flex', alignItems: 'center', gap: 32 }}>
      <div style={{ width: 130, height: 130, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg, ${color[0]}, ${color[1]})`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: `0 6px 24px ${color[2]}` }}>
        <span style={{ color: '#fff', fontSize: 38, fontWeight: 900, lineHeight: 1 }}>{score}</span>
        <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 600 }}>/ 100</span>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.navy, marginBottom: 6 }}>{label}</div>
        <div style={{ fontSize: 14, color: C.textSub, marginBottom: 16, lineHeight: 1.6 }}>{desc}</div>
        <div style={{ height: 10, background: C.border, borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ height: '100%', width: `${score}%`, borderRadius: 99, background: `linear-gradient(90deg, ${color[0]}, ${color[1]})`, transition: 'width 1.2s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.textSub }}>
          <span>0 — No match</span>
          <span style={{ fontWeight: 700, color: color[0] }}>{score} / 100</span>
          <span>100 — Perfect match</span>
        </div>
      </div>
    </div>
  );
}

// ── Stat boxes ────────────────────────────────────────────────────────────
function StatRow({ matched, missing, suggestions, score }) {
  const items = [
    { val: `${score}/100`, label: 'Match Score',      color: score>=70?C.green:score>=40?C.amber:C.red, light: score>=70?C.greenLight:score>=40?C.amberLight:C.redLight, border: score>=70?C.greenBorder:score>=40?C.amberBorder:C.redBorder },
    { val: matched,        label: 'Skills Matched',   color: C.green,  light: C.greenLight,  border: C.greenBorder },
    { val: missing,        label: 'Skills Missing',   color: C.red,    light: C.redLight,    border: C.redBorder },
    { val: suggestions,    label: 'Improvement Tips', color: C.purple, light: C.purpleLight, border: C.purpleBorder },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
      {items.map((it, i) => (
        <div key={i} style={{ background: it.light, border: `1px solid ${it.border}`, borderRadius: 14, padding: '16px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: it.color, lineHeight: 1 }}>{it.val}</div>
          <div style={{ fontSize: 12, color: C.textSub, marginTop: 5, fontWeight: 600 }}>{it.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Skill tag ─────────────────────────────────────────────────────────────
function Tag({ text, color, light, border, icon }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: light, border: `1px solid ${border}`, color, padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 600, margin: '3px 4px 3px 0' }}>
      {icon} {text}
    </span>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button onClick={copy} style={{ background: copied ? C.greenLight : C.blueLight, border: `1px solid ${copied ? C.greenBorder : C.blueBorder}`, color: copied ? C.green : C.blue, padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s' }}>
      {copied ? '✓ Copied!' : '📋 Copy'}
    </button>
  );
}

// ── Results ───────────────────────────────────────────────────────────────
function ResultsDisplay({ result }) {
  const [showRaw, setShowRaw] = useState(false);

  const parsed   = extractJSON(result.parsed)   || {};
  const matched  = extractJSON(result.matched)  || result.matched  || {};
  const feedback = extractJSON(result.feedback) || result.feedback || {};

  const score         = matched.score         || 0;
  const matchedSkills = matched.matchedSkills  || feedback.strengths || [];
  const missingSkills = matched.missingSkills  || feedback.gaps      || [];
  const strengths     = feedback.strengths     || matchedSkills;
  const gaps          = feedback.gaps          || missingSkills;
  const suggestions   = feedback.suggestions   || [];

  return (
    <div>
      {/* Score circle */}
      <ScoreCircle score={score} />

      {/* Stats */}
      <StatRow
        score={score}
        matched={strengths.length}
        missing={gaps.length}
        suggestions={suggestions.length}
      />

      {/* Matched + Missing skills */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

        {/* Matched */}
        <div style={{ ...s.card, marginBottom: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.green, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            ✅ Matched Skills
            <span style={{ marginLeft: 'auto', background: C.greenLight, border: `1px solid ${C.greenBorder}`, color: C.green, borderRadius: 20, padding: '2px 10px', fontSize: 12 }}>{strengths.length}</span>
          </div>
          <div>
            {strengths.length > 0
              ? strengths.map((sk, i) => <Tag key={i} text={sk} icon="✓" color={C.green} light="#DCFCE7" border={C.greenBorder} />)
              : <span style={{ color: C.textSub, fontSize: 13 }}>No matched skills found</span>
            }
          </div>
        </div>

        {/* Missing */}
        <div style={{ ...s.card, marginBottom: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.red, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            ❌ Missing Skills
            <span style={{ marginLeft: 'auto', background: C.redLight, border: `1px solid ${C.redBorder}`, color: C.red, borderRadius: 20, padding: '2px 10px', fontSize: 12 }}>{gaps.length}</span>
          </div>
          <div>
            {gaps.length > 0
              ? gaps.map((sk, i) => <Tag key={i} text={sk} icon="✕" color={C.red} light="#FEE2E2" border={C.redBorder} />)
              : <span style={{ color: C.green, fontSize: 13, fontWeight: 600 }}>🎉 No missing skills — great match!</span>
            }
          </div>
        </div>

      </div>

      {/* Copy-paste bullet suggestions */}
      <div style={s.card}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.purple, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
          💡 Resume Improvement Suggestions
        </div>
        <div style={{ fontSize: 13, color: C.textSub, marginBottom: 16 }}>
          Copy these bullet points and paste them directly into your resume to improve your match score.
        </div>

        {suggestions.length > 0 ? (
          suggestions.map((sg, i) => (
            <div key={i} style={{ background: C.purpleLight, border: `1px solid ${C.purpleBorder}`, borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: C.purple, color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, marginBottom: 8 }}>{sg}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ background: '#fff', border: `1px solid ${C.purpleBorder}`, borderRadius: 8, padding: '6px 12px', fontSize: 12, color: C.textSub, fontFamily: 'Courier New, monospace', flex: 1, lineHeight: 1.5 }}>
                      • {sg}
                    </div>
                    <CopyBtn text={`• ${sg}`} />
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ background: C.amberLight, border: `1px solid ${C.amberBorder}`, borderRadius: 10, padding: '12px 16px', color: C.amber, fontSize: 13 }}>
            ⚠️ No suggestions generated. Try re-running the analysis.
          </div>
        )}
      </div>

      {/* Raw JSON */}
      <button
        style={{ background: 'none', border: `1px solid ${C.border}`, color: C.textSub, padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}
        onClick={() => setShowRaw(p => !p)}>
        {showRaw ? '▲ Hide' : '▼ Show'} raw JSON output
      </button>
      {showRaw && (
        <div style={{ background: '#F8FAFC', border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, color: C.textSub, fontSize: 12, fontFamily: 'Courier New, monospace', overflow: 'auto', maxHeight: 300, marginTop: 10, lineHeight: 1.6 }}>
          <pre>{JSON.stringify({ parsed, matched, feedback }, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────
export default function App() {
  const [resume,      setResume]      = useState('');
  const [jobDesc,     setJobDesc]     = useState('');
  const [result,      setResult]      = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [activeAgent, setActiveAgent] = useState(0);

  const analyze = async () => {
    if (!resume.trim() || !jobDesc.trim()) { setError('Please fill in both fields.'); return; }
    setError(''); setResult(null); setLoading(true); setActiveAgent(0);
    const t1 = setTimeout(() => setActiveAgent(1), 2000);
    const t2 = setTimeout(() => setActiveAgent(2), 5000);
    try {
      const fd = new FormData();
      fd.append('resumeText',     resume.substring(0, 600));
      fd.append('jobDescription', jobDesc.substring(0, 500));
      const res = await axios.post('http://localhost:5000/analyze', fd);
      setResult(res.data.result);
    } catch {
      setError('Analysis failed. Make sure your backend is running on port 5000.');
    }
    clearTimeout(t1); clearTimeout(t2);
    setLoading(false); setActiveAgent(0);
  };

  const agents = ['📄 Parser Agent', '⚖️ Matching Agent', '💬 Feedback Agent'];

  return (
    <div style={s.app}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        textarea:focus { border-color: #2563EB !important; box-shadow: 0 0 0 3px rgba(37,99,235,0.12); }
        button:active  { transform: scale(0.98); }
      `}</style>

      {/* Header */}
      <div style={s.header}>
        <div style={s.logoBox}>🤖</div>
        <div>
          <div style={s.headerTitle}>ResumeAI Screener</div>
          <div style={s.headerSub}>LangChain.js · Ollama · Llama 3</div>
        </div>
        <div style={s.headerBadge}>✦ Agentic AI · Open Source</div>
      </div>

      {/* Hero */}
      <div style={s.hero}>
        <div style={s.heroChip}>✦ 3-Agent AI Pipeline · No API Key Required</div>
        <h1 style={s.heroH1}>Analyze Your Resume with <span style={s.heroSpan}>Agentic AI</span></h1>
        <p style={s.heroP}>Get a match score, see exactly which skills you're missing, and get copy-paste bullet points to improve your resume instantly.</p>
        <div style={s.stepsRow}>
          {['Paste resume','Add job description','Click Analyze','Copy improvements'].map((t,i) => (
            <div key={i} style={s.step}>
              <div style={s.stepNum}>{i+1}</div><span>{t}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={s.main}>

        {/* Input */}
        <div style={s.card}>
          <div style={s.twoCol}>
            <div>
              <div style={s.fieldLabel}>
                <div style={{ ...s.labelIcon, background: '#EFF6FF' }}>📄</div>
                Your Resume
              </div>
              <textarea rows={11} style={s.textarea}
                placeholder="Paste your resume here — skills, experience, education..."
                value={resume} onChange={e => setResume(e.target.value)} />
            </div>
            <div>
              <div style={s.fieldLabel}>
                <div style={{ ...s.labelIcon, background: '#F0FDF4' }}>💼</div>
                Job Description
              </div>
              <textarea rows={11} style={s.textarea}
                placeholder="Paste the job description — required skills, responsibilities..."
                value={jobDesc} onChange={e => setJobDesc(e.target.value)} />
            </div>
          </div>
          {error && <div style={s.errBox}>⚠️ {error}</div>}
          <button style={{ ...s.btn, opacity: loading ? 0.75 : 1 }} onClick={analyze} disabled={loading}>
            {loading ? <><div style={s.spinner} /> Analyzing your resume...</> : <>🔍 Analyze Resume</>}
          </button>
        </div>

        {/* Pipeline progress */}
        {loading && (
          <div style={s.pipelineCard}>
            <div style={{ fontSize: 13, color: C.textSub, fontWeight: 600 }}>Running agent pipeline — please wait 1–2 minutes...</div>
            <div style={s.pipelineRow}>
              {agents.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={s.agentChip(activeAgent === i)}>{a}</div>
                  {i < agents.length - 1 && <span style={{ color: C.border, fontSize: 18 }}>→</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {result && <ResultsDisplay result={result} />}

      </div>
    </div>
  );
}