# Resume Screening App — Backend

The backend of the Resume Screening application, powered by **Node.js**, **Express**, and **Ollama (Llama 3.2:1b)** for AI-based resume analysis using a multi-agent architecture.

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
