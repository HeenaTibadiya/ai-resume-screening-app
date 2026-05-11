/**
 * pdfLibResume.js
 * Generates a clean, evenly spaced, professional "AI-Enhanced Resume" PDF
 * entirely from structured data — no in-place editing, no overlaps.
 *
 * Visual system
 * ─────────────
 * Base unit  : 4 pt  (all spacing is a multiple of 4)
 * Body font  : 9.5 pt / line-height 15 pt
 * Label font : 8 pt   / line-height 12 pt
 * Section gap: 20 pt above heading rule
 * Margins    : left 52 pt  right 52 pt  bottom 52 pt
 */

import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib';

// ─── Grid & geometry ──────────────────────────────────────────────────────────
const PW = PageSizes.A4[0];          // 595.28 pt
const PH = PageSizes.A4[1];          // 841.89 pt
const L  = 52;                       // left margin
const R  = 52;                       // right margin
const B  = 52;                       // bottom margin
const CW = PW - L - R;              // 491.28 pt content width

const HDR_H    = 84;                 // header band height
const BODY_TOP = PH - HDR_H - 24;   // first content y after header

// Type scale
const T = {
  name   : 21,
  body   : 9.5,
  label  : 8,
  tiny   : 7,
  chip   : 8,
};

// Line heights (multiples of 4)
const LH = {
  body  : 15,
  label : 12,
  chip  : 16,   // chip capsule total height
};

// Section rhythm
const SEC_BEFORE = 20;   // gap above section rule
const SEC_AFTER  =  8;   // gap below section label before content

