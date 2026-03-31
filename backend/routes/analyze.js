const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { runPipeline } = require('../agents/orchestrator');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('resume'), async (req, res) => {
  try {
    let resumeText = '';

    if (req.file) {
      const pdfData = await pdfParse(req.file.buffer);
      resumeText = pdfData.text;
    } else {
      resumeText = req.body.resumeText || '';
    }

    const jobDescription = req.body.jobDescription || '';

    if (!resumeText || !jobDescription) {
      return res.status(400).json({ error: 'Resume and job description are required' });
    }

    const result = await runPipeline(resumeText, jobDescription);
    res.json({ success: true, result });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Analysis failed', details: err.message });
  }
});

module.exports = router;