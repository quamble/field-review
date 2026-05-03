const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, 
        HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType, PageBreak } = require('docx');

const app = express();

// ===== CONFIGURATION =====
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const REPORTS_DIR = path.join(__dirname, 'reports');

// Create directories if they don't exist
[UPLOAD_DIR, REPORTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files (PWA frontend)
app.use(express.static(path.join(__dirname, '.')));

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Multer configuration for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  }),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// ===== ENDPOINTS =====

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Generate Word document from project data
 * POST /api/generate-report
 * 
 * Request body:
 * {
 *   title: "Project Name",
 *   date: "2025-05-01",
 *   notes: "Additional notes...",
 *   items: [
 *     {
 *       photo: "base64_image_data",
 *       memo: "Voice memo text",
 *       timestamp: "2025-05-01T10:30:00Z"
 *     }
 *   ]
 * }
 */
app.post('/api/generate-report', async (req, res) => {
  try {
    const { title, date, notes, items } = req.body;

    if (!title || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Missing required fields: title, items' });
    }

    // Create document structure
    const sections = [{
      properties: {
        page: {
          size: {
            width: 12240,  // 8.5 inches (US Letter)
            height: 15840 // 11 inches
          },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } // 1 inch margins
        }
      },
      children: buildDocumentContent(title, date, notes, items)
    }];

    const doc = new Document({ sections });
    const buffer = await Packer.toBuffer(doc);

    // Generate filename
    const filename = `${title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.docx`;
    const filepath = path.join(REPORTS_DIR, filename);

    // Save file
    fs.writeFileSync(filepath, buffer);

    // Return file as download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);

    console.log(`✓ Report generated: ${filename}`);
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Failed to generate report', details: error.message });
  }
});

/**
 * Transcribe audio using OpenAI Whisper API
 * POST /api/transcribe
 * 
 * Multipart form with audio file
 * Optional: language (ISO-639-1 code, e.g., 'en', 'es', 'fr')
 */
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const language = req.body.language || 'en';
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.warn('Warning: OPENAI_API_KEY not set. Using fallback transcription.');
      return res.json({ 
        transcription: '[Transcription unavailable - API key not configured. Enable in .env]',
        warning: 'OpenAI API key not configured'
      });
    }

    // Read audio file
    const audioBuffer = fs.readFileSync(req.file.path);

    // Send to OpenAI Whisper API
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: req.file.mimetype }), req.file.originalname);
    formData.append('model', 'whisper-1');
    formData.append('language', language);

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      transcription: response.data.text,
      language,
      confidence: response.data.confidence || null
    });

    console.log(`✓ Audio transcribed (${req.file.size} bytes)`);
  } catch (error) {
    // Clean up on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error('Transcription error:', error.message);
    
    // Check if it's an API key issue
    if (error.response?.status === 401) {
      return res.status(401).json({ 
        error: 'Invalid OpenAI API key',
        details: 'Check your OPENAI_API_KEY environment variable'
      });
    }

    res.status(500).json({ 
      error: 'Transcription failed',
      details: error.message 
    });
  }
});

/**
 * List available reports
 * GET /api/reports
 */
