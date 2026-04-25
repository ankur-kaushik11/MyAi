const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'myai-super-secret-key-2026';
const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const PORT = process.env.PORT || 5000;

let runAgent, ingestDocument;

// Global Error Handlers for Debugging
process.on('uncaughtException', (err) => {
    console.error('🔥 Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 Unhandled Rejection at:', promise, 'reason:', reason);
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// --- SCHEMAS ---

const userSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    persona: { type: String, default: 'Senior Software Engineer' },
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const messageSchema = new mongoose.Schema({
    role: String,
    content: String,
    timestamp: { type: Date, default: Date.now }
});

const sessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    sessionId: { type: String, index: true },
    title: { type: String, default: 'New Conversation' },
    messages: [messageSchema]
});
const Session = mongoose.model('Session', sessionSchema);

const knowledgeSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    filename: String,
    content: String,
    type: String
});
knowledgeSchema.index({ content: 'text' });
const Knowledge = mongoose.model('Knowledge', knowledgeSchema);

// Middleware for Auth
const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (e) {
        res.status(401).json({ error: 'Invalid Session' });
    }
};

// Now that Knowledge is registered, we can safely require the agent
const agent = require('./agent');
runAgent = agent.runAgent;
ingestDocument = agent.ingestDocument;

// --- ROUTES ---

// 1. Ingestion Route (PDF to Vector Store)
let pdfjs;
try {
    pdfjs = require('pdfjs-dist');
} catch (e) {
    pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
}

const mammoth = require('mammoth');
const XLSX = require('xlsx');

// Helper to extract text from various formats
async function extractText(buffer, originalname) {
    const ext = path.extname(originalname).toLowerCase();
    
    if (ext === '.pdf') {
        const data = new Uint8Array(buffer);
        const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true });
        const pdf = await loadingTask.promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map(item => item.str).join(" ") + "\n";
        }
        return fullText;
    } 
    
    if (ext === '.docx') {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
    }
    
    if (ext === '.xlsx' || ext === '.xls') {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        let fullText = "";
        workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            fullText += `\n--- Sheet: ${sheetName} ---\n`;
            fullText += XLSX.utils.sheet_to_csv(sheet);
        });
        return fullText;
    }

    if (ext === '.txt') {
        return buffer.toString('utf8');
    }

    throw new Error(`Unsupported file type: ${ext}`);
}

// --- AUTH ROUTES ---

app.post('/api/auth/signup', async (req, res) => {
    try {
        const { email, password, persona } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ email, password: hashedPassword, persona });
        const token = jwt.sign({ userId: user._id }, JWT_SECRET);
        res.json({ token, persona: user.persona });
    } catch (e) {
        res.status(400).json({ error: 'User already exists or invalid data' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ userId: user._id }, JWT_SECRET);
        res.json({ token, persona: user.persona });
    } catch (e) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// --- CORE ROUTES (Protected) ---

app.post('/api/ingest', authenticate, upload.array('files'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) return res.status(400).send('No files uploaded');
        
        console.log(`🚀 Multi-ingestion started for ${req.files.length} files by User: ${req.userId}`);
        
        const results = [];
        const failedFiles = [];
        
        for (const file of req.files) {
            try {
                const text = await extractText(file.buffer, file.originalname);
                if (!text || text.trim().length === 0) {
                    console.warn(`⚠️ Skipped empty file: ${file.originalname}`);
                    failedFiles.push({ name: file.originalname, reason: 'No text extracted' });
                    continue;
                }
                const result = await ingestDocument(text, file.originalname, req.userId);
                results.push(result);
            } catch (err) {
                console.error(`❌ Failed to process ${file.originalname}:`, err.message);
                failedFiles.push({ name: file.originalname, reason: err.message });
            }
        }
        
        res.json({ 
            success: true, 
            filesIndexed: results.length, 
            failed: failedFiles.length,
            errors: failedFiles 
        });
    } catch (error) {
        console.error('Ingestion Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/chat', authenticate, async (req, res) => {
    const { message, sessionId, domainContext } = req.body;

    try {
        let session = await Session.findOne({ sessionId, userId: req.userId });
        if (!session) {
            session = new Session({ sessionId, userId: req.userId, messages: [] });
        }

        const history = session.messages.map(m => ({
            role: m.role,
            content: m.content
        }));

        const agentResponse = await runAgent(message, history, domainContext, req.userId);

        session.messages.push({ role: 'user', content: message });
        session.messages.push({ role: 'assistant', content: JSON.stringify(agentResponse) });
        await session.save();

        res.json(agentResponse);
    } catch (error) {
        console.error('Agent Error:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

app.get('/api/history', authenticate, async (req, res) => {
    const sessions = await Session.find({ userId: req.userId }).sort({ updatedAt: -1 });
    res.json(sessions);
});

app.get('/api/history/:sessionId', authenticate, async (req, res) => {
    const session = await Session.findOne({ sessionId: req.params.sessionId, userId: req.userId });
    res.json(session ? session.messages : []);
});

app.get('/api/knowledge', authenticate, async (req, res) => {
    try {
        const files = await Knowledge.find({ userId: req.userId }).distinct('filename');
        const formattedFiles = files.map(filename => ({
            name: filename,
            size: 'Index Sync...', 
            date: 'Cloud Persistence'
        }));
        res.json(formattedFiles);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch knowledge index' });
    }
});

app.get('/api/knowledge/:filename', authenticate, async (req, res) => {
    try {
        const chunks = await Knowledge.find({ userId: req.userId, filename: req.params.filename });
        if (chunks.length === 0) return res.status(404).json({ error: 'File not found' });
        
        const fullText = chunks.map(c => c.content).join('\n\n');
        res.json({ filename: req.params.filename, content: fullText });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch file content' });
    }
});

app.delete('/api/knowledge/:filename', authenticate, async (req, res) => {
    try {
        await Knowledge.deleteMany({ userId: req.userId, filename: req.params.filename });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
