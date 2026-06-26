import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from '../config/env.js';

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

// ─────────────────────────────────────────────
// HOOK BANK — proven opening formulas
// ─────────────────────────────────────────────
const HOOK_FORMULAS = [
    "The government classified this for {N} years.",
    "Nobody talks about what really happened in {YEAR}.",
    "Scientists found this and immediately went silent.",
    "This single discovery changed everything we knew about {TOPIC}.",
    "3 people knew the truth. All 3 disappeared.",
    "They tried to erase this from history. They failed.",
    "What they found underground in {PLACE} kept experts up at night.",
    "This footage was never supposed to go public.",
];

// ─────────────────────────────────────────────
// Trending topic categories for variety
// ─────────────────────────────────────────────
const TOPIC_CATEGORIES = [
    "ancient civilizations and lost cities",
    "government cover-ups and classified programs",
    "unexplained natural phenomena",
    "conspiracy theories with real evidence",
    "historical events that were hidden from textbooks",
    "space anomalies and NASA secrets",
    "unsolved disappearances and cold cases",
    "secret societies and hidden power structures",
];

export async function generateScriptAndPrompts(state) {
    console.log(`1. Writing AI-optimized script (Part ${state.current_part})...`);

    // ── BUILD LEARNED DIRECTIVES ──
    let learnedDirectives = "";
    if (state.dynamicRules && state.dynamicRules.length > 0) {
        learnedDirectives = `\n\n⚠️ MANDATORY PERFORMANCE RULES FROM PAST ANALYTICS:\n${state.dynamicRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}\nThese rules MUST be enforced or viewer retention will suffer.`;
    }

    // ── PICK ENDING ──
    let endingInstructions = "";
    const part = state.current_part;
    const total = state.total_parts;

    if (!total || part < total) {
        endingInstructions = `The narration MUST end with a devastating cliffhanger. Cut right at peak tension. Final sentence MUST be: "Subscribe NOW — Part ${part + 1} drops tomorrow. You're not ready."`;
    } else {
        endingInstructions = `This is the finale. Drop the biggest revelation. Final sentence MUST be: "The truth was hidden in plain sight the whole time. Subscribe for the next mystery."`;
    }

    // ── VISUAL STYLE ──
    const masterStyleTag = "cinematic hyper-realistic photography, dramatic chiaroscuro lighting, 8K resolution, ultra-detailed textures, award-winning documentary still";

    // ── TOPIC VARIETY ──
    const categoryHint = !state.topic
        ? `Pick from one of these compelling categories: ${TOPIC_CATEGORIES[Math.floor(Math.random() * TOPIC_CATEGORIES.length)]}`
        : `Continue the "${state.topic}" story arc.`;

    const systemPrompt = `You are a world-class YouTube Shorts scriptwriter who specialises in viral retention-engineered content. Your videos average 75%+ retention. You understand pacing, visual storytelling, and psychological hooks deeply.

CONTEXT:
- Writing Part ${part} of an ongoing mystery series.
- ${categoryHint}
- ${state.context ? `Story so far: ${state.context}` : 'This is Part 1 — establish the mystery powerfully.'}
${learnedDirectives}

════════════════════════════════════════════
SCRIPT RULES (NON-NEGOTIABLE):
════════════════════════════════════════════
1. Total word count: 90–110 words (optimal for 50–60 second Shorts retention).
2. HOOK: First sentence must be instantly terrifying or mind-bending. Use one of these proven formulas if natural: ${HOOK_FORMULAS.slice(0, 3).join(' | ')}.
3. PACING: Short, punchy sentences. Maximum 12 words per sentence. Vary lengths.
4. No filler words. Every sentence must EARN its place.
5. NO AI CLICHÉS: Never use "delve", "imagine", "realm", "tapestry", "it's important to note", "fascinating".
6. Build tension progressively — each sentence raises stakes.
7. ${endingInstructions}
8. EMOTION: The viewer must FEEL urgency, dread, or wonder every 3 seconds.

════════════════════════════════════════════
IMAGE PROMPT RULES (CRITICAL FOR WATCH TIME):
════════════════════════════════════════════
1. Generate EXACTLY ONE image prompt per sentence in the script.
2. Every image must PRECISELY match its sentence's action/emotion — tight narrative sync.
3. IMAGE 1 (THUMBNAIL): Must be an extreme close-up with maximum visual intrigue — high contrast, mysterious expression or object, cinematic framing. This is what gets the click.
4. Every prompt must show MOTION or ACTION (e.g. "ancient stone door creaking open", "researcher's hand trembling as they hold the document").
5. Use DIVERSE shot types: extreme close-up, wide establishing, Dutch angle, over-the-shoulder, aerial, macro.
6. Add ONE atmospheric detail per prompt (e.g. "dust particles catching morning light", "breath fogging in cold underground air").
7. Every prompt MUST end with: "${masterStyleTag}".

════════════════════════════════════════════
SEO & METADATA RULES:
════════════════════════════════════════════
1. Title: Power word + curiosity gap + number or timeframe. Under 60 chars. NO CAPS LOCK SPAM.
2. Description: 3 punchy sentences. Include 2 natural keyword phrases. End with CTA.
3. Tags: Mix of broad (#mystery #shorts) and specific long-tail tags. 15 tags max.

════════════════════════════════════════════
OUTPUT FORMAT (RAW JSON ONLY, NO MARKDOWN):
════════════════════════════════════════════
{
    "topic": "The Name of the Mystery",
    "total_parts": 3,
    "narration": "Full spoken script here...",
    "image_prompts": [
        "Prompt for sentence 1... ${masterStyleTag}",
        "Prompt for sentence 2... ${masterStyleTag}"
    ],
    "thumbnail_prompt": "Separate ultra-optimised thumbnail image description. Must be extreme close-up, high contrast, emotionally charged, maximally clickable. ${masterStyleTag}",
    "video_title": "SEO-optimised title under 60 chars",
    "video_description": "3-sentence engaging description with keywords and CTA. Include relevant hashtags at end.",
    "video_tags": ["mystery", "shorts", "history", "unsolved", "conspiracy"],
    "secret_climax": "Internal note: key reveal to continue story in next part."
}`;

    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.9,      // Higher creativity
                topP: 0.95,
                topK: 64,
            }
        });

        const result = await model.generateContent(systemPrompt);
        const responseText = result.response.text();
        const parsed = JSON.parse(responseText);

        // Validate output quality
        const wordCount = parsed.narration?.split(' ').length || 0;
        console.log(`   ✓ Script generated: ${wordCount} words, ${parsed.image_prompts?.length} scenes`);

        if (wordCount < 70) {
            console.warn(`   ⚠️ Script too short (${wordCount} words). Regenerating...`);
            return generateScriptAndPrompts(state); // retry once
        }

        return parsed;

    } catch (error) {
        console.error("❌ Gemini API Error:", error.message);
        throw new Error("Failed to generate script from LLM.");
    }
}

// ─────────────────────────────────────────────
// TITLE OPTIMIZER — generates A/B title variants
// ─────────────────────────────────────────────
export async function generateTitleVariants(topic, part, baseTitle) {
    console.log("   🔤 Generating A/B title variants...");
    const prompt = `You are a YouTube title optimisation expert. Generate 3 alternative title variants for this video.

Topic: ${topic}
Part: ${part}
Current Title: ${baseTitle}

Rules:
- Each title must be under 60 characters
- Use psychological triggers: curiosity gap, numbers, urgency, fear
- Vary the hook style across the 3 variants
- No clickbait that overpromises

Output ONLY raw JSON:
{
    "variants": ["Title 1", "Title 2", "Title 3"],
    "recommended": 0
}`;

    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });
        const result = await model.generateContent(prompt);
        return JSON.parse(result.response.text());
    } catch {
        return { variants: [baseTitle], recommended: 0 };
    }
}
