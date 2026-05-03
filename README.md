# OSUCampus

OSUCampus is a NotebookLM-style study companion for Oregon State University students: upload course sources (docs/media/YouTube) and chat with Gemini to summarize, explain concepts, generate study guides, quizzes, and mind maps.

## Live site

- **Hosted on Render**: https://osucampus.onrender.com 

## Key features

- **Chat with branching**: explore follow-ups and alternate threads from any prior message
- **Study artifacts**: generate a **Study Guide**, **Quiz**, and **Mind Map** from your sources
- **Source ingestion**:
  - Text files are read in-browser
  - Binary files (PDF/audio/video/images) are uploaded for Gemini multimodal context
  - YouTube links are supported
- **Math rendering**: LaTeX via KaTeX (markdown math)
- **Auth + per-user data**:
  - **Google Sign-In (Supabase)** only
  - Restricted to OSU email domains: `@oregonstate.edu` and `*.oregonstate.edu`
  - Each user only sees and manages the sources they uploaded

## Tech stack

- Frontend: **React + Vite**
- Auth / DB / Storage: **Supabase** (Google OAuth + Postgres + Storage + RLS)
- LLM: **Google Gemini** (`@google/genai`)

## Local development

The Vite app lives in `[OSUCampus/](OSUCampus/)`.

```bash
cd OSUCampus
npm install
npm run dev
```

## Environment variables

Create `OSUCampus/.env` (it is gitignored) with:

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
```

You can use the template at `[OSUCampus/.env.example](OSUCampus/.env.example)`.

## Supabase setup (required for auth + per-user storage)

1. Create a Supabase project
2. Enable **Google** provider under **Authentication → Providers**
3. Add the Google OAuth redirect URI in Google Cloud Console:
  - `https://<your-project-ref>.supabase.co/auth/v1/callback`
4. Set **Authentication → URL Configuration**:
  - Site URL: your production origin (Render) and/or `http://localhost:5173`
  - Redirect URLs: include `http://localhost:5173/`** and your production URL pattern
5. Run the SQL migration in Supabase SQL Editor:
  - `[OSUCampus/supabase/migrations/001_user_documents_and_storage.sql](OSUCampus/supabase/migrations/001_user_documents_and_storage.sql)`

This creates:

- `public.user_documents` table + **Row Level Security** (users only access their own rows)
- private Storage bucket `sources` + policies enforcing `{user_id}/...` paths

## Gemini API key

This app asks each user for their **Gemini API key** in Settings and stores it **locally in the browser** (per signed-in user). The key is sent only to Google’s API from the client.

## Notes

- If Google sign-in fails with `redirect_uri_mismatch`, confirm the callback URL matches exactly:
  - `https://<your-project-ref>.supabase.co/auth/v1/callback`

