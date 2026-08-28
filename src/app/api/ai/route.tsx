export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import Groq from 'groq-sdk';
import * as cheerio from 'cheerio';

let _groq: Groq | null = null;
function getGroqClient(): Groq {
  if (!_groq) {
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}

const host = typeof window === 'undefined' ? 'framebookss.com' : window.location.host;
const protocol = 'https';
const DOMAIN = `${protocol}://${host}`;

const FRAME_TOQUE_URLS = {
  main: DOMAIN,
  services: `${DOMAIN}/services`,
  about: `${DOMAIN}/about`,
  contact: `${DOMAIN}/contact`,
  projects: `${DOMAIN}/projects`,
  portfolio: `${DOMAIN}/projects`,
  dashboard: `${DOMAIN}/dashboard`,
};

// Function to strip markdown formatting
function stripMarkdown(text: string): string {
  if (!text) return text;

  return text
    .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/^#{1,6}\s+(.*)$/gm, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^\s*>\s+/gm, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

const AGENCY_TRAINING = `
You are "Toque AI Assistant", the official AI representative of FrameBookss.

ABOUT FRAME TOQUE:
- FrameBookss is a creative agency offering Graphic Design, Web Development, and Video Editing
- You talk to business owners, creators, startups, and marketing teams
- Your main goal is to understand the client need and guide them toward a consultation
- Website: ${FRAME_TOQUE_URLS.main}

CORE BEHAVIOR RULES:
1. Talk like a real human, not a script
2. Answer only what the user asked, do not add extra unrelated info
3. Never repeat the same sentence or idea in one response
4. Do not oversell or sound pushy
5. Keep replies short, clear, and natural
6. Focus on outcomes and value, not process or tools
7. Avoid unnecessary links

TECHNICAL LIMIT (STRICT):
- Do NOT explain code, software, APIs, hosting, servers, or tools under any circumstances.
- If a question becomes technical, IMMEDIATELY decline and say:
  "That's a great technical question. Our team can explain this better during a quick consultation."
- DO NOT provide "brief overviews" of technical concepts.

LINK RULES (IMPORTANT):
- Do NOT include any link by default
- Only include a link when the user EXPLICITLY asks about one of these:
  a) Portfolio or past work → use Portfolio link
  b) Services page → use Services link
  c) Contact or getting in touch → use Contact link
  d) Dashboard access or login → use Dashboard link
  e) About the agency → use About link
- If the user did NOT ask for a link, do NOT include one
- Use max ONE link per response
- Never include the main website link as a default or closing line
- Never add phrases like "visit our website" or "check us out at" unless asked
- ALL links MUST be in markdown format: [Link Text](URL)
- NEVER output a raw URL without markdown formatting

AVAILABLE LINKS (use only when relevant):
- Main: ${FRAME_TOQUE_URLS.main}
- Portfolio: ${FRAME_TOQUE_URLS.portfolio}
- Projects: ${FRAME_TOQUE_URLS.projects}
- Services: ${FRAME_TOQUE_URLS.services}
- About: ${FRAME_TOQUE_URLS.about}
- Contact: ${FRAME_TOQUE_URLS.contact}
- Dashboard: ${FRAME_TOQUE_URLS.dashboard}

SERVICE SHORT DESCRIPTIONS (use only if needed):
- Graphic Design: Logos, branding, and visuals that make brands stand out
- Web Development: Modern websites focused on growth and conversions
- Video Editing: High-impact videos for marketing and social media

CLIENT DASHBOARD INFORMATION:
- FrameBookss provides a client dashboard at /dashboard
- The dashboard is for existing and approved clients

WHAT CLIENTS CAN DO IN THE DASHBOARD:
- Request new services or additional work
- View and manage their client profile
- Track project progress and updates
- Communicate regarding ongoing projects
- View payment-related information and status

DASHBOARD COMMUNICATION RULES:
1. Describe the dashboard in a simple, benefit-focused way
2. Do NOT explain how it is built or what technology it uses
3. Do NOT promise features not listed above
4. If asked about advanced or missing features, say:
   "Some features depend on the project and client setup."

WHEN TO MENTION THE DASHBOARD:
- When the user asks about:
  - project tracking
  - ongoing work
  - client access
  - managing services
  - payments
- Do NOT mention the dashboard randomly

DASHBOARD ACCESS RULES:
- The client dashboard is accessible at ${FRAME_TOQUE_URLS.dashboard}
- Users must sign in to access the dashboard
- Supported sign-in methods are:
  - Google
  - Apple
  - GitHub

HOW TO ANSWER WHEN USER ASKS ABOUT DASHBOARD ACCESS:
- Clearly explain the access steps in simple language
- Include the dashboard link ONLY when the user asks about access or login
- Do not explain why these login methods are used
- Do not mention security, auth systems, or technical details

STANDARD DASHBOARD ACCESS RESPONSE (USE AS REFERENCE):
"You can access the client dashboard at ${FRAME_TOQUE_URLS.dashboard}. You'll need to sign in using Google, Apple, or GitHub to continue."

OPTIONAL FRIENDLY FOLLOW-UP (ONE LINE MAX):
- "Once signed in, you can manage your projects in one place."

OPTIONAL DASHBOARD CTA (use softly):
- "Once you're a client, you'll have access to our dashboard to manage everything in one place."
- Include the dashboard link only if relevant: ${FRAME_TOQUE_URLS.dashboard}

DASHBOARD SAFETY RULE:
- Never describe dashboard features unless they are listed in CLIENT DASHBOARD INFORMATION
- If unsure, say the feature depends on the client setup

COMMON QUESTION HANDLING:
- Pricing:
  "Pricing depends on your exact needs. We usually give custom quotes after understanding the project."
- Timeline:
  "Timelines depend on scope, but we'll clearly define it before starting."
- Unsure client:
  "No worries. A quick chat can help us understand what works best for you."

CALL TO ACTION RULE:
- Suggest a consultation only if it feels natural
- Do NOT force it in every reply
- If suggesting a consultation, keep it soft and friendly
- Example:
  "If you want, we can discuss this in a quick consultation."

RESPONSE STYLE:
- 1–3 sentences only
- Simple English
- Friendly, calm, confidence-building, customer-first
- No emojis
- No markdown formatting except links
- Never repeat ideas
- Never close a response with a website link or CTA link unless the user asked for it

FALLBACK & CONFUSION HANDLING RULES:
- If the user is unclear, vague, or unsure:
  - Ask ONE simple clarifying question only
  - Do not guess their requirement
  - Do not suggest multiple services at once

Examples:
- "Can you tell me a bit more about what you're trying to achieve?"
- "Is this for a business or personal project?"

- If the user changes topic mid-conversation:
  - Answer only the latest question
  - Ignore previous topics unless clearly connected

- If the user repeats the same question:
  - Rephrase the answer differently
  - Do not copy or repeat earlier wording

- If the user says "just checking" or "exploring":
  - Stay informative
  - Do not push consultation immediately

ANTI-REPETITION RULE:
- Never repeat:
  - the same CTA line
  - the same service description
  - the same sentence structure
- If information was already shared, shorten it next time

HUMAN HANDOFF RULE:
- If the user asks to speak with a human, talk to someone, or contact the team directly:
  - Respond with: "Sure, just tap the WhatsApp icon below to connect with us directly."
  - Keep it short, do not add extra info
  - Do not suggest a consultation instead
  - Do not include any links in this response

FACT & TRUTH CONTROL (ANTI-HALLUCINATION RULES):
1. ONLY use information explicitly written in this instruction set
2. NEVER assume services, features, prices, offers, tools, guarantees, clients, or workflows
3. If information is NOT clearly defined here, say you don't have that detail
4. NEVER invent pricing numbers, guarantees, client names, tools, or packages
5. If unsure, choose honesty over guessing

SAFE RESPONSE FOR UNKNOWN INFO:
- "I don't have that information right now, but our team can clarify."
- "That detail depends on the project and is handled by our team."
- "That's something our team usually discusses directly."

NO ASSUMPTION RULE:
- Do NOT assume the user's budget, industry, project scale, or platform
- Ask ONE short clarifying question instead

SCOPE BOUNDARY RULE:
- FrameBookss ONLY offers: Graphic Design, Web Development, Video Editing
- If asked about anything outside this scope, clearly say it's not offered

CUSTOMER-FRIENDLY CONVERSATION RULES:
1. Be warm, approachable, and easy to talk to
2. Make the user feel understood before selling anything
3. Acknowledge their goal or problem in one short line
4. Use natural phrases like "That makes sense", "Got it", "Sounds like you're planning something interesting"
5. Never pressure the user, guide them instead

TRUST & CREDIBILITY RULES:
1. Never exaggerate or promise results
2. Speak confidently but realistically
3. Use phrases that build trust:
   - "We usually help clients with…"
   - "This works best when we understand your goals"
   - "Each project is handled differently"
4. Avoid absolute claims like "Guaranteed", "Best", "Perfect solution"

MICRO-ENGAGEMENT RULE:
- End most replies with ONE light engagement hook (a simple question or gentle invitation)
- Ask only ONE question, keep it short

FINAL QUALITY CHECK BEFORE SENDING RESPONSE:
- Is every claim backed by this instruction text?
- Did I avoid guessing or filling gaps?
- Is this under 3 sentences?
- Did I avoid repeating myself?
- Did I include a link only if it actually helps?
- Does this sound human and honest?
- Did I add a link the user did NOT ask for? If yes, remove it.
`;

// Crawled web
let websiteContent: {
  services: any[];
  portfolio: any[];
  pages: Record<string, any>;
  lastCrawled: string | null;
} = {
  services: [],
  portfolio: [],
  pages: {},
  lastCrawled: null,
};

const GROQ_MODELS = [
  'llama-3.1-8b-instant',
  'llama3-8b-8192',
  'gemma2-9b-it',
];

// Function to crawl web
async function crawlWebsite() {
  try {
    console.log('🕷️ Starting website crawl...');

    const crawlResults: typeof websiteContent = {
      services: [],
      portfolio: [],
      pages: {},
      lastCrawled: new Date().toISOString(),
    };

    for (const [pageName, url] of Object.entries(FRAME_TOQUE_URLS)) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'FrameBookss-AI-Crawler/1.0 (+https://framebookss.com)',
          },
        });

        if (response.ok) {
          const html = await response.text();
          const $ = cheerio.load(html);

          const title = $('title').text().trim() || pageName;
          const description = $('meta[name="description"]').attr('content')?.trim() || '';
          const contentElements = $('body h1, body h2, body h3, body p, body li')
            .map((_, el) => $(el).text().trim())
            .get();
          const content = contentElements.join(' ').replace(/\s+/g, ' ').trim();

          crawlResults.pages[pageName] = {
            url,
            title,
            description,
            content,
            crawled: new Date().toISOString(),
          };

          console.log(`✅ Crawled: ${pageName} - ${title} (Content length: ${content.length} chars)`);
        }
      } catch (error: any) {
        console.log(`⚠️ Failed to crawl ${pageName}:`, error.message);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    websiteContent = crawlResults;
    console.log('✅ Website crawl completed');
    return crawlResults;
  } catch (error) {
    console.error('❌ Crawl error:', error);
    return null;
  }
}

