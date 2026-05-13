# Agentic ResumeIQ — Backend

Backend for the Agentic ResumeIQ application, built with **Node.js + Express** and a 3-agent LangChain pipeline. Uses **Ollama (Llama 3.2:1b)** by default, with optional **Groq API (Llama 3.1:8b)** support.

---

## 🛠 Tech Stack

- Node.js + Express 5
- LangChain (`langchain`, `@langchain/core`, `@langchain/community`)
- Ollama — local LLM inference (default)
- Groq API — optional cloud LLM (one-line swap)
- Server-Sent Events (SSE) for real-time status streaming

---

## 📁 Folder Structure

```
backend/
├── agents/
│   ├── parserAgent.js       # Extracts structured data from resume + JD
│   ├── matchingAgent.js     # Scores resume against job requirements
│   ├── feedbackAgent.js     # Generates strengths, gaps, and rewritten bullets
│   └── orchestrator.js      # Coordinates all agents and emits SSE events
├── routes/
│   └── analyze.js           # POST /analyze and GET /analyze/status/:requestId
├── utils/
│   ├── logger.js            # Request logging
│   └── statusStream.js      # SSE helper
└── server.js                # Express server entry point
```

---

## ⚙️ Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- npm
- [Ollama](https://ollama.com/) installed and running locally
- Llama 3.2:1b model pulled: `ollama pull llama3.2:1b`

---

## 🚀 Getting Started

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file in the `backend/` folder:

```env
PORT=5000
```

> **Want to use Groq API instead of Ollama?** Add `GROQ_API_KEY=your_key` to `.env`, then in each agent file comment out the `Ollama` line and uncomment the `ChatGroq` line.

### 3. Start Ollama

```bash
ollama serve
```

### 4. Run the Server

```bash
node server.js

# Or with auto-reload
npx nodemon server.js
```

The server runs at `http://localhost:5000`

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/analyze` | Run the full 3-agent pipeline on a resume + JD |
| GET | `/analyze/status/:requestId` | SSE stream — real-time agent progress updates |
| GET | `/health` | Health check |

---

## 🤖 How the Agents Work

| Agent | Role |
|---|---|
| `parserAgent.js` | Extracts candidate name, experience years, resume skills, required skills, nice-to-have skills, and work experience bullets from the resume and JD |
| `matchingAgent.js` | Scores resume against required and nice-to-have skills using LLM matching with a deterministic fallback; handles skill aliases (e.g. HTML5 → HTML, CSS3 → CSS) |
| `feedbackAgent.js` | Generates a summary, strengths, skill gaps, actionable suggestions, and rewritten resume bullets |
| `orchestrator.js` | Coordinates all agents, emits real-time SSE status events, and assembles the final result |


---

## 🛠 Tech Stack

- Node.js
- Express.js
- Ollama (Local LLM — Llama 3.2:1b)
- Multi-Agent Architecture

---

## 📁 Folder Structure

```
backend/
├── agents/
│   ├── parserAgent.js       # Parses and extracts resume content
│   ├── matchingAgent.js     # Matches resume to job requirements
│   ├── feedbackAgent.js     # Generates feedback on the resume
│   └── orchestrator.js      # Coordinates all agents
├── routes/
│   └── analyze.js           # API route for resume analysis
└── server.js                # Entry point — Express server setup
```

---

## ⚙️ Prerequisites

Make sure the following are installed before running the backend:

- [Node.js](https://nodejs.org/) >= 18
- npm
- [Ollama](https://ollama.com/) installed and running locally
- Llama 3.2:1b model pulled via:

```bash
ollama pull llama3.2:1b
```

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/ResumeScreeningApp.git
cd ResumeScreeningApp/backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the `backend/` folder:

```env
PORT=5000
```

### 4. Start Ollama

Make sure Ollama is running locally before starting the server:

```bash
ollama serve
```

### 5. Run the Server

```bash
# Development
node server.js

# Or with auto-reload
npx nodemon server.js
```

The server will start at `http://localhost:5000`

---

## 📡 API Endpoints

| Method | Endpoint       | Description                               |
|--------|----------------|-------------------------------------------|
| POST   | `/api/analyze` | Analyze and screen a resume using AI agents |

---

## 🤖 How the Agents Work

| Agent              | Role                                                        |
|--------------------|-------------------------------------------------------------|
| `parserAgent.js`   | Extracts key info from the resume (skills, experience, education) |
| `matchingAgent.js` | Matches extracted data against job requirements             |
| `feedbackAgent.js` | Generates constructive feedback on the resume               |
| `orchestrator.js`  | Coordinates the flow between all agents                     |

---

## Rough Notes: What Each Agent Is Doing

### parserAgent

- Takes raw resume text and job description text.
- Uses an LLM prompt to return structured JSON:
	- candidateName
	- experienceYears
	- resumeSkills
	- jobSkills
	- resumeHighlights
	- jobHighlights
- Tries to parse JSON from model output (supports fenced and plain JSON).
- If model output is weak or malformed, falls back to heuristics:
	- infers name from first meaningful line
	- infers years from patterns like "5 years" or "3-5 years"
	- extracts skills using a predefined skill hint list
	- extracts highlights from stronger resume/JD lines
- Returns cleaned, unique lists so downstream agents get stable input.

### matchingAgent

- Takes parsed resumeSkills and jobSkills.
- Calls an LLM matching prompt to produce:
	- score (0-100)
	- matchedSkills
	- missingSkills
- Validates and parses model JSON output.
- If model output is missing/invalid, falls back to deterministic matching:
	- normalizes skills
	- compares by exact, contains, and reverse-contains logic
	- computes score from matched/total job skills
- Returns matchRatio as matched count over required skill count.

### feedbackAgent

- Takes parsed highlights plus matching results.
- Calls an LLM feedback prompt to generate:
	- summary
	- strengths
	- gaps
	- suggestions
	- rewrittenBullets
- Parses model JSON and merges it with safe fallbacks.
- If model output is incomplete, builds fallback feedback from:
	- current match score
	- missing skills
	- available resume highlights
- Ensures user still receives actionable suggestions and at least one resume bullet rewrite.

### orchestrator

- Runs agents in sequence:
	1) parser
	2) matching
	3) feedback
- Passes outputs from one stage into the next.
- Provides combined response object for the API/UI.
