# Multi-Source Reconciliation Agent

An automated financial reconciliation engine and dashboard designed to match transaction records across multiple synthetic data sources (Bank Statements, Internal Ledgers, and Payment Gateways).

This project was built to solve the modern finance-ops bottleneck: verifying candidate matches quickly and honestly. Rather than using an opaque "black-box" ML scoring model, this engine uses a deterministic, rule-based approach to categorize every single row into specific, auditable outcomes.

## 🚀 Features

- **Multi-Source Ingestion**: Normalizes diverse datasets (Bank, Ledger, Gateway) into a unified schema for comparison.
- **Explainable Matching Rules**: 
  - *Exact Matches*: Identical amounts and references.
  - *Fuzzy Matches*: Allowed tolerances for small amount rounding differences or standard date settlement lags (e.g., ±2 days).
- **Strict Exception Categorization**: No generic "failed" buckets. Unmatched records are strictly classified into actionable categories:
  - `Amount Mismatch`
  - `Date Mismatch`
  - `Missing Counterpart`
  - `Duplicate Candidate`
  - `Unresolved`
- **Comprehensive Audit Trail**: Every decision is logged, providing exactly *why* a record was matched or flagged.
- **AI Batch Summarization**: Uses an LLM (Groq) to read the final metrics and generate a plain-English, executive-level summary of the reconciliation run.

## 📂 Project Structure

The codebase is organized as a monorepo containing a separate frontend and backend:

- **`backend/`**: The Node.js/Express API. Contains the core engine (`src/ingest`, `src/match`, `src/classify`, `src/report`, `src/audit`) and synthetic test data (`backend/data/`).
- **`frontend/`**: The React-based web dashboard (built with Vite). Handles the dropzone uploads, data visualization, and displaying the audit trail.

## 🛠️ Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- A [Groq API Key](https://console.groq.com/keys) (Optional, for the AI Summary feature)

### 1. Setup the Backend
Open a terminal and navigate to the backend directory:
```bash
cd backend
npm install
```

Copy the example environment file and add your Groq API key:
```bash
cp .env.example .env
# Open .env and add your GROQ_API_KEY
```

Start the backend server:
```bash
npm start
```
*The API will run on `http://localhost:3000`*

### 2. Setup the Frontend
Open a new terminal window and navigate to the frontend directory:
```bash
cd frontend
npm install
```

Start the Vite development server:
```bash
npm run dev
```
*The web app will run on `http://localhost:5173`*

## 📖 Usage

1. Open the frontend in your browser (`http://localhost:5173`).
2. You will be prompted to upload data sources.
3. If you want to use the synthetic test data provided with this project, navigate to the `backend/data/` folder and upload:
   - `bank_statement.csv`
   - `internal_ledger.csv`
   - `gateway_export.csv`
4. Click **Run a reconciliation**.
5. The dashboard will process the files through the backend engine and render the Batch Summary, Exception Breakdown, and Audit Table.
