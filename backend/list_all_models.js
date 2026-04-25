const https = require('https');
require('dotenv').config();

const apiKey = process.env.GOOGLE_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;

console.log("Fetching allowed models for your key...");

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.models) {
                console.log("✅ AVAILABLE MODELS:");
                json.models.forEach(m => {
                    if (m.supportedGenerationMethods.includes('embedContent')) {
                        console.log(`- ${m.name} (SUPPORTED)`);
                    } else {
                        console.log(`- ${m.name}`);
                    }
                });
            } else {
                console.log("❌ No models found or error:", JSON.stringify(json, null, 2));
            }
        } catch (e) {
            console.log("❌ Failed to parse response:", data);
        }
    });
}).on("error", (err) => {
    console.log("Error: " + err.message);
});