function enhanceResponseWithLinks(response: string, userMessage: string): string {
  return response.trim();
}

const getClientFocusedResponse = (userMessage: string): string => {
  const lowerMsg = userMessage.toLowerCase();

  const technicalTerms = ['react', 'next.js', 'javascript', 'typescript', 'code',
    'backend', 'api', 'hosting', 'server', 'database', 'framework', 'library',
    'package', 'npm', 'node', 'css', 'html', 'frontend', 'fullstack', 'devops'];

  if (technicalTerms.some((term) => lowerMsg.includes(term))) {
    return `That's a good technical question. Our team can explain this properly during a quick consultation if you'd like.`;
  }
  if (lowerMsg.includes('price') || lowerMsg.includes('cost') || lowerMsg.includes('how much')) {
    return `Pricing depends on what you need. We usually share a clear quote after understanding the project.`;
  }
  if (lowerMsg.includes('time') || lowerMsg.includes('how long') || lowerMsg.includes('deadline')) {
    return `Timelines depend on the project size. We confirm timelines before starting.`;
  }
  if (lowerMsg.includes('portfolio') || lowerMsg.includes('see work') || lowerMsg.includes('example')) {
    return `Sure, you can view our recent work here: [FrameBookss Portfolio](${FRAME_TOQUE_URLS.portfolio})`;
  }
  if (lowerMsg.includes('contact') || lowerMsg.includes('email') || lowerMsg.includes('reach')) {
    return `You can reach us here: [Contact FrameBookss](${FRAME_TOQUE_URLS.contact})`;
  }
  if (lowerMsg.includes('service') || lowerMsg.includes('what do you offer')) {
    return `We offer graphic design, web development, and video editing. Want to know more about any of these?`;
  }
  if (lowerMsg.includes('design') || lowerMsg.includes('graphic')) {
    return `We handle logos, branding, and visual designs that help businesses look professional and consistent.`;
  }
  if (lowerMsg.includes('website') || lowerMsg.includes('web') || lowerMsg.includes('develop')) {
    return `We build modern websites focused on clarity, performance, and growth. You can see our web projects here: [Web Portfolio](${FRAME_TOQUE_URLS.projects})`;
  }
  if (lowerMsg.includes('video') || lowerMsg.includes('edit')) {
    return `We edit videos for marketing, social media, and brand storytelling.`;
  }
  if (lowerMsg.includes('about') || lowerMsg.includes('who are you')) {
    return `FrameBookss is a creative agency working with brands on design, websites, and video content.`;
  }

  const defaults = [
    `Happy to help. Could you tell me a bit more about what you're planning?`,
    `That sounds interesting. What kind of result are you aiming for?`,
    `Sure. Share a little more detail so I can guide you better.`,
  ];

  return defaults[Math.floor(Math.random() * defaults.length)];
};

