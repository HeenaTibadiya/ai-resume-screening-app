# Agentic ResumeIQ — Frontend

Frontend for the Agentic ResumeIQ application, built with **React 19 + Vite**.

---

## 🛠 Tech Stack

- React 19
- Vite
- Axios (HTTP requests)
- pdf-lib (PDF download)
- Server-Sent Events (real-time agent progress)

---

## 📁 Folder Structure

```
frontend/
├── src/
│   ├── App.jsx          # Root component — main UI and logic
│   ├── pdfLibResume.js  # PDF download utility
│   └── main.jsx         # Vite entry point
├── index.html
└── vite.config.js
```

---

## ⚙️ Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- npm

---

## 🚀 Getting Started

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file in the `frontend/` folder:

```env
VITE_API_URL=http://localhost:5000
```

### 3. Run the App

```bash
npm run dev
```

The app runs at `http://localhost:5173`

### 4. Build for Production

```bash
npm run build
```

Output goes to `frontend/dist/`.

---

## 🔗 Connecting to Backend

Make sure the backend server is running at `http://localhost:5000` before using the app.

Refer to the [Backend README](../backend/README.md) for setup instructions.

---

## 💡 Usage

1. Open the app at `http://localhost:5173`
2. Paste or type a resume in the left panel
3. Paste or type a job description in the right panel
4. Click **Analyze Resume** and watch real-time agent progress
5. View the match score, matched/missing skills, feedback, and download results as PDF


---

## 🛠 Tech Stack

- React
- JavaScript (ES6+)

---

## 📁 Folder Structure

```
frontend/
├── src/
│   └── App.js       # Root component — main UI and logic
```

---

## ⚙️ Prerequisites

Make sure the following are installed before running the frontend:

- [Node.js](https://nodejs.org/) >= 18
- npm
- React

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/ResumeScreeningApp.git
cd ResumeScreeningApp/frontend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the `frontend/` folder:

```env
REACT_APP_API_URL=http://localhost:5000
```

### 4. Run the App

```bash
npm start
```

The app will run at `http://localhost:3000`

---

## 🔗 Connecting to Backend

Make sure the backend server is running at `http://localhost:5000` before using the app.

Refer to the [Backend README](../backend/README.md) for setup instructions.

---

## 💡 Usage

1. Open the app in your browser at `http://localhost:3000`
2. Upload or paste a resume
3. Submit for AI-powered screening
4. View the analysis results and feedback
