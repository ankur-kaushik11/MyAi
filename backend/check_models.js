const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function checkModels() {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    try {
        // We use a different approach since listModels isn't always direct in the basic SDK
        // We'll try a few highly likely ones and see which one doesn't 404
        const models = ["text-embedding-004", "embedding-001", "models/text-embedding-004", "models/embedding-001"];
        
        console.log("Checking model availability...");
        for (const m of models) {
            try {
                const model = genAI.getGenerativeModel({ model: m }, { apiVersion: 'v1' });
                await model.embedContent("test");
                console.log(`✅ VALID MODEL FOUND: ${m}`);
            } catch (e) {
                console.log(`❌ ${m}: ${e.message.split('\n')[0]}`);
            }
        }
    } catch (err) {
        console.error("General error:", err.message);
    }
}

checkModels();
