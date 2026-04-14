const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { randomUUID } = require('crypto');
const { runPipeline } = require('../agents/orchestrator');
const { createRequestLogger } = require('../utils/logger');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function normalizeText(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}

function textFromLegacyDoc(buffer) {
  return String(buffer || '')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function extractResumeText(file, resumeText) {
  const pastedText = normalizeText(resumeText);
  if (!file) {
    return pastedText;
  }

  const fileName = String(file.originalname || '').toLowerCase();
  const mimeType = String(file.mimetype || '').toLowerCase();

  let extractedText = '';

  if (mimeType.includes('pdf') || fileName.endsWith('.pdf')) {
    const pdfData = await pdfParse(file.buffer);
    extractedText = normalizeText(pdfData.text);
  } else if (mimeType.includes('wordprocessingml') || fileName.endsWith('.docx')) {
    const docxData = await mammoth.extractRawText({ buffer: file.buffer });
    extractedText = normalizeText(docxData.value);
  } else if (mimeType.includes('msword') || fileName.endsWith('.doc')) {
    extractedText = textFromLegacyDoc(file.buffer);
  } else {
    throw new Error('Unsupported file type. Please upload PDF, DOC, or DOCX.');
  }

  return normalizeText([extractedText, pastedText].filter(Boolean).join('\n\n'));
}

router.post('/', upload.single('resume'), async (req, res) => {
  const requestId = randomUUID().slice(0, 8);
  const log = createRequestLogger(requestId);

  try {
    log('Incoming /analyze request received', {
      hasFile: Boolean(req.file),
      fileName: req.file?.originalname || '',
      mimeType: req.file?.mimetype || '',
    });

    const resumeText = await extractResumeText(req.file, req.body.resumeText || '');
    const jobDescription = normalizeText(req.body.jobDescription || '');

    log('Input extraction completed', {
      resumeLength: resumeText.length,
      jobDescriptionLength: jobDescription.length,
    });

    if (!resumeText || !jobDescription) {
      log('Validation failed: missing resume or job description');
      return res.status(400).json({ error: 'Resume and job description are required' });
    }

    const result = await runPipeline(resumeText, jobDescription, { log, requestId });
    log('Sending successful response');
    return res.json({ success: true, result, requestId });

  } catch (err) {
    log('Request failed', { message: err.message });
    console.error(err);
    return res.status(500).json({ error: 'Analysis failed', details: err.message, requestId });
  }
});

module.exports = router;