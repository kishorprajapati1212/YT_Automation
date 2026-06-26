import fs from 'fs';
import path from 'path';
import { generateScriptAndPrompts, generateTitleVariants } from './src/services/llm.js';
import { generateVoiceover, getVoiceForPart } from './src/services/tts.js';
import { generateRealImage, generateThumbnailImage } from './src/services/image.js';
import { renderVideo } from './src/services/video.js';
import { uploadToYouTube, uploadThumbnail } from './src/services/youtube.js';
import { sleep } from './src/utils/helpers.js';
import { getStoryState, saveStoryState } from './src/utils/state.js';
import { connectDB } from './src/config/db.js';
import { VideoHistory } from './src/models/VideoHistory.js';

const OUTPUT_DIR = 'output';

// ─────────────────────────────────────────────
// SETUP OUTPUT FOLDER
// ─────────────────────────────────────────────
function prepareOutputFolder() {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR);
    } else {
        fs.readdirSync(OUTPUT_DIR).forEach(file => {
            try { fs.unlinkSync(path.join(OUTPUT_DIR, file)); } catch {}
        });
    }
    console.log("🧹 Output folder ready.");
}

// ─────────────────────────────────────────────
// GENERATE ALL SCENE IMAGES (with rate limiting)
// ─────────────────────────────────────────────
async function generateAllImages(imagePrompts) {
    console.log(`3. Generating ${imagePrompts.length} scene images...`);

    for (let i = 0; i < imagePrompts.length; i++) {
        const imgPath = path.join(OUTPUT_DIR, `img${i}.jpg`);
        console.log(`   Scene ${i + 1}/${imagePrompts.length}: "${imagePrompts[i].slice(0, 60)}..."`);

        await generateRealImage(imagePrompts[i], imgPath, i);

        // API rate limiting — deAPI needs cooldown between calls
        if (i < imagePrompts.length - 1) {
            console.log(`   ⏳ Cooldown (9s)...`);
            await sleep(9000);
        }
    }

    console.log(`   ✓ All ${imagePrompts.length} images generated.`);
}

// ─────────────────────────────────────────────
// BUILD OPTIMISED VIDEO TITLE
// ─────────────────────────────────────────────
async function buildTitle(data, state) {
    const part = state.current_part;
    const total = state.total_parts || data.total_parts || 3;

    // Use AI-generated title if available, otherwise build one
    const baseTitle = data.video_title || buildFallbackTitle(state.topic || data.topic, part, total);

    // Generate A/B variants for future testing
    try {
        const variants = await generateTitleVariants(state.topic || data.topic, part, baseTitle);
        console.log(`   🔤 Title variants generated: ${variants.variants.length}`);
        // Use recommended variant
        return variants.variants[variants.recommended] || baseTitle;
    } catch {
        return baseTitle;
    }
}

function buildFallbackTitle(topic, part, total) {
    if (part === 1) return `${topic}: The Secret They Buried (Part 1) 🕵️`;
    if (part < total) return `${topic}: It Gets Darker (Part ${part}) 🚨`;
    return `${topic}: The Shocking Truth Finally Revealed 😱`;
}

