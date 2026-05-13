# Agentic ResumeIQ — Parse · Match · Feedback

An AI-powered resume screening application built with **React + Vite** (frontend) and **Node.js + Express** (backend), using a 3-agent LangChain architecture to parse, match, and provide feedback on resumes.

Supports two LLM backends:
- **Ollama** (default) — runs Llama 3.2:1b fully locally on your machine (100% private, no API key needed)
- **Groq API** (optional) — cloud inference on Llama 3.1:8b via Groq LPU hardware (~10–15 sec total)

---

## 🎯 Why I Built This

The modern job application process is broken in three ways:

1. **No feedback loop** — you apply and hear nothing back, with no idea why you were rejected.
2. **ATS black box** — Applicant Tracking Systems automatically filter out resumes before any human ever sees them, with no transparency about what disqualified you.
3. **Skill gap blindness** — it's extremely hard to know which skills you're missing without manually comparing your resume to every job description.

**Agentic ResumeIQ solves all three problems in six simple steps:**

> Upload or paste your resume → paste the job description → receive a match score → identify missing skills → get AI-generated improvement suggestions → download suggestions as a PDF.

No more guessing. No more silence. Just clear, actionable feedback before you hit submit.

---

## 📁 Project Structure

```
ai-resume-screening-app/
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Root React component
│   │   ├── pdfLibResume.js      # Feedback PDF download utility
│   │   └── main.jsx             # Vite entry point
│   ├── index.html
│   └── vite.config.js
└── backend/
    ├── agents/
    │   ├── parserAgent.js        # Parses resume + Job Description, extracts structured data
    │   ├── matchingAgent.js      # Scores resume against job requirements
    │   ├── feedbackAgent.js      # Generates strengths, gaps, and rewritten bullets
    │   └── orchestrator.js       # Coordinates all agents
    ├── routes/
    │   └── analyze.js            # API routes for analysis and SSE status stream
    ├── utils/
    │   ├── logger.js             # Request logging
    │   └── statusStream.js       # Server-Sent Events helper
    └── server.js                 # Express server entry point
```

---

## ⚙️ Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- npm
- [Ollama](https://ollama.com/) installed and running locally
- Llama 3.2:1b model pulled: `ollama pull llama3.2:1b`

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/ai-resume-screening-app.git
cd ai-resume-screening-app
```

---

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file inside `backend/`:

```env
PORT=5000
```

Start Ollama:

```bash
ollama serve
```

> **Want to use Groq API instead?** Get a free key at [console.groq.com](https://console.groq.com), add `GROQ_API_KEY=your_key` to `backend/.env`, then in each agent file comment out the `Ollama` line and uncomment the `ChatGroq` line.

Run the backend server:

```bash
node server.js

# Or with auto-reload
npx nodemon server.js
```

The backend runs at `http://localhost:5000`

---

### 3. Frontend Setup

Open a new terminal:

```bash
cd frontend
npm install
```

Create a `.env` file inside `frontend/`:

```env
VITE_API_URL=http://localhost:5000
```

Run the frontend:

```bash
npm run dev
```

The app runs at `http://localhost:5173`

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/analyze` | Run the full 3-agent pipeline on a resume + JD |
| GET | `/analyze/status/:requestId` | SSE stream — real-time agent progress updates |
| GET | `/health` | Health check |

---

## ⚡ Real-Time Agent Progress (Server-Sent Events)

When you click **Analyze Resume**, the frontend doesn't just wait for a single response — it opens a live **Server-Sent Events (SSE)** connection to the backend that streams status updates as each agent runs.

**How it works:**

1. The frontend sends `POST /analyze` and receives a `requestId`.
2. It immediately opens `GET /analyze/status/:requestId` as an SSE stream.
3. As each agent completes, the backend pushes a status event through the stream.
4. The frontend updates the UI in real time — showing which agent is currently running.
5. Once all agents finish, the final result is returned and the stream closes.

**Status events emitted (in order):**

| Event | Message shown in UI |
|---|---|
| `start` | Starting analysis... |
| `parsing` | Agent 1: Parsing resume and job description... |
| `matching` | Agent 2: Matching skills... |
| `feedback` | Agent 3: Generating feedback... |
| `done` | Analysis complete |

This approach gives users instant visual feedback instead of staring at a blank screen for 10+ seconds, and makes the multi-agent architecture visible and understandable.

---

## 🤖 How the Agents Work

| Agent | Role |
|---|---|
| `parserAgent.js` | Extracts candidate name, experience years, resume skills, required skills, and work experience bullets from the resume and JD |
| `matchingAgent.js` | Scores the resume against required and nice-to-have skills; uses LLM matching with a deterministic fallback |
| `feedbackAgent.js` | Generates a summary, strengths, skill gaps, suggestions, and rewritten resume bullets |
| `orchestrator.js` | Coordinates all agents, emits real-time SSE status events, and returns the combined result |

---

## 💡 Usage

1. Open the app at `http://localhost:5173`
2. Paste or type a resume in the left panel
3. Paste or type a job description in the right panel
4. Click **Analyze Resume** and watch real-time agent progress
5. View the match score, matched/missing skills, feedback, and download results as PDF

---

## 🔗 Individual READMEs

- [Frontend README](./frontend/README.md)
- [Backend README](./backend/README.md)