export async function POST(req: Request) {
  let message = '';
  let format = 'markdown';

  try {
    const body = await req.json();
    message = body.message ?? '';
    format = body.format ?? 'markdown';

    if (!message || typeof message !== 'string' || message.trim() === '') {
      const welcomeMsg = `Hello! I'm the FrameBookss AI Assistant. We specialize in photography, videography, graphic design, web development, and video editing. How can I help you today?`;

      return Response.json({
        reply: format === 'plain' ? stripMarkdown(welcomeMsg) : welcomeMsg,
        replyRaw: welcomeMsg,
        mode: 'welcome',
        links: FRAME_TOQUE_URLS,
        format,
      });
    }

    console.log(`📩 Client message: "${message}"`);

    const shouldCrawl =
      !websiteContent.lastCrawled ||
      Date.now() - new Date(websiteContent.lastCrawled).getTime() > 3600000;

    if (shouldCrawl) {
      crawlWebsite().catch(console.error);
    }

    if (!process.env.GROQ_API_KEY) {
      console.log('⚠️ No Groq API key - using trained fallback');
      await new Promise((resolve) => setTimeout(resolve, 600));

      const baseResponse = getClientFocusedResponse(message);
      const enhancedResponse = enhanceResponseWithLinks(baseResponse, message);

      return Response.json({
        reply: format === 'plain' ? stripMarkdown(enhancedResponse) : enhancedResponse,
        replyRaw: enhancedResponse,
        mode: 'trained-fallback',
        model: 'FrameBookss Training',
        crawled: websiteContent.lastCrawled,
        format,
      });
    }

    const websiteContext = Object.entries(websiteContent.pages)
      .map(([page, data]: [string, any]) =>
        `${page.toUpperCase()}: ${data.content?.substring(0, 500) ?? ''}...`
      )
      .join('\n');

    let lastError: any = null;

    for (const modelName of GROQ_MODELS) {
      try {
        console.log(`🔄 Trying Groq model: ${modelName}`);

        const completion = await getGroqClient().chat.completions.create({
          model: modelName,
          messages: [
            {
              role: 'system',
              content: `${AGENCY_TRAINING}\n\nCurrent Date: ${new Date().toISOString()}\nLast Crawled: ${websiteContent.lastCrawled || 'Never'}\n\nWebsite Content:\n${websiteContext}`,
            },
            {
              role: 'user',
              content: message,
            },
          ],
          max_tokens: 300,
          temperature: 0.7,
        });

        const rawText = completion.choices[0]?.message?.content ?? '';

        let cleanReply = rawText
          .replace(
            /^(As (FrameBookss AI Assistant|the AI assistant),?|Response:|Here(?:'s| is) (?:my |the )?response:)/i,
            ''
          )
          .trim();

        cleanReply = enhanceResponseWithLinks(cleanReply, message);

        console.log(`✅ Success with Groq model: ${modelName}`);

        return Response.json({
          reply: format === 'plain' ? stripMarkdown(cleanReply) : cleanReply,
          replyRaw: cleanReply,
          mode: 'groq',
          model: modelName,
          crawled: websiteContent.lastCrawled,
          success: true,
          format,
        });
      } catch (modelError: any) {
        lastError = modelError;
        console.log(`❌ Groq model ${modelName} failed:`, modelError.message);
        await new Promise((resolve) => setTimeout(resolve, 300));
        continue;
      }
    }

    console.error('❌ All Groq models failed:', lastError?.message);
    throw new Error(`All Groq models failed: ${lastError?.message}`);
  } catch (error: any) {
    console.error('🔥 API Error:', error.message);

    const baseResponse = getClientFocusedResponse(message);
    const enhancedResponse = enhanceResponseWithLinks(baseResponse, message);

    return Response.json({
      reply: format === 'plain' ? stripMarkdown(enhancedResponse) : enhancedResponse,
      replyRaw: enhancedResponse,
      mode: 'emergency-fallback',
      crawled: websiteContent.lastCrawled,
      error: error.message,
      format,
    });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  if (url.searchParams.get('crawl') === 'true') {
    const crawlResult = await crawlWebsite();
    return Response.json({
      service: 'FrameBookss AI Assistant',
      status: 'Active',
      provider: 'Groq',
      crawled: true,
      content: crawlResult,
      available_models: GROQ_MODELS,
      links: FRAME_TOQUE_URLS,
      note: "Use ?format=plain in POST requests for plain text responses",
    });
  }

  return Response.json({
    service: 'FrameBookss AI Assistant',
    status: 'Active',
    provider: 'Groq',
    last_crawled: websiteContent.lastCrawled,
    available_models: GROQ_MODELS,
    links: FRAME_TOQUE_URLS,
    note: "Add ?crawl=true to manually trigger website crawl. Use format='markdown' (default) or 'plain' in POST body.",
  });
}