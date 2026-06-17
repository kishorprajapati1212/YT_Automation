import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from '../config/env.js';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

export async function generateScriptAndPrompts(state) {
    console.log(`1. Writing Script (Generating Part ${state.current_part})...`);

    // --- READ SELF-UPGRADED RULES DIRECTLY FROM STATE ---
    let learnedDirectives = "";
    if (state.dynamicRules && state.dynamicRules.length > 0) {
        learnedDirectives = `\n\nCRITICAL STRATEGIC RULES FROM YOUR PAST PERFORMANCE CRITIQUES:\n${state.dynamicRules.join('\n')}\nYou must strictly follow these optimization rules to preserve audience retention and fix your historical drop-offs.`;
    }

    let endingInstructions = "";
    if (state.current_part === 1 || (state.total_parts && state.current_part < state.total_parts)) {
        endingInstructions = `The narration MUST end on a massive, terrifying cliffhanger. Cut the story off right when it gets interesting. The absolute last sentence MUST be exactly: "But what they found next... changes everything. Subscribe for Part ${state.current_part + 1}."`;
    } else {
        endingInstructions = `This is the grand finale. Reveal the massive twist or shocking truth. The absolute last sentence MUST be exactly: "And that is the terrifying truth they tried to hide. Subscribe for more mysteries."`;
    }

    const masterStyleTag = "cinematic dark documentary style, hyper-realistic photography, 8k resolution, moody lighting, ultra-detailed";

    const systemPrompt = `You are a ruthless, highly-paid YouTube Shorts scriptwriter and AI visual director. Your content balances high-quality storytelling with rapid visual pacing.
    You are currently writing Part ${state.current_part} of an ongoing mystery story.
    ${state.topic ? `The main topic is: ${state.topic}.` : 'Pick a brand new, highly engaging historical or unsolved mystery.'}
    ${state.context ? `Here is the secret context from the last video to continue the story: ${state.context}` : ''}
    ${learnedDirectives}

    RULES FOR SCRIPT (HIGH RETENTION & PACING):
    1. Write a highly engaging, fast-paced script between 80 and 100 words (perfect for a 40-50 second Short).
    2. NO AI SPEAK. Do not use words like "delve", "imagine", or "realm". 
    3. Write in short, aggressive, punchy sentences. Maximum 10 words per sentence.
    4. Start immediately with a terrifying or mind-bending hook. No introductions.
    5. ${endingInstructions}

    RULES FOR IMAGE PROMPTS (NARRATIVE SYNC):
    1. Generate EXACTLY ONE image prompt for EVERY SINGLE SENTENCE in your script. (If your script has 8 sentences, output 8 image prompts).
    2. Every image must perfectly match the exact action happening in its corresponding sentence.
    3. THUMBNAIL HACK: The FIRST image prompt MUST be an extreme close-up, highly intriguing, high-contrast image.
    4. MOVEMENT: Describe every image as mid-action (e.g., "running", "falling", "wind blowing violently").
    5. Every single image prompt MUST end with this exact phrase: "${masterStyleTag}".

    OUTPUT FORMAT:
    You MUST output ONLY a raw JSON object. No markdown.
    {
        "topic": "The Name of the Mystery",
        "total_parts": 3,
        "narration": "The full spoken script here...",
        "image_prompts": [
            "Image for sentence 1... ${masterStyleTag}",
            "Image for sentence 2... ${masterStyleTag}",
            "Image for sentence 3... ${masterStyleTag}"
        ],
        "secret_climax": "A hidden note to yourself on where to take the story in the next part."
    }`;

    try {
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" } 
        });

        const result = await model.generateContent(systemPrompt);
        const responseText = result.response.text();
        
        return JSON.parse(responseText);

    } catch (error) {
        console.error("❌ Gemini API Error:", error.message);
        throw new Error("Failed to generate script from LLM.");
    }
}