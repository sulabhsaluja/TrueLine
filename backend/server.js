'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const pino = require('pino');
const { z } = require('zod');
const { runPipeline } = require('./src/index');
const { generateAiSummary } = require('./src/report/aiSummary');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const filesSchema = z.object({
  bank: z.array(z.object({ path: z.string() })).min(1, 'bank.csv is required'),
  ledger: z.array(z.object({ path: z.string() })).min(1, 'ledger.csv is required'),
  gateway: z.array(z.object({ path: z.string() })).min(1, 'gateway.csv is required')
}).refine(data => {
  // Ensure we actually have the files object (multer might set req.files to empty object or undefined)
  return data && data.bank && data.ledger && data.gateway;
}, "Missing required files");

const app = express();
app.use(cors());
app.use(express.json());

// Set up temporary upload root
const TMP_DIR = path.resolve(__dirname, 'tmp', 'uploads');
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

// Ensure data directory exists so we can verify we never write there
const DATA_DIR = path.resolve(__dirname, 'data');

// Multer storage: save exactly into a unique sub-directory per request
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // We attach the reqId in the route handler, but multer runs first.
    // So we generate a reqId if not present.
    if (!req.reqId) {
      req.reqId = crypto.randomUUID();
      req.uploadDir = path.join(TMP_DIR, req.reqId);
      fs.mkdirSync(req.uploadDir, { recursive: true });
    }
    cb(null, req.uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '.csv'); // save as bank.csv, ledger.csv, gateway.csv
  }
});

const upload = multer({ storage });
const uploadFields = upload.fields([
  { name: 'bank', maxCount: 1 },
  { name: 'ledger', maxCount: 1 },
  { name: 'gateway', maxCount: 1 }
]);

app.post('/api/reconcile', uploadFields, async (req, res) => {
  const reqId = req.reqId;
  const uploadDir = req.uploadDir;

  try {
    logger.info({ reqId }, 'Received reconciliation request');
    
    try {
      filesSchema.parse(req.files || {});
    } catch (validationError) {
      logger.warn({ reqId, errors: validationError.errors }, 'Invalid file upload payload');
      return res.status(400).json({ error: 'Missing required files: bank, ledger, and gateway CSVs are all required.' });
    }

    const bankPath = req.files.bank[0].path;
    const ledgerPath = req.files.ledger[0].path;
    const gatewayPath = req.files.gateway[0].path;

    // Safety checks: ensure we are not writing to data/ directory
    if (bankPath.startsWith(DATA_DIR) || ledgerPath.startsWith(DATA_DIR) || gatewayPath.startsWith(DATA_DIR)) {
      throw new Error("Security Violation: Attempted to read from data directory.");
    }

    const result = runPipeline({
      bankPath,
      ledgerPath,
      gatewayPath
    });

    // Enrich summary with submitted vs ingested counts to prevent silent drops at API boundary
    const submittedCount = result.ingest.summary.total_ok + result.ingest.summary.total_skipped;
    result.summary.source_volume.total_submitted = submittedCount;
    result.summary.source_volume.total_skipped = result.ingest.summary.total_skipped;

    logger.info({ 
      reqId, 
      matchRate: result.summary.match_rate.percentage,
      exceptions: result.summary.match_rate.total_classified - result.summary.match_rate.matched 
    }, 'Reconciliation complete');

    let aiNarrative = null;
    let aiNarrativeError = null;

    try {
      logger.info({ reqId }, 'Requesting AI summary');
      aiNarrative = await generateAiSummary(result.summary);
      logger.info({ reqId }, 'AI summary generated successfully');
    } catch (aiErr) {
      logger.warn({ reqId, err: aiErr.message }, 'AI summary generation failed (non-fatal)');
      aiNarrativeError = aiErr.message || 'AI generation failed';
    }

    res.status(200).json({
      summary: result.summary,
      auditTrail: result.auditTrail,
      ingestionWarnings: result.ingest.skipped,
      aiNarrative,
      aiNarrativeError
    });

  } catch (error) {
    if (error.name === 'NormalizationError' || error.message.includes('NormalizationError')) {
      // Input validation error
      res.status(400).json({ error: error.message });
    } else {
      // Internal pipeline error / bugs / integrity guardrails
      logger.error({ reqId, err: error }, 'Internal reconciliation error');
      res.status(500).json({ error: 'internal reconciliation error' });
    }
  } finally {
    // Cleanup temporary directory for this specific request
    if (uploadDir && fs.existsSync(uploadDir)) {
      fs.rm(uploadDir, { recursive: true, force: true }, (err) => {
        if (err) logger.error({ reqId, uploadDir, err }, 'Failed to cleanup temp dir');
      });
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info({ port: PORT }, `Express API running`);
});
