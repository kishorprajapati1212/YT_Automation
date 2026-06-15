import fs from 'fs';
import path from 'path';
import { generateScriptAndPrompts } from './src/services/llm.js';
import { generateVoiceover } from './src/services/tts.js';
import { generateRealImage } from './src/services/image.js';
import { renderVideo } from './src/services/video.js';
import { uploadToYouTube } from './src/services/youtube.js';
import { sleep } from './src/utils/helpers.js';
import { getStoryState, saveStoryState } from './src/utils/state.js';

const OUTPUT_DIR = 'output';

function clearOutputFolder() {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);
    else fs.readdirSync(OUTPUT_DIR).forEach(file => fs.unlinkSync(path.join(OUTPUT_DIR, file)));
}

async function runPipeline() {
    clearOutputFolder();
    console.log("🧹 Cache cleared. Starting pipeline...");

    try {
        // 1. Read Memory
        let currentState = getStoryState();

        // 2. Generate Script (Pass the state to the LLM)
        const data = await generateScriptAndPrompts(currentState); 

        // 3. AI Safety Nets & State Initialization
        if (currentState.current_part === 1) {
            // If the AI forgets to provide a topic or total parts, fallback safely
            currentState.topic = data.topic || "Unsolved Mystery";
            currentState.total_parts = data.total_parts || 2; 
        }
        const total = currentState.total_parts; // Store safely for the rest of the run

        // 4. Audio & BGM
        await generateVoiceover(data.narration);

        // 5. Image Generation (With Anti-Rate-Limit Shield)
        for (let i = 0; i < data.image_prompts.length; i++) {
            console.log(`Processing scene ${i + 1}/${data.image_prompts.length}...`);
            const imgPath = path.join(OUTPUT_DIR, `img${i}.jpg`);
            await generateRealImage(data.image_prompts[i], imgPath, i);
            
            // CRITICAL: Sleep for 9 seconds to completely bypass the 8-second API block
            console.log("   ⏳ Waiting 9s for API cooldown...");
            await sleep(9000); 
        }

        // 6. Final Render
        await renderVideo(data);
        console.log("✅ Video rendered: output/final_short.mp4");

        // 7. Viral Title Generator
        let videoTitle = "";
        if (currentState.current_part === 1) {
            videoTitle = `They Hid This From Us: ${currentState.topic} (Part 1) 🕵️‍♂️`;
        } else if (currentState.current_part < total) {
            videoTitle = `The Plot Thickens: ${currentState.topic} (Part ${currentState.current_part}) 🚨`;
        } else {
            videoTitle = `THE TRUTH REVEALED: ${currentState.topic} (Finale) 😱`;
        }

        // 8. YouTube Upload
        await uploadToYouTube(
            path.join(OUTPUT_DIR, 'final_short.mp4'),
            videoTitle,
            "Make sure to subscribe so you don't miss the next mystery! #shorts #history #mystery #unsolved"
        );
        console.log(`🎉 Upload complete: ${videoTitle}`);

        // 9. Update Memory For Next Run
        if (currentState.current_part < total) {
            // Story is not finished. Increment part and update context.
            saveStoryState({
                current_part: currentState.current_part + 1,
                total_parts: total,
                topic: currentState.topic,
                context: data.secret_climax || currentState.context // Carry forward context
            });
            console.log(`💾 Memory saved! Queued up Part ${currentState.current_part + 1} of ${total}.`);
        } else {
            // Story is finished. Reset brain for a brand new mystery.
            saveStoryState({ current_part: 1, total_parts: null, topic: "", context: "" });
            console.log("💾 Series complete! Reset memory for a new mystery next run.");
        }

    } catch (error) {
        console.error("❌ PIPELINE FAILED:", error.message);
    }
}

runPipeline();