// ─── Colour palette ───────────────────────────────────────────────────────────
const C = {
  navy    : rgb(0.07, 0.17, 0.33),
  blue    : rgb(0.10, 0.41, 0.72),
  teal    : rgb(0.04, 0.52, 0.58),
  green   : rgb(0.04, 0.43, 0.25),
  amber   : rgb(0.65, 0.37, 0.00),
  red     : rgb(0.60, 0.10, 0.06),
  body    : rgb(0.10, 0.10, 0.10),
  sub     : rgb(0.28, 0.35, 0.46),
  muted   : rgb(0.45, 0.54, 0.66),
  rule    : rgb(0.84, 0.89, 0.96),
  white   : rgb(1, 1, 1),
  bgPage  : rgb(0.98, 0.99, 1.00),

  // chip backgrounds & borders
  bgHave  : rgb(0.92, 0.97, 1.00),
  bdHave  : rgb(0.68, 0.84, 0.97),
  bgMiss  : rgb(1.00, 0.95, 0.87),
  bdMiss  : rgb(0.94, 0.71, 0.38),
  bgNice  : rgb(0.93, 0.98, 0.93),
  bdNice  : rgb(0.58, 0.84, 0.66),
  bgExtra : rgb(0.95, 0.96, 0.98),
  bdExtra : rgb(0.80, 0.85, 0.92),

  // table row stripes
  rowAlt  : rgb(0.96, 0.97, 1.00),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function wrap(str, font, size, maxW) {
  const words = String(str ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    let fits = true;
    try { fits = font.widthOfTextAtSize(next, size) <= maxW; } catch { /* ok */ }
    if (fits) { cur = next; } else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function tw(str, font, size) {
  try { return font.widthOfTextAtSize(String(str ?? ''), size); } catch { return 0; }
}

function stripBullet(str) {
  return String(str ?? '').replace(/^[\u2022\u2023\u25cf\u25aa\u2013\u2014\-\*>\s]+/, '').trim();
}

// ─── Cursor ───────────────────────────────────────────────────────────────────
// Single mutable object that tracks (page, y) and pages over automatically.
class Cursor {
  constructor(doc) {
    this.doc  = doc;
    this.page = null;
    this.y    = 0;
    this._newPage();
  }
  _newPage() {
    this.page = this.doc.addPage([PW, PH]);
    // Subtle off-white background
    this.page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: C.bgPage });
    this.y = BODY_TOP;
  }
  /** Ensure at least `need` pt before bottom margin; add page if not. */
  need(need) { if (this.y - need < B + 4) this._newPage(); }
  /** Move cursor down. */
  gap(n) { this.y -= n; }
}

// ─── Drawing primitives ───────────────────────────────────────────────────────

/** Draws a wrapped paragraph; advances cursor; returns total height used. */
function drawPara(cur, text, font, size, color, x = L, maxW = CW) {
  const lines = wrap(text, font, size, maxW);
  const lh    = size <= 8 ? LH.label : LH.body;
  for (const line of lines) {
    cur.need(size + 4);
    cur.page.drawText(line, { x, y: cur.y, size, font, color });
    cur.y -= lh;
  }
  return lines.length * lh;
}

/**
 * Section heading: gap → full-width rule → accent bar + LABEL
 * Returns nothing; advances cursor.
 */
function drawSection(cur, label, bold, color = C.navy) {
  cur.need(40);
  cur.gap(SEC_BEFORE);

  // Full-width thin rule
  cur.page.drawLine({
    start: { x: L, y: cur.y },
    end:   { x: PW - R, y: cur.y },
    thickness: 0.5,
    color: C.rule,
  });
  cur.gap(7);

  // 3 pt accent bar aligned with label baseline
  cur.page.drawRectangle({ x: L, y: cur.y - 1, width: 3, height: T.label + 2, color });

  // Label text
  cur.page.drawText(label.toUpperCase(), {
    x: L + 10,
    y: cur.y,
    size: T.label,
    font: bold,
    color,
    characterSpacing: 0.8,
  });
  cur.gap(T.label + SEC_AFTER);
}

/**
 * Sub-label above a chip group.
 * Pattern: small CAPS label, 4 pt gap, then chip row(s).
 */
function drawChipGroup(cur, groupLabel, items, reg, bold, bg, bd, textColor) {
  if (!items.length) return;
  cur.need(LH.chip + LH.label + 16);

  cur.page.drawText(groupLabel, { x: L, y: cur.y, size: T.label - 0.5, font: bold, color: textColor });
  cur.gap(LH.label);

  // Chips
  const PX = 9, PY = 4;
  const chipH = T.chip + PY * 2;
  const GAP_X = 5, GAP_Y = 6;
  let x = L;

  cur.need(chipH + GAP_Y + 4);
  for (const item of items) {
    const lbl = String(item ?? '');
    const cw  = tw(lbl, reg, T.chip) + PX * 2;
    if (x + cw > PW - R) {
      x = L;
      cur.y -= chipH + GAP_Y;
      cur.need(chipH + 4);
    }
    // Capsule
    cur.page.drawRectangle({
      x, y: cur.y - PY,
      width: cw, height: chipH,
      color: bg, borderColor: bd, borderWidth: 0.7,
      borderOpacity: 1, opacity: 1,
    });
    cur.page.drawText(lbl, {
      x: x + PX,
      y: cur.y + PY - 2,
      size: T.chip, font: reg, color: textColor,
    });
    x += cw + GAP_X;
  }
  cur.y -= chipH + GAP_Y + 8;  // consistent 8 pt below last chip row
}

/**
 * Single experience bullet (either AI-improved or original).
 * Indent: 20 pt.  Dot at L+2.
 */
function drawBullet(cur, text, reg, bold, improved) {
  const txt = stripBullet(text);
  if (!txt) return;

  cur.need(LH.body + 8);

  const dotColor = improved ? C.green : C.muted;
  const dot      = improved ? '+'     : '-';
  cur.page.drawText(dot, { x: L + 2, y: cur.y, size: 9, font: bold, color: dotColor });

  const lines = wrap(txt, reg, T.body, CW - 20);
  for (const line of lines) {
    cur.need(LH.body);
    cur.page.drawText(line, { x: L + 20, y: cur.y, size: T.body, font: reg, color: C.body });
    cur.y -= LH.body;
  }
  cur.gap(5);
}

/**
 * Numbered suggestion item.
 * Badge at left margin; text indented 28 pt from L.
 */
function drawSuggestion(cur, num, text, reg, bold) {
  const txt = String(text ?? '').trim();
  if (!txt) return;

  const BADGE_W = 18, BADGE_H = 14;
  const TEXT_X  = L + BADGE_W + 8;
  const TEXT_W  = CW - BADGE_W - 8;

  const lines    = wrap(txt, reg, T.body, TEXT_W);
  const blockH   = lines.length * LH.body + 4;

  cur.need(blockH + 8);

  // Badge (vertically centred on first text line)
  const badgeY = cur.y - BADGE_H + 3;
  cur.page.drawRectangle({ x: L, y: badgeY, width: BADGE_W, height: BADGE_H, color: C.blue });
  const numStr = String(num);
  cur.page.drawText(numStr, {
    x: L + BADGE_W / 2 - tw(numStr, bold, 7.5) / 2,
    y: badgeY + 3,
    size: 7.5, font: bold, color: C.white,
  });

  // Text lines
  for (const line of lines) {
    cur.need(LH.body);
    cur.page.drawText(line, { x: TEXT_X, y: cur.y, size: T.body, font: reg, color: C.body });
    cur.y -= LH.body;
  }
  cur.gap(8);
}

/**
 * Two-column skill gap table.
 */
function drawGapTable(cur, missingSkills, reg, bold) {
  const ROW_H = 17;
  const COL2  = L + CW * 0.48;

  const actions = {
    docker:     'Complete Docker Getting Started + deploy a project',
    kubernetes: 'Deploy a toy app with minikube',
    aws:        'Earn AWS Cloud Practitioner (free tier)',
    gcp:        'Complete Google Cloud Fundamentals course',
    azure:      'Complete AZ-900 Azure Fundamentals',
    typescript: 'Convert a JS project to TS, add to resume',
    graphql:    'Build a GraphQL API in a side project',
    python:     'Publish a Python script/API to GitHub',
    react:      'Build & deploy a React app to GitHub Pages',
    'node.js':  'Build a REST API with Express',
    jest:       'Add unit tests to an existing JS project',
    cypress:    'Add E2E tests + document coverage',
    terraform:  'Provision cloud infra with Terraform',
    'ci/cd':    'Set up a GitHub Actions pipeline',
    _default:   'Build a project, add to portfolio & resume',
  };

  // Table header
  cur.need(ROW_H + 4);
  const hdrY = cur.y - ROW_H + 4;
  cur.page.drawRectangle({ x: L, y: hdrY, width: CW, height: ROW_H, color: C.navy });
  cur.page.drawText('Missing skill',  { x: L + 8,     y: hdrY + 5, size: T.label, font: bold, color: C.white });
  cur.page.drawText('Recommended action', { x: COL2 + 8, y: hdrY + 5, size: T.label, font: bold, color: C.white });
  cur.y -= ROW_H + 2;

  for (let i = 0; i < missingSkills.length; i++) {
    const skill  = String(missingSkills[i] ?? '');
    const action = actions[skill.toLowerCase()] || actions._default;

    // Wrap action text to measure real row height
    const actionLines = wrap(action, reg, T.label, CW - CW * 0.48 - 14);
    const rowH = Math.max(ROW_H, actionLines.length * LH.label + 8);

    cur.need(rowH + 2);
    const rowY = cur.y - rowH + 4;

    // Row background
    cur.page.drawRectangle({ x: L, y: rowY, width: CW, height: rowH, color: i % 2 === 0 ? C.white : C.rowAlt });

    // Column divider
    cur.page.drawLine({ start: { x: COL2, y: rowY }, end: { x: COL2, y: rowY + rowH }, thickness: 0.4, color: C.rule });

    // Outer border
    cur.page.drawRectangle({ x: L, y: rowY, width: CW, height: rowH, color: rgb(0,0,0), opacity: 0, borderColor: C.rule, borderWidth: 0.4, borderOpacity: 1 });

    // Cell content — vertically centred
    const textBaseY = rowY + rowH / 2 + T.label / 2 - 1;
    cur.page.drawText(skill, { x: L + 8, y: textBaseY, size: T.body - 0.5, font: bold, color: C.amber });

    // Multi-line action
    const startY = rowY + rowH - LH.label - 3;
    for (let li = 0; li < actionLines.length; li++) {
      cur.page.drawText(actionLines[li], { x: COL2 + 8, y: startY - li * LH.label, size: T.label, font: reg, color: C.body });
    }

    cur.y -= rowH + 2;
  }
  cur.gap(4);
}

// ─── Score bar ────────────────────────────────────────────────────────────────
function drawScoreBar(cur, score, reg, bold) {
  const BAR_H = 7;
  const pct   = Math.min(1, Math.max(0, score / 100));
  const fill  = score >= 75 ? C.green : score >= 45 ? C.amber : C.red;
  const label = String(score) + ' / 100';
  const tone  = score >= 75 ? 'Strong Match' : score >= 45 ? 'Partial Match' : 'Low Match';

  cur.need(BAR_H + LH.label + 12);

  // Track
  cur.page.drawRectangle({ x: L, y: cur.y - BAR_H, width: CW, height: BAR_H, color: rgb(0.86, 0.90, 0.96) });
  // Fill
  if (pct > 0) cur.page.drawRectangle({ x: L, y: cur.y - BAR_H, width: CW * pct, height: BAR_H, color: fill });
  cur.y -= BAR_H + 5;

  // Score label left, tone right
  cur.page.drawText(label, { x: L,                                                   y: cur.y, size: T.label, font: bold, color: fill });
  cur.page.drawText(tone,  { x: PW - R - tw(tone, reg, T.label), y: cur.y, size: T.label, font: reg,  color: C.muted });
  cur.y -= LH.label + 4;
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function drawFooters(doc, name, score, reg) {
  const total = doc.getPageCount();
  for (let i = 0; i < total; i++) {
    const p = doc.getPages()[i];
    p.drawLine({ start: { x: L, y: B - 10 }, end: { x: PW - R, y: B - 10 }, thickness: 0.4, color: C.rule });
    const left  = 'AI-Enhanced Resume  |  ' + name + (score !== null ? '  |  Match ' + score + '/100' : '');
    const right = 'Page ' + (i + 1) + ' of ' + total;
    p.drawText(left,  { x: L,                                              y: B - 22, size: T.tiny, font: reg, color: C.muted });
    p.drawText(right, { x: PW - R - tw(right, reg, T.tiny), y: B - 22, size: T.tiny, font: reg, color: C.muted });
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────
/**
 * @param {object} data
 *   candidateName, score, matchRatio, experienceYears,
 *   summary, matchedSkills, missingSkills, niceToHave, resumeSkills,
 *   workExperience, rewrittenBullets, suggestions
 * @returns {Promise<Blob>}
 */
export async function updateResumePdf(data = {}) {
  const {
    candidateName    = 'Candidate',
    score            = null,
    matchRatio       = '',
    experienceYears  = 0,
    summary          = '',
    matchedSkills    = [],
    missingSkills    = [],
    niceToHave       = [],
    resumeSkills     = [],
    workExperience   = [],
    rewrittenBullets = [],
    suggestions      = [],
  } = data;

  const doc  = await PDFDocument.create();
  const reg  = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const cur  = new Cursor(doc);
  const name = String(candidateName || 'Candidate');

  // ── HEADER ────────────────────────────────────────────────────────────────
  // Dark full-width band on page 1 (drawn directly on page, not via cursor)
  cur.page.drawRectangle({ x: 0, y: PH - HDR_H, width: PW, height: HDR_H, color: C.navy });

  // Name
  cur.page.drawText(name, { x: L, y: PH - 30, size: T.name, font: bold, color: C.white });

  // Sub-line: years + ratio
  const meta = [
    experienceYears ? experienceYears + ' yrs experience' : null,
    matchRatio      ? matchRatio + ' skills matched'      : null,
  ].filter(Boolean).join('   |   ');
  if (meta) cur.page.drawText(meta, { x: L, y: PH - 48, size: T.label, font: reg, color: rgb(0.62, 0.78, 0.94) });

  // "AI-Enhanced Resume" label
  cur.page.drawText('AI-Enhanced Resume', { x: L, y: PH - 63, size: T.tiny, font: reg, color: rgb(0.46, 0.60, 0.78) });

  // Score badge (right side of header)
  if (score !== null) {
    const sl   = String(score) + '/100';
    const tone = score >= 75 ? 'Strong Match' : score >= 45 ? 'Partial Match' : 'Low Match';
    const tc   = score >= 75 ? rgb(0.20, 0.88, 0.56) : score >= 45 ? rgb(1.00, 0.75, 0.28) : rgb(0.98, 0.48, 0.48);
    const BW = 78, BH = 52, BX = PW - R - BW, BY = PH - HDR_H + 16;

    cur.page.drawRectangle({ x: BX, y: BY, width: BW, height: BH, color: C.white, opacity: 0.08 });
    cur.page.drawLine({ start: { x: BX, y: BY }, end: { x: BX, y: BY + BH }, thickness: 1, color: rgb(1,1,1), opacity: 0.12 });

    cur.page.drawText(sl,   { x: BX + BW / 2 - tw(sl,   bold, 18) / 2, y: BY + 30, size: 18, font: bold, color: C.white });
    cur.page.drawText(tone, { x: BX + BW / 2 - tw(tone, reg, T.tiny) / 2, y: BY + 14, size: T.tiny, font: reg, color: tc });
  }

  // Teal accent stripe at bottom of header
  cur.page.drawRectangle({ x: 0, y: PH - HDR_H - 3, width: PW, height: 3, color: C.teal });

  // ── SCORE BAR ─────────────────────────────────────────────────────────────
  if (score !== null) {
    cur.gap(16);
    drawScoreBar(cur, score, reg, bold);
    cur.gap(4);
  }

  // ── PROFESSIONAL SUMMARY ──────────────────────────────────────────────────
  if (summary) {
    drawSection(cur, 'Professional Summary', bold);
    drawPara(cur, summary, reg, T.body, C.sub);
    cur.gap(4);
  }

  // ── SKILLS ────────────────────────────────────────────────────────────────
  const hasSkills = matchedSkills.length || missingSkills.length || niceToHave.length || resumeSkills.length;
  if (hasSkills) {
    drawSection(cur, 'Skills', bold);

    if (matchedSkills.length) {
      drawChipGroup(cur, 'Matched  (you already have these)', matchedSkills, reg, bold, C.bgHave, C.bdHave, C.blue);
    }
    if (missingSkills.length) {
      drawChipGroup(cur, 'Missing required skills  -  add these to your resume', missingSkills, reg, bold, C.bgMiss, C.bdMiss, C.amber);
    }
    if (niceToHave.length) {
      drawChipGroup(cur, 'Nice to have', niceToHave, reg, bold, C.bgNice, C.bdNice, C.green);
    }

    const matchedSet  = new Set(matchedSkills.map(s => String(s).toLowerCase()));
    const extraSkills = resumeSkills.filter(s => !matchedSet.has(String(s).toLowerCase()));
    if (extraSkills.length) {
      drawChipGroup(cur, 'Other skills on your resume', extraSkills, reg, bold, C.bgExtra, C.bdExtra, C.muted);
    }
  }

  // ── PROFESSIONAL EXPERIENCE ───────────────────────────────────────────────
  const expBullets = rewrittenBullets.length ? rewrittenBullets : workExperience;
  const improved   = rewrittenBullets.length > 0;

  if (expBullets.length) {
    drawSection(cur, 'Professional Experience', bold);

    if (improved) {
      cur.need(20);
      cur.page.drawRectangle({ x: L, y: cur.y - 13, width: CW, height: 18, color: rgb(0.91, 0.98, 0.94) });
      cur.page.drawText('Bullets have been rewritten by AI — ATS-optimised, impact-focused, keyword-aligned', {
        x: L + 8, y: cur.y - 3, size: T.tiny, font: reg, color: C.green,
      });
      cur.gap(20);
    }

    for (const b of expBullets) {
      drawBullet(cur, b, reg, bold, improved);
    }
  }

  // ── IMPROVEMENT PLAN ─────────────────────────────────────────────────────
  if (suggestions.length) {
    drawSection(cur, 'Improvement Plan', bold, C.blue);
    for (let i = 0; i < suggestions.length; i++) {
      drawSuggestion(cur, i + 1, suggestions[i], reg, bold);
    }
  }

  // ── SKILL GAP REFERENCE TABLE ────────────────────────────────────────────
  if (missingSkills.length) {
    drawSection(cur, 'Skill Gap Reference', bold, C.red);
    drawGapTable(cur, missingSkills, reg, bold);
  }

  // ── FOOTERS ───────────────────────────────────────────────────────────────
  drawFooters(doc, name, score, reg);

  const bytes = await doc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}
