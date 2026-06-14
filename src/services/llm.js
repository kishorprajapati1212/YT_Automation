import Groq from 'groq-sdk';
import { config } from '../config/env.js';

const groq = new Groq({ apiKey: config.GROQ_API_KEY });

export async function generateScriptAndPrompts(state) {
    console.log(`1. Writing Script (Generating Part ${state.current_part} of ${state.total_parts || '?'})...`);
    
    let promptText = "";

    if (state.current_part === 1) {
        // MODE 1: THE HOOK
        promptText = `You are a viral YouTube Shorts creator. Start a multi-part historical mystery or bizarre fact series.
        Target: Ages 12-99, PG-13.
        
        CRITICAL RULES:
        - Introduce an incredible, unsolved-sounding mystery.
        - End on a massive CLIFFHANGER (e.g., "But what they found inside... we'll reveal in Part 2!").
        - Decide how many parts this story needs to be told properly (choose between 2, 3, 4, or 5).
        - Narration must be 100-140 words.
        
        Return ONLY a JSON object with:
        1. "narration": The script.
        2. "image_prompts": Array of exactly 8 descriptive image prompts.
        3. "topic": A short 3-5 word title for this series.
        4. "total_parts": Integer between 2 and 5.
        5. "secret_climax": A master summary of where the story is heading, so you remember it for future parts.`;

    } else if (state.current_part < state.total_parts) {
        // MODE 2: THE MIDDLE (Twists and Escalation)
        promptText = `You are a viral YouTube Shorts creator. Write Part ${state.current_part} of a ${state.total_parts}-part historical mystery.
        Topic: ${state.topic}
        Master Context & Plot: ${state.context}
        
        CRITICAL RULES:
        - Hook the viewer instantly ("Welcome back to Part ${state.current_part} of...").
        - Reveal a massive twist or escalate the mystery based on the Master Context. Do NOT reveal the final ending yet.
        - End on ANOTHER massive cliffhanger for the next part!
        - Narration must be 100-140 words.
        
        Return ONLY a JSON object with:
        1. "narration": The script.
        2. "image_prompts": Array of exactly 8 descriptive image prompts.
        3. "secret_climax": Pass the Master Context back, adding a note about where you just left off.`;

    } else {
        // MODE 3: THE FINALE
        promptText = `You are a viral YouTube Shorts creator. Write the FINALE (Part ${state.current_part} of ${state.total_parts}) of a historical mystery.
        Topic: ${state.topic}
        Master Context & Story So Far: ${state.context}
        
        CRITICAL RULES:
        - Welcome them to the finale ("This is the finale of...").
        - Reveal the massive climax, the truth, or the final twist.
        - End with a satisfying conclusion and ask them to subscribe for the next mystery.
        - Narration must be 100-140 words.
        
        Return ONLY a JSON object with:
        1. "narration": The script.
        2. "image_prompts": Array of exactly 8 descriptive image prompts.`;
    }

    const completion = await groq.chat.completions.create({
        messages: [{ role: "user", content: promptText }],
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" }
    });
    
    return JSON.parse(completion.choices[0].message.content);
}