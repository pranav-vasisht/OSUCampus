import { GoogleGenAI } from '@google/genai';

let client = null;

export const initGemini = (apiKey) => {
  if (apiKey) {
    client = new GoogleGenAI({ apiKey });
  } else {
    client = null;
  }
};

export const checkGeminiKey = () => {
  return !!client;
};

/**
 * Determines if a file should be treated as plain text or needs to go through
 * the Gemini File API for multimodal processing.
 */
const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.csv', '.json']);

function getFileExtension(filename) {
  const dotIndex = filename.lastIndexOf('.');
  return dotIndex >= 0 ? filename.substring(dotIndex).toLowerCase() : '';
}

export function isTextFile(filename) {
  return TEXT_EXTENSIONS.has(getFileExtension(filename));
}

/**
 * Upload a binary file (PDF, MP4, MP3, etc.) to the Gemini File API.
 * Returns the uploaded file metadata including URI and mimeType.
 */
export const uploadFileToGemini = async (file) => {
  if (!client) {
    throw new Error('Please enter your Gemini API Key in the settings first.');
  }

  try {
    const uploadResult = await client.files.upload({
      file: file,
      config: {
        mimeType: file.type,
      },
    });

    // The File API may need time to process video/audio. Poll until ACTIVE.
    let geminiFile = uploadResult;
    while (geminiFile.state === 'PROCESSING') {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      geminiFile = await client.files.get({ name: geminiFile.name });
    }

    if (geminiFile.state === 'FAILED') {
      throw new Error(`File processing failed for ${file.name}`);
    }

    return {
      uri: geminiFile.uri,
      mimeType: geminiFile.mimeType,
      name: geminiFile.name,
    };
  } catch (error) {
    console.error('File upload error:', error);
    throw new Error(`Failed to upload ${file.name}: ${error.message}`);
  }
};

/**
 * Build the content parts array for the Gemini API request.
 * Combines text context, file references, and YouTube links.
 */
function buildSourceParts(documents) {
  const parts = [];

  for (const doc of documents) {
    if (doc.sourceType === 'text') {
      // Inline text content
      parts.push({ text: `--- SOURCE: ${doc.name} ---\n${doc.content}` });
    } else if (doc.sourceType === 'file' && doc.geminiFile) {
      // Uploaded file reference (PDF, MP4, MP3)
      parts.push({
        fileData: {
          fileUri: doc.geminiFile.uri,
          mimeType: doc.geminiFile.mimeType,
        },
      });
      parts.push({ text: `[The above file is: ${doc.name}]` });
    } else if (doc.sourceType === 'youtube') {
      // YouTube URL — Gemini natively understands these
      parts.push({
        fileData: {
          fileUri: doc.url,
          mimeType: 'video/mp4', // Gemini expects this for YouTube URLs
        },
      });
      parts.push({ text: `[The above video is from YouTube: ${doc.name}]` });
    }
  }

  return parts;
}

export const generateStudyResponse = async (userPrompt, documents, history = []) => {
  if (!client) {
    throw new Error('Please enter your Gemini API Key in the settings first.');
  }

  const systemInstruction = `You are an expert study assistant, designed to be similar to NotebookLM.
Your primary role is to answer questions, summarize, and provide insights based strictly on the provided SOURCE DOCUMENTS.
Sources may include text documents, PDFs, audio files, video files, and YouTube videos.
If the user's question cannot be answered using the source documents, clearly state that, but you may still try to help using your general knowledge while emphasizing the distinction.
When referencing information, mention which source document it came from.`;

  try {
    // Build the source context as multimodal parts
    const sourceParts = buildSourceParts(documents);

    // If no sources, add a note
    if (sourceParts.length === 0) {
      sourceParts.push({
        text: "No source documents have been provided yet. Answer using general knowledge but inform the user they haven't uploaded any documents.",
      });
    }

    // Format history for the API
    const formattedHistory = history.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));

    // The first user message includes the source materials + the actual question
    const userParts = [
      ...sourceParts,
      { text: `\n\nUSER QUESTION:\n${userPrompt}` },
    ];

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        ...formattedHistory,
        { role: 'user', parts: userParts },
      ],
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.3,
      },
    });

    return response.text;
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw new Error('Failed to generate response: ' + error.message);
  }
};