// ─────────────────────────────────────────────
// MAIN PIPELINE
// ─────────────────────────────────────────────
async function runPipeline() {
    prepareOutputFolder();
    console.log("\n🚀 YT Automation Pipeline v2 Starting...");
    console.log("══════════════════════════════════════════\n");

    try {
        await connectDB();

        // ── STEP 1: LOAD STATE & GENERATE SCRIPT ──
        let currentState = getStoryState();
        console.log(`📖 Story state: Part ${currentState.current_part}, Topic: "${currentState.topic || 'NEW'}"`);

        if (currentState.dynamicRules?.length > 0) {
            console.log(`🧠 Active learned rules: ${currentState.dynamicRules.length}`);
        }

        const data = await generateScriptAndPrompts(currentState);

        // Store topic in state after Part 1 determination
        if (currentState.current_part === 1) {
            currentState.topic = data.topic || "Unknown Mystery";
            currentState.total_parts = data.total_parts || 3;
        }

        const total = currentState.total_parts || data.total_parts || 3;

        console.log(`\n📝 Script generated:`);
        console.log(`   Topic: "${currentState.topic}"`);
        console.log(`   Part: ${currentState.current_part} of ${total}`);
        console.log(`   Words: ${data.narration?.split(' ').length || 0}`);
        console.log(`   Scenes: ${data.image_prompts?.length || 0}`);

        // ── STEP 2: GENERATE VOICEOVER ──
        const voiceIndex = getVoiceForPart(currentState.current_part);
        await generateVoiceover(data.narration, voiceIndex);

        // ── STEP 3: GENERATE SCENE IMAGES ──
        await generateAllImages(data.image_prompts);

        // ── STEP 4: GENERATE THUMBNAIL ──
        console.log("\n🖼️ Generating thumbnail...");
        const thumbnailPrompt = data.thumbnail_prompt || data.image_prompts[0];
        await generateThumbnailImage(thumbnailPrompt);

        // ── STEP 5: RENDER VIDEO ──
        console.log("\n🎬 Rendering video...");
        await renderVideo(data);
        console.log("✅ Video rendered: output/final_short.mp4");

        // ── STEP 6: BUILD OPTIMISED TITLE ──
        console.log("\n🔤 Optimising title...");
        const videoTitle = await buildTitle(data, currentState);
        console.log(`   Final title: "${videoTitle}"`);

        // ── STEP 7: UPLOAD VIDEO ──
        const videoId = await uploadToYouTube(
            path.join(OUTPUT_DIR, 'final_short.mp4'),
            { ...data, part: currentState.current_part, topic: currentState.topic },
            videoTitle
        );

        // ── STEP 8: UPLOAD THUMBNAIL ──
        if (videoId) {
            await uploadThumbnail(videoId, path.join(OUTPUT_DIR, 'thumbnail.jpg'));
        }

        console.log(`\n🎉 Upload complete!`);
        console.log(`   📺 https://www.youtube.com/shorts/${videoId}`);

        // ── STEP 9: LOG TO MONGODB ──
        console.log("\n💾 Saving to MongoDB...");
        await VideoHistory.create({
            videoId: videoId || "UNKNOWN_ID",
            part: currentState.current_part,
            topic: currentState.topic,
            scriptUsed: data.narration,
            imagePrompts: data.image_prompts,
            titleUsed: videoTitle,
            thumbnailPrompt: thumbnailPrompt,
            tags: data.video_tags || [],
            reviewed: false,
            date: new Date(),
        });
        console.log("   ✓ MongoDB record saved.");

        // ── STEP 10: UPDATE STORY STATE ──
        if (currentState.current_part < total) {
            saveStoryState({
                ...currentState,
                current_part: currentState.current_part + 1,
                total_parts: total,
                topic: currentState.topic,
                context: data.secret_climax || currentState.context,
            });
            console.log(`\n💾 Story state updated → Part ${currentState.current_part + 1} of ${total} queued.`);
        } else {
            saveStoryState({
                current_part: 1,
                total_parts: null,
                topic: "",
                context: "",
                dynamicRules: currentState.dynamicRules || [],          // ← PRESERVE LEARNED RULES
                performanceHistory: currentState.performanceHistory || [], // ← PRESERVE HISTORY
            });
            console.log(`\n💾 Series complete. Memory reset for new mystery. Rules preserved.`);
        }

        console.log("\n══════════════════════════════════════════");
        console.log("✅ Pipeline complete.");
        console.log("══════════════════════════════════════════\n");

    } catch (error) {
        console.error("\n❌ PIPELINE FAILED:", error.message);
        console.error(error.stack);

        // Save a failure log
        const failLog = {
            timestamp: new Date().toISOString(),
            error: error.message,
            stack: error.stack,
        };
        fs.writeFileSync('output/error_log.json', JSON.stringify(failLog, null, 2));
        console.log("💾 Error log saved to output/error_log.json");
    }
}

runPipeline().then(() => {
    console.log("👋 Exiting cleanly.");
    process.exit(0);
}).catch(err => {
    console.error("💥 Fatal crash:", err);
    process.exit(1);
});
