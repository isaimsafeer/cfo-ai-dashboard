# AI CFO — Robotic Imaging Financial Assistant

A [Next.js](https://nextjs.org) application that provides an AI-powered CFO assistant for robotic imaging enterprises. It uses Google Gemini (with thinking model support) to answer financial questions by calling real-time tools against your database.

## Features

- 🤖 Gemini thinking model integration with `thought_signature` support
- 🔧 Agentic tool-calling loop (burn rate, losing projects, expense trends, anomaly detection)
- 🏢 Multi-organization context and weighted financial calculations
- 📊 Audit-friendly responses with inline calculations

## Getting Started

### Prerequisites

- Node.js 18+
- A Google Gemini API key

### Environment Variables

Create a `.env.local` file in the root:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### Install & Run

```bash
npm install
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## AI & Tools

The AI route lives at `app/api/ai/route.ts`. It runs a multi-step tool loop (up to 8 steps) powered by `lib/ai/gemini.ts`.

### Available Tools

| Tool | Description |
|---|---|
| `getBurnRate` | Current cash burn rate for an org |
| `getLosingProjects` | Projects with negative margin |
| `getExpenseTrends` | Expense trends over a date range (incl. travel cost per survey) |
| `detectAnomalies` | Flags unusual technician expenses |
| `searchOrganizationsByName` | Resolves org names to IDs |

### Gemini Thinking Model Notes

This project uses `gemini-2.5-flash-preview` (or similar thinking-capable models). The `thought_signature` field on function call parts is preserved and echoed back on each tool loop iteration — required for thinking models to work correctly. See [Google's docs](https://ai.google.dev/gemini-api/docs/thought-signatures) for details.

## Project Structure

```
app/
  api/ai/route.ts       # AI POST endpoint with tool loop
lib/
  ai/
    gemini.ts           # Gemini API client (thought_signature-aware)
    tools.ts            # Tool declarations and executors
types/
  database.ts           # Supabase / DB types
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Gemini API Docs](https://ai.google.dev/gemini-api/docs)
- [Gemini Thought Signatures](https://ai.google.dev/gemini-api/docs/thought-signatures)

## Deploy on Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

Make sure to add `GEMINI_API_KEY` to your Vercel environment variables before deploying. See the [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) for more details.