// ─── Output Mode Generators ───────────────────────────────────────────

/**
 * Helper to run a single-shot generation with source context.
 */
async function generateFromSources(documents, systemInstruction, userPrompt) {
  if (!client) {
    throw new Error('Please enter your Gemini API Key in the settings first.');
  }

  const sourceParts = buildSourceParts(documents);
  if (sourceParts.length === 0) {
    throw new Error('Please upload at least one source document first.');
  }

  const response = await client.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      { role: 'user', parts: [...sourceParts, { text: userPrompt }] },
    ],
    config: {
      systemInstruction,
      temperature: 0.4,
    },
  });

  return response.text;
}

/**
 * Generate a comprehensive study guide from the uploaded sources.
 */
export const generateStudyGuide = async (documents) => {
  const system = `You are an expert academic tutor. Generate a comprehensive, well-structured study guide based on the provided source materials.
Use clear markdown formatting with headings, subheadings, bullet points, bold key terms, and numbered lists.
Structure the guide as:
1. Overview / Executive Summary
2. Key Concepts & Definitions
3. Detailed Topic Breakdowns (one section per major topic)
4. Important Relationships & Connections
5. Common Pitfalls & Misconceptions
6. Quick Reference / Cheat Sheet
Make it thorough, clear, and optimized for exam preparation.`;

  return generateFromSources(documents, system,
    'Generate a comprehensive study guide from all of the provided source materials.');
};

/**
 * Generate a podcast-style script between two hosts discussing the source material.
 */
export const generateAudioOverview = async (documents) => {
  const system = `You are a podcast scriptwriter. Generate an engaging audio overview script as a conversation between two hosts — Alex and Sam — discussing the provided source materials.
The conversation should:
- Start with a brief, energetic intro
- Cover all major topics from the sources
- Use a natural, conversational tone (not overly academic)
- Include moments of insight, questions between hosts, and "aha" moments
- End with a concise summary of key takeaways

Format the output as a script with clear speaker labels:
**Alex:** ...
**Sam:** ...

Make it approximately 3-5 minutes of spoken content (about 600-1000 words).`;

  return generateFromSources(documents, system,
    'Create an engaging podcast-style audio overview script discussing all the key material from the provided sources.');
};

/**
 * Generate an interactive quiz as structured JSON.
 */
export const generateQuiz = async (documents) => {
  const system = `You are an expert quiz creator. Generate a quiz based on the provided source materials.
You MUST respond with ONLY valid JSON (no markdown fences, no extra text).
The JSON must follow this exact schema:
{
  "title": "Quiz title",
  "questions": [
    {
      "id": 1,
      "question": "The question text",
      "type": "multiple_choice",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Why this answer is correct"
    }
  ]
}
Generate 8-12 questions that test understanding of the key concepts.
Mix difficulty levels: some recall, some application, some analysis.
Every question MUST have exactly 4 options and one correct answer.`;

  const raw = await generateFromSources(documents, system,
    'Generate a quiz in JSON format based on the provided source materials.');

  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse quiz JSON:', cleaned);
    throw new Error('Failed to parse quiz data. Please try again.');
  }
};

/**
 * Generate a mind map tree structure as JSON.
 */
export const generateMindMap = async (documents) => {
  const system = `You are a knowledge organization expert. Generate a hierarchical mind map of the key concepts from the provided source materials.
You MUST respond with ONLY valid JSON (no markdown fences, no extra text).
The JSON must follow this exact schema:
{
  "label": "Central Topic",
  "children": [
    {
      "label": "Main Branch 1",
      "children": [
        { "label": "Sub-topic 1a", "children": [] },
        { "label": "Sub-topic 1b", "children": [] }
      ]
    }
  ]
}
Rules:
- The root node should represent the overall topic
- Create 3-6 main branches
- Each main branch should have 2-5 children
- Go at most 3 levels deep
- Labels should be concise (2-6 words)
- Cover all major concepts from the sources`;

  const raw = await generateFromSources(documents, system,
    'Generate a mind map tree structure in JSON format from the provided source materials.');

  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse mind map JSON:', cleaned);
    throw new Error('Failed to parse mind map data. Please try again.');
  }
};
