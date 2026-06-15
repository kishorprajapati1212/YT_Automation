import Groq from "groq-sdk";
import { config } from '../config/env.js';

const groq = new Groq({ apiKey: config.GROQ_API_KEY });

export async function generateScriptAndPrompts(state) {
    console.log(`1. Writing Script (Generating Part ${state.current_part})...`);

    // --- 1. DYNAMIC CLIFFHANGER LOGIC ---
    let endingInstructions = "";
    if (state.current_part === 1 || (state.total_parts && state.current_part < state.total_parts)) {
        endingInstructions = `The narration MUST end on a massive, terrifying cliffhanger. Cut the story off right when it gets interesting. The absolute last sentence MUST be exactly: "But what they found next... changes everything. Subscribe for Part ${state.current_part + 1}."`;
    } else {
        endingInstructions = `This is the grand finale. Reveal the massive twist or shocking truth. The absolute last sentence MUST be exactly: "And that is the terrifying truth they tried to hide. Subscribe for more mysteries."`;
    }

    // --- 2. VISUAL CONSISTENCY LOGIC ---
    // By forcing a strict "Master Style Tag" on every single prompt, Hugging Face will generate identical looking images.
    const masterStyleTag = "cinematic dark documentary style, hyper-realistic photography, 8k resolution, moody lighting, ultra-detailed";

    const systemPrompt = `You are an elite, viral YouTube Shorts scriptwriter and AI image director. 
    You are currently writing Part ${state.current_part} of an ongoing mystery story.
    ${state.topic ? `The main topic is: ${state.topic}.` : 'Pick a brand new, highly engaging historical or unsolved mystery.'}
    ${state.context ? `Here is the secret context from the last video to continue the story: ${state.context}` : ''}

    RULES FOR SCRIPT:
    1. Write a fast-paced, highly engaging narration (around 120 words).
    2. ${endingInstructions}

    RULES FOR IMAGE PROMPTS:
    1. Generate exactly 5 highly descriptive image prompts to match the narration.
    2. CRITICAL FOR VISUAL CONSISTENCY: Every single image prompt MUST end with this exact phrase: "${masterStyleTag}".
    3. Keep character descriptions exactly the same across prompts if referring to the same person.

    OUTPUT FORMAT:
    You MUST output ONLY a raw JSON object. No markdown, no introduction.
    {
        "topic": "The Name of the Mystery",
        "total_parts": 3,
        "narration": "The full spoken script here...",
        "image_prompts": [
            "A dark forest... ${masterStyleTag}",
            "A glowing artifact... ${masterStyleTag}"
        ],
        "secret_climax": "A hidden note to yourself on where to take the story in the next part."
    }`;

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "system", content: systemPrompt }],
            model: "llama3-8b-8192", // Or whichever Groq model you prefer
            temperature: 0.7,
            response_format: { type: "json_object" }
        });

        const responseText = chatCompletion.choices[0].message.content;
        return JSON.parse(responseText);

    } catch (error) {
        console.error("❌ Groq API Error:", error.message);
        throw new Error("Failed to generate script from LLM.");
    }
}