import fs from 'fs';
import path from 'path';
import { generateScriptAndPrompts } from './src/services/llm.js';
import { generateVoiceover } from './src/services/tts.js';
import { generateRealImage } from './src/services/image.js';
import { renderVideo } from './src/services/video.js';
import { uploadToYouTube } from './src/services/youtube.js';
import { sleep } from './src/utils/helpers.js';
import { getStoryState, saveStoryState } from './src/utils/state.js';

// Database Connections
import { connectDB } from './src/config/db.js';
import { VideoHistory } from './src/models/VideoHistory.js';

const OUTPUT_DIR = 'output';

function clearOutputFolder() {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);
    else fs.readdirSync(OUTPUT_DIR).forEach(file => fs.unlinkSync(path.join(OUTPUT_DIR, file)));
}

async function runPipeline() {
    clearOutputFolder();
    console.log("🧹 Cache cleared. Starting pipeline...");

    try {
        // Connect to MongoDB Atlas
        await connectDB();

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

        // Upload and grab the ID
        const videoId = await uploadToYouTube(
            path.join(OUTPUT_DIR, 'final_short.mp4'),
            videoTitle,
            "Make sure to subscribe so you don't miss the next mystery! #shorts #history #mystery #unsolved"
        );
        console.log(`🎉 Upload complete: ${videoTitle}`);

        // SAVE LOGS DIRECTLY TO MONGO ATLAS
        console.log("💾 Writing record to MongoDB Atlas...");
        await VideoHistory.create({
            videoId: videoId || "UNKNOWN_ID",
            part: currentState.current_part,
            topic: currentState.topic,
            scriptUsed: data.narration,
            imagePrompts: data.image_prompts,
            reviewed: false,
            date: new Date()
        });
        console.log("   ✅ MongoDB ledger saved successfully.");

        // Update Memory State
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

// THIS COMMAND STOPS THE SCRIPT FROM HANGING
runPipeline().then(() => {
    console.log("👋 Pipeline finished all tasks. Exiting cleanly.");
    process.exit(0); // <--- This forces Node.js to close the terminal immediately
}).catch(err => {
    console.error("💥 Critical execution crash:", err);
    process.exit(1);
});