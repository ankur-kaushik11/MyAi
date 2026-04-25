const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const DOCS_DIR = path.join(__dirname, 'documents');
if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR);

const mongoose = require('mongoose');
// Model will be accessed inside functions to avoid initialization races
// const Knowledge = mongoose.model('Knowledge');

async function findRelevantChunks(query, userId) {
    const Knowledge = mongoose.model('Knowledge');
    
    const words = query.split(/\W+/).filter(w => w.length > 3);
    const searchRegex = words.length > 0 ? new RegExp(words.join('|'), 'i') : /.*/i;

    // CRITICAL: Filter by userId to ensure data isolation (ACID prop)
    let matches = await Knowledge.find({ 
        userId, 
        $text: { $search: query } 
    }).limit(10);

    if (matches.length === 0) {
        matches = await Knowledge.find({ 
            userId, 
            content: { $regex: searchRegex } 
        }).limit(10);
    }

    if (matches.length === 0) return null;

    return matches.map(m => `[SOURCE: ${m.filename}]\n${m.content}`).join("\n---\n");
}

async function runAgent(query, history = [], domainContext = "Expert Assistant", userId) {
    try {
        const context = await findRelevantChunks(query, userId);

        const prompt = `### YOUR IDENTITY: You are an Elite Personal Assistant for a ${domainContext}.

KNOWLEDGE SOURCE:
- Use the CONTEXT below for any specific details, facts, or technical answers.
- If the CONTEXT is missing, you can still chat professionally, explain your role, or refer to previous parts of this conversation.
- STRICT RULE: Do NOT use data from any other users. Your current knowledge base belongs only to the current user.

CONTEXT FROM USER DOCUMENTS:
${context || "No specific matches found in the user's private files."}

USER QUERY:
${query}

MISSION:
- If there is NO context (empty), act like a helpful general-purpose AI but politely remind the user to upload files for 'Expert' insights.
- If there IS context, be the elite ${domainContext}.

INSTRUCTIONS (JSON):
{
  "answer": "Markdown response",
  "explanation": "Logic: Persona=${domainContext}",
  "insights": []
}`;

        const modelName = process.env.OPENAI_MODEL || "gpt-4o-mini";
        
        const formattedHistory = history.map(h => {
            let content = h.content;
            try {
                const parsed = JSON.parse(h.content);
                const extracted = parsed.answer || h.content;
                content = typeof extracted === 'object' ? JSON.stringify(extracted) : String(extracted);
            } catch (e) {
                content = String(h.content);
            }
            return {
                role: h.role === 'assistant' ? 'assistant' : 'user',
                content: content
            };
        }).slice(-6);

        const result = await openai.chat.completions.create({
            model: modelName,
            messages: [
                { role: "system", content: `You are MyAi, a proactive PA for a ${domainContext}.` },
                ...formattedHistory,
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
        });

        return JSON.parse(result.choices[0].message.content);
    } catch (error) {
        console.error("Agent Error:", error.message);
        return { answer: "Cognitive Processing Error", explanation: error.message, insights: [] };
    }
}

async function ingestDocument(text, filename, userId) {
    const Knowledge = mongoose.model('Knowledge');
    try {
        if (!text || text.trim().length === 0) throw new Error("No text extracted.");
        
        const chunkSize = 2000;
        const chunks = [];
        for (let i = 0; i < text.length; i += chunkSize) {
            chunks.push(text.slice(i, i + chunkSize + 200));
        }

        // Save chunks to MongoDB with userId for isolation
        for (const chunkContent of chunks) {
            await Knowledge.create({
                userId: userId,
                filename: filename,
                content: chunkContent,
                type: path.extname(filename)
            });
        }

        return { success: true, message: `Indexed into your private brain` };
    } catch (err) {
        console.error("Ingestion failed:", err);
        throw err;
    }
}

module.exports = { runAgent, ingestDocument };

module.exports = { runAgent, ingestDocument };
