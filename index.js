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
        let currentState = getStoryState();
        const data = await generateScriptAndPrompts(currentState); 

        if (currentState.current_part === 1) {
            currentState.topic = data.topic || "Unsolved Mystery";
            currentState.total_parts = data.total_parts || 2; 
        }
        const total = currentState.total_parts; 

        await generateVoiceover(data.narration);

        for (let i = 0; i < data.image_prompts.length; i++) {
            console.log(`Processing scene ${i + 1}/${data.image_prompts.length}...`);
            const imgPath = path.join(OUTPUT_DIR, `img${i}.jpg`);
            await generateRealImage(data.image_prompts[i], imgPath, i);
            
            console.log("   ⏳ Waiting 9s for API cooldown...");
            await sleep(9000); 
        }

        await renderVideo(data);
        console.log("✅ Video rendered: output/final_short.mp4");

        let videoTitle = "";
        if (currentState.current_part === 1) {
            videoTitle = `They Hid This From Us: ${currentState.topic} (Part 1) 🕵️‍♂️`;
        } else if (currentState.current_part < total) {
            videoTitle = `The Plot Thickens: ${currentState.topic} (Part ${currentState.current_part}) 🚨`;
        } else {
            videoTitle = `THE TRUTH REVEALED: ${currentState.topic} (Finale) 😱`;
        }

        // Upload and capture the ID
        const videoId = await uploadToYouTube(
            path.join(OUTPUT_DIR, 'final_short.mp4'),
            videoTitle,
            "Make sure to subscribe so you don't miss the next mystery! #shorts #history #mystery #unsolved"
        );
        console.log(`🎉 Upload complete: ${videoTitle}`);

        // --- NEW: LOCAL LEDGER SAVE ---
        console.log("💾 Saving Video ID to local history...");
        let history = [];
        if (fs.existsSync('history.json')) {
            history = JSON.parse(fs.readFileSync('history.json', 'utf8'));
        }
        history.push({
            videoId: videoId || "FAILED_ID",
            part: currentState.current_part,
            date: new Date().toISOString()
        });
        fs.writeFileSync('history.json', JSON.stringify(history, null, 2));

        // Update Memory
        if (currentState.current_part < total) {
            saveStoryState({
                current_part: currentState.current_part + 1,
                total_parts: total,
                topic: currentState.topic,
                context: data.secret_climax || currentState.context 
            });
            console.log(`💾 Memory saved! Queued up Part ${currentState.current_part + 1} of ${total}.`);
        } else {
            saveStoryState({ current_part: 1, total_parts: null, topic: "", context: "" });
            console.log("💾 Series complete! Reset memory for a new mystery next run.");
        }

    } catch (error) {
        console.error("❌ PIPELINE FAILED:", error.message);
    }
}

runPipeline();