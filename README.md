# OSUCampus

OSUCampus is a study workspace that turns your course materials into an AI-assisted learning session. You upload sources once, then chat about them, generate structured outputs, and explore ideas visually—all grounded in what you actually uploaded.

## What you can do

- **Chat** — Ask questions; answers use your uploaded documents and conversation history.
- **Study guide** — Get an organized guide synthesized from your sources.
- **Audio overview** — Scripted overview you can play back with your browser’s text-to-speech.
- **Quiz** — Practice with questions generated from your materials.
- **Mind map** — See key concepts as a graph; click a node to ask the chat to explain it (split view with chat).

## Sources

Add PDFs, text files, images, audio, video, and YouTube links. Text is read in the browser; other files are sent through the Gemini File API so the model can use them.

## Requirements

- [Node.js](https://nodejs.org/) (LTS recommended)
- A [Google Gemini API key](https://aistudio.google.com/apikey) (stored only in your browser via `localStorage`)

## Run locally

```bash
cd OSUCampus
npm install
npm run dev
```

On first launch, open **Settings** and save your API key. Then upload at least one source before using Study guide, Audio overview, Quiz, or Mind map (those modes need material to analyze).

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |

## Stack

React, Vite, [`@google/genai`](https://www.npmjs.com/package/@google/genai), React Markdown, Lucide icons.
