# AIResumeScreeningApp

An AI-powered Resume Screening application built with **React** (frontend) and **Node.js + Express + Ollama (Llama 3.2:1b)** (backend), using a multi-agent architecture to parse, match, and provide feedback on resumes.

---

## 📁 Project Structure

```
ResumeScreeningApp/
├── frontend/
│   └── src/
│       └── App.js               # Root React component
└── backend/
    ├── agents/
    │   ├── parserAgent.js        # Parses and extracts resume content
    │   ├── matchingAgent.js      # Matches resume to job requirements
    │   ├── feedbackAgent.js      # Generates feedback on the resume
    │   └── orchestrator.js      # Coordinates all agents
    ├── routes/
    │   └── analyze.js            # API route for resume analysis
    └── server.js                 # Entry point — Express server setup
```

---

## ⚙️ Prerequisites

Make sure the following are installed before running the app:

- [Node.js](https://nodejs.org/) >= 18
- npm
- React
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
cd ResumeScreeningApp
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

Start Ollama locally:

```bash
ollama serve
```

Run the backend server:

```bash
node server.js

# Or with auto-reload
npx nodemon server.js
```

The backend will run at `http://localhost:5000`

---

### 3. Frontend Setup

Open a new terminal:

```bash
cd frontend
npm install
```

Create a `.env` file inside `frontend/`:

```env
REACT_APP_API_URL=http://localhost:5000
```

Run the frontend:

```bash
npm start
```

The app will run at `http://localhost:3000`

---

## 📡 API Endpoints

| Method | Endpoint       | Description                                  |
|--------|----------------|----------------------------------------------|
| POST   | `/api/analyze` | Analyze and screen a resume using AI agents  |

---

## 🤖 How the Agents Work

| Agent              | Role                                                              |
|--------------------|-------------------------------------------------------------------|
| `parserAgent.js`   | Extracts key info from the resume (skills, experience, education) |
| `matchingAgent.js` | Matches extracted data against job requirements                   |
| `feedbackAgent.js` | Generates constructive feedback on the resume                     |
| `orchestrator.js`  | Coordinates the flow between all agents                           |

---

## 💡 Usage

1. Open the app at `http://localhost:3000`
2. Upload or paste a resume
3. Submit for AI-powered screening
4. View the analysis results and feedback

---

## 🔗 Individual READMEs

- [Frontend README](./frontend/README.md)
- [Backend README](./backend/README.md)
