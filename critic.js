import { connectDB } from './src/config/db.js';
import { VideoHistory } from './src/models/VideoHistory.js';
import { getVideoAnalytics } from './src/services/analytics.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from './src/config/env.js';
import { getStoryState, saveStoryState } from './src/utils/state.js'; // <-- Import state handlers

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

async function runCriticPipeline() {
    console.log("🕵️‍♂️ Critic Bot executing performance optimization scan...");

    try {
        await connectDB();

        const unreviewedVideos = await VideoHistory.find({ reviewed: false });
        if (unreviewedVideos.length === 0) {
            console.log("😴 No pending videos found in Atlas for evaluation.");
            process.exit(0);
        }

        for (let video of unreviewedVideos) {
            if (!video.videoId || video.videoId === "UNKNOWN_ID") continue;

            const uploadAge = Date.now() - new Date(video.date).getTime();
            const executionDelay = 48 * 60 * 60 * 1000; // Now waits exactly 48 hours
            if (uploadAge < executionDelay) {
                console.log(`   ⏳ Video ${video.videoId} is too fresh. Waiting for data.`);
                continue;
            }

            const stats = await getVideoAnalytics(video.videoId);
            if (!stats) {
                console.log(`   ⏳ Telemetry pending for: ${video.videoId}`);
                continue;
            }

            console.log(`🧠 Generating upgrade guidelines for Part ${video.part}...`);

            const criticPrompt = `You are an elite YouTube Shorts Growth Analyst. Analyze this data profile and write a strict directive rule for the next script generation to fix retention dropoffs.

            HISTORICAL INPUTS:
            - Series Topic: ${video.topic}
            - Current Part: ${video.part}
            - Script Spoken: "${video.scriptUsed}"

            YOUTUBE STUDIO PERFORMANCE DATA:
            - Total Human Views: ${stats.views}
            - Total Likes: ${stats.likes}
            - Average View Duration: ${stats.avgDurationSeconds} seconds
            - Audience Retention Rate: ${stats.retentionPercentage}%

            OUTPUT SPECIFICATION:
            Return ONLY a raw JSON object. Do not wrap it in markdown block tags.
            {
                "critique": "A brief explanation of why the data looks this way.",
                "actionable_directive": "A single sentence starting with 'Rule: ...' to enforce structural modifications to the next script writing process."
            }`;

            const model = genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
                generationConfig: { responseMimeType: "application/json" }
            });

            const result = await model.generateContent(criticPrompt);
            const dataEvaluation = JSON.parse(result.response.text());

            console.log(`📝 System Critique: ${dataEvaluation.critique}`);
            console.log(`🎯 New Upgradable Guardrail: ${dataEvaluation.actionable_directive}`);

            // --- LOAD, UPDATE, AND SAVE SINGLE STORY STATE OBJECT ---
            let currentState = getStoryState();
            
            if (!currentState.dynamicRules) {
                currentState.dynamicRules = [];
            }

            currentState.dynamicRules.push(dataEvaluation.actionable_directive);
            if (currentState.dynamicRules.length > 10) currentState.dynamicRules.shift(); // Keep last 10 rules

            // Save state back to the central configuration tracking file
            saveStoryState(currentState);
            console.log("   ✅ Story state dynamically optimized with new retention rule.");

            // Mark document complete in Atlas
            video.reviewed = true;
            await video.save();
            console.log(`   ✅ Video ${video.videoId} marked reviewed in MongoDB.`);
            break; 
        }

        process.exit(0);
    } catch (error) {
        console.error("❌ CRITIC PIPELINE ERROR:", error.message);
        process.exit(1);
    }
}

runCriticPipeline();