# Gemini Expert RAG Agent

A full-stack Retrieval-Augmented Generation (RAG) system built with the latest Gemini 1.5 Pro/Flash models, LangChain JS, and a premium React interface.

## 🚀 Quick Start

Due to environment restrictions, please follow these steps to manually initialize and run the application.

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [MongoDB](https://www.mongodb.com/) (Local or Atlas)
- [Chroma DB](https://docs.trychroma.com/getting-started) (Running locally)
- [Google Gemini API Key](https://aistudio.google.com/app/apikey)

---

### Step 1: Backend Setup
1. Open a terminal in `gemini-rag-agent/backend`.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Update `.env` with your credentials:
   - `GOOGLE_API_KEY`: Your Gemini key.
   - `MONGODB_URI`: Your MongoDB connection string.
4. Start the server:
   ```bash
   npm run start
   ```

---

### Step 2: Frontend Setup
1. Open a new terminal in `gemini-rag-agent/frontend`.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser at `http://localhost:5173`.

---

## 🛠 Tech Stack
- **Frontend**: React (Vite), Axios, Lucide Icons, Vanilla CSS (Glassmorphism).
- **Backend**: Node.js, Express, Mongoose.
- **AI/LLM**: LangChain JS, Google Gemini 1.5.
- **Vector Search**: Chroma DB.

---

## 🧠 Features
- **Deterministic JSON Output**: Every response is structured with Answer, Explanation, and Expert Insights.
- **Cognitive Reasoning**: The agent explains its reasoning step-by-step based ONLY on the provided context.
- **Expert Thinking Mode**: Identifies inefficiencies and suggests actionable optimizations.
- **Persistent Memory**: Chat sessions are stored in MongoDB.