app.get('/api/reports', (req, res) => {
  try {
    const files = fs.readdirSync(REPORTS_DIR)
      .filter(f => f.endsWith('.docx'))
      .map(f => ({
        filename: f,
        path: f,
        created: fs.statSync(path.join(REPORTS_DIR, f)).birthtimeMs
      }))
      .sort((a, b) => b.created - a.created);

    res.json({ reports: files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Download a report
 * GET /api/reports/:filename
 */
app.get('/api/reports/:filename', (req, res) => {
  try {
    const filepath = path.join(REPORTS_DIR, req.params.filename);

    // Security: prevent directory traversal
    if (!filepath.startsWith(REPORTS_DIR)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
    res.sendFile(filepath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Test Google Drive integration (requires OAuth setup)
 * POST /api/drive/upload
 * 
 * Body: { filename, mimeType, fileContent }
 */
app.post('/api/drive/upload', async (req, res) => {
  try {
    const { filename, mimeType, accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ 
        error: 'No access token',
        message: 'Google Drive integration requires OAuth authentication'
      });
    }

    // This is a placeholder - actual implementation requires Google Drive API client library
    res.json({
      message: 'Google Drive upload requires additional setup',
      driveId: null,
      link: null,
      status: 'not_configured'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== UTILITY FUNCTIONS =====

/**
 * Build document content
 */
function buildDocumentContent(title, date, notes, items) {
  const children = [];
  const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
  const borders = { top: border, bottom: border, left: border, right: border };

  // Title
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: title, bold: true, size: 32 })],
      spacing: { after: 240 }
    })
  );

  // Date and metadata
  if (date) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `Date: ${date}`, size: 22, italics: true })],
        spacing: { after: 120 },
        color: '666666'
      })
    );
  }

  children.push(
    new Paragraph({
      children: [new TextRun({ text: `Generated: ${new Date().toLocaleString()}`, size: 20, italics: true })],
      spacing: { after: 240 },
      color: '999999'
    })
  );

  // Notes section
  if (notes && notes.trim()) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun('Notes')],
        spacing: { before: 240, after: 120 }
      }),
      new Paragraph({
        children: [new TextRun(notes)],
        spacing: { after: 240 }
      })
    );
  }

  // Items section
  if (items && items.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun(`Photos & Memos (${items.length} items)`)],
        spacing: { before: 240, after: 240 }
      })
    );

    items.forEach((item, idx) => {
      // Item heading
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [new TextRun(`Item ${idx + 1}`)],
          spacing: { before: 240, after: 120 }
        })
      );

      // Photo
      if (item.photo) {
        try {
          // Handle both base64 and URL formats
          let imageData = item.photo;
          if (imageData.startsWith('data:')) {
            imageData = imageData.split(',')[1]; // Extract base64
          }

          children.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: Buffer.from(imageData, 'base64'),
                  transformation: {
                    width: 500,
                    height: 400
                  },
                  type: 'jpeg'
                })
              ],
              spacing: { after: 120 }
            })
          );
        } catch (err) {
          console.warn(`Could not embed image ${idx + 1}:`, err.message);
          children.push(
            new Paragraph({
              children: [new TextRun('[Image data unavailable]')],
              spacing: { after: 120 },
              color: 'CC0000'
            })
          );
        }
      }

      // Memo/Transcription
      if (item.memo) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: 'Notes: ', bold: true }), new TextRun(item.memo)],
            spacing: { after: 240 },
            indent: { left: 720 }
          })
        );
      }

      // Timestamp
      if (item.timestamp) {
        const ts = new Date(item.timestamp).toLocaleString();
        children.push(
          new Paragraph({
            children: [new TextRun({ text: ts, size: 20, italics: true })],
            spacing: { after: 240 },
            color: '999999'
          })
        );
      }

      // Page break between items (except last)
      if (idx < items.length - 1) {
        children.push(new Paragraph({ children: [new TextRun('')], pageBreakBefore: true }));
      }
    });
  }

  return children;
}

// ===== START SERVER =====
const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                  Field Review API Server                   ║
╠════════════════════════════════════════════════════════════╣
║ Server running at http://localhost:${PORT}                    ║
║                                                            ║
║ Endpoints:                                                 ║
║   POST   /api/generate-report   → Word document generation ║
║   POST   /api/transcribe        → Audio transcription      ║
║   GET    /api/reports           → List saved reports       ║
║   GET    /api/reports/:filename → Download report          ║
║                                                            ║
║ Setup:                                                     ║
║   npm install                                              ║
║   OPENAI_API_KEY=sk-... node server.js                     ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => process.exit(0));
});
