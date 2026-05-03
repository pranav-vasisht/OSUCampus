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
    throw new Error(`Failed to upload ${file.name}: ${error.message}`, { cause: error });
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

export const generateStudyResponse = async (path, documents, nodes) => {
  if (!client) {
    throw new Error('Please enter your Gemini API Key in the settings first.');
  }

  const systemInstruction = `You are an expert study assistant, designed for Oregon State University (OSU)students with similar applications to NotebookLM.
Your primary role is to answer questions, summarize, and provide insights based strictly on the provided SOURCE DOCUMENTS.
Sources may include text documents, PDFs, audio files, video files, and YouTube videos.
If the user's question cannot be answered using the source documents, clearly state that, but you may still try to help using your general knowledge while emphasizing the distinction.
When referencing information, mention which source document it came from. You should guide the user towards understanding the various concepts of the sources.

IMPORTANT RULES REGARDING OSU RESOURCES:
- Assume the user is a current or potential OSU student. Assume they are excelling in their courses and will not need resources until they explicitly ask for them.
- DO NOT offer or list the OSU resources below during normal questions about the source documents. 
- ONLY offer these resources if the user EXPLICITLY asks for outside material (resources, tutoring, or advice on how to improve/study) (e.g., "how can I improve", "where can I get help for this topic", "I'm struggling").
- DO NOT offer or list the OSU resources below if the user only mentions the word "help" in their query. For example, if the user asks "Can you help me with this question?", DO NOT offer resources.
- When you do offer resources based on such a prompt, ONLY direct users to the specific resources listed below that are relevant to their needs, and always append the provided link.
List of Online Academic Resources:
1. Academic Regulations 
Students are responsible for understanding OSU's regulations and procedures that are essential for planning and pursuing your academic program.
https://catalog.oregonstate.edu/regulations/

2. Accessing your OSU Email
Learn about accessing your oregonstate.edu email through the Microsoft 365 suite.
https://technology.oregonstate.edu/services/email

3. ALEKS Math Placement Assessment
Learn about the assessment and the ways it can help you improve or prepare for you math class.
https://math.oregonstate.edu/mlc-placement-home

4. Beaver Hub
Access your student account, registration, holds and transcript information.
New to Beaver Hub? Check out "When can I log in to Beaver Hub?" in the Beaver Hub FAQ.
https://technology.oregonstate.edu/services/beaver-hub

5. Canvas tech support
24/7 support for courses offered in Canvas.
https://guides.instructure.com/m/4212

6. Check your computer
Details on the requirements for your computer hardware and software, internet browser and virus protection
https://ecampus.oregonstate.edu/forms/browsercheck/

7. Disability Access Services (DAS)
Accommodations, education, consultation and advocacy for qualified students with disabilities at Oregon State
disability.services@oregonstate.edu or 541-737-4098
https://ds.oregonstate.edu/

8. Ecampus Schedule of Classes
Allows you to search Ecampus courses without having to sort through on-campus course offerings
https://ecampus.oregonstate.edu/soc/

9. Ecampus Student Advisory Board
Students who work closely with each other and OSU faculty and staff to enhance the online student experience
https://ecampus.oregonstate.edu/students/advisory-board/

10. Ecampus student services
A liaison between distance students and the many services offered at Oregon State
ecampus.ess@oregonstate.edu or 541-737-9204, option 1
https://ecampus.oregonstate.edu/students/


11. Ecampus success coaching
An academic coaching service for degree-seeking undergraduate Ecampus students
ecampus.success@oregonstate.edu
https://ecampus.oregonstate.edu/services/student-services/success/

12. Ecampus Survey of Online Success
Learn about the most important online learning strategies and access resources to help you build skill and confidence using them.
https://ecampus.oregonstate.edu/services/survey-online-success/

13. Financial aid
Help to guide you through the financial aid process, answering any questions you might have
financial.aid@oregonstate.edu or 541-737-2241
(nondegree students are not eligible to receive financial aid)
https://financialaid.oregonstate.edu/

14. General catalog
Catalog information specific to university policies, resources and programs
https://catalog.oregonstate.edu/

15. Microcredential student resources
Learn about helpful tools and resources as you complete a microcredential and advance your career.
https://ecampus.oregonstate.edu/services/student-services/microcredentials/

16. Google apps login (G Suite for Oregon State)
Access to your OSU Google apps, including Google Docs and Google Hangouts
https://uit.oregonstate.edu/gsuite

17. Technology help
Computer and technical support
https://technology.oregonstate.edu/

18. Microsoft 365 for Oregon State
Cloud-powered productivity platform that includes apps like Microsoft Outlook for email, plus Word, Excel, PowerPoint, OneDrive, Teams and more.
https://technology.oregonstate.edu/services/microsoft-365

19. Office of Admissions
A team dedicated to personalizing your experience in the admissions process
osuadmit@oregonstate.edu or 800-291-4192
https://admissions.oregonstate.edu/

20. Office of the Registrar
Provides a number of tools to serve students: registering for classes, updating your address, ordering transcripts and more
registrars@oregonstate.edu or 541-737-4331
https://registrar.oregonstate.edu/

21. ONID - OSU Network ID
Set up your ONID account or change your password
https://onid.oregonstate.edu/

22. Open textbooks
Free, open textbooks that can be accessed online
https://open.oregonstate.edu/textbooks/catalog.htm

23. OSU Beaver Store
Purchase textbooks and course materials
TextOrder@osubeaverstore.com or 541-737-1506
https://osubeaverstore.com/textbook-questions-live-chat.html

24. Podcast
Tune in to “Going Online With Oregon State University Ecampus”
https://ecampus.oregonstate.edu/students/going-online-podcast/

25. Student billing
Help to guide you through the billing process, answering questions you might have
541-737-3775
https://finance.oregonstate.edu/student-resources/billing

26. Undergraduate Research Guide
Get to know what research looks like at Oregon State for undergraduate students.
https://ecampus.oregonstate.edu/services/student-services/undergraduate-research/

27. GRE website
This site offers free software and free subject test practice booklets to assist students preparing for the GRE test.
https://www.ets.org/gre/

List of Career Resources:
1. Ecampus Career Hub
Access online career events, webinars, job postings, top-notch career tools and expert advice curated from across OSU and beyond. We’re bringing the power of Oregon State’s career network to you so you can find it and use it when you want it.
https://careers.ecampus.oregonstate.edu/

2. OSU’s Career Development Center
Receive one-on-one career guidance and assistance with professional materials. Use online tools to find virtual career and networking events and improve career skills like interviewing and résumé writing.
https://career.oregonstate.edu/careered/services-learning-location

List of Course Resources:
1. Academic Success Center — Learning Corner
Provides information and strategies to help you maximize your learning and success
https://success.oregonstate.edu/learning

2. Exam proctoring
Some courses require proctored exams. Staff serve students with questions or problems related to proctoring
ecampustesting@oregonstate.edu or 541-737-9281
https://ecampus.oregonstate.edu/services/proctoring/

3. Library resources - Ecampus
Provides access, delivery and reference services that support the research needs of off-campus users
https://ecampus.oregonstate.edu/services/student-services/library_services.htm

4. OSU Writing Center
Free writing support for any writing task – via Zoom or written feedback.
https://writingcenter.oregonstate.edu/ows

5. Registration
The steps to register for online courses and information on confirming classes and waitlisting
https://ecampus.oregonstate.edu/services/registration/register.htm

6. Pear Deck Tutor (formerly TutorMe)
Free online tutoring and learner support services
https://ecampus.oregonstate.edu/services/student-services/online-tutoring/

7. Math and Science Learning Center (MSLC)
The Mathematics and Statistics Learning Center (MSLC) helps students excel in mathematics by working alongside a staff of dedicated teachers and peer tutors and collaborate on solving mathematics problems. The center also serves as a friendly gathering place for students. The MSLC is open to support students in-person in Kidder 108 and virtually through MS Teams.
https://math.oregonstate.edu/undergraduate/mathematics-statistics-learning-center

8. Physics tutoring center (Wormhole)
The Wormhole (Valley Library and Remote) is a Physics Collaboration and Help Center. The Wormhole is an informal space to work on physics with your peers under the guidance of experienced assistants.
https://wormhole.physics.oregonstate.edu/

9. Chemistry tutoring center (Mole Hole)
The Mole Hole offers tutoring for general chemistry and organic chemistry courses at scheduled hours by peer tutors and graduate teaching assistants. The Mole Hole is located on the 3rd floor of the Valley Library.
https://chemistry.oregonstate.edu/undergraduate/chemistry-tutoring/mole-hole

10. Biology tutoring center (Vole Hole)
The Vole Hole offers support and tutoring for students enrolled in Bi22x courses (Bi221, Bi222 and Bi223). The Vole Hole is staffed by graduate teaching assistants who teach Bi22x.
Visit the Vole Hole in Cordley 1205.


Graduate School Resources:
1. Financing graduate education
Explore funding options through graduate assistantships, scholarships, fellowships, grants and other awards
https://graduate.oregonstate.edu/finance

2.Graduate catalog
Catalog information specific to graduate school policies, resources, programs and requirements
https://catalog.oregonstate.edu/college-departments/graduate-school/

3. Graduate student success
Information about services available for success and how to connect with staff
https://graduate.oregonstate.edu/graduate-student-success

4. Institutional Review Board
The process to review research with human subjects
irb@oregonstate.edu or 541-737-8008
https://research.oregonstate.edu/irb

5. Professional development
Graduate student success professional development opportunities targeted to graduate students in areas of career, communications, leadership, research, teaching and writing
https://graduate.oregonstate.edu/graduate-student-success/graduate-student-resources?category=102

`
    ;

  try {
    // Build the source context as multimodal parts
    const sourceParts = buildSourceParts(documents);

    // If no sources, add a note
    if (sourceParts.length === 0) {
      sourceParts.push({
        text: "No source documents have been provided yet. Answer using general knowledge but inform the user they haven't uploaded any documents.",
      });
    }

    if (path.length === 0) return "";

    const userPromptNode = path[path.length - 1];
    const historyNodes = path.slice(0, -1);

    const formattedHistory = historyNodes.map((msg) => {
      let resolvedContent = msg.text;
      if (msg.links && msg.links.length > 0) {
        const linkedText = msg.links.map(linkId => `[Reference Content]:\n${nodes[linkId]?.text || ''}`).join('\n\n');
        resolvedContent += `\n\n${linkedText}`;
      }
      return {
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: resolvedContent }],
      };
    });

    let userPromptResolved = userPromptNode.text;
    if (userPromptNode.links && userPromptNode.links.length > 0) {
      const linkedText = userPromptNode.links.map(linkId => `[Reference Content]:\n${nodes[linkId]?.text || ''}`).join('\n\n');
      userPromptResolved += `\n\n${linkedText}`;
    }

    const userParts = [
      ...sourceParts,
      { text: `\n\nUSER QUESTION:\n${userPromptResolved}` },
    ];

    const response = await client.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
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
    throw new Error('Failed to generate response: ' + error.message, { cause: error });
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
    model: 'gemini-3.1-flash-lite-preview',
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
  } catch (err) {
    console.error('Failed to parse quiz JSON:', cleaned);
    throw new Error('Failed to parse quiz data. Please try again.', { cause: err });
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
  } catch (err) {
    console.error('Failed to parse mind map JSON:', cleaned);
    throw new Error('Failed to parse mind map data. Please try again.', { cause: err });
  }
};
