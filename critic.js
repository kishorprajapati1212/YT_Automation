import { connectDB } from './src/config/db.js';
import { VideoHistory } from './src/models/VideoHistory.js';
import { getVideoAnalytics } from './src/services/analytics.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from './src/config/env.js';
import { getStoryState, saveStoryState } from './src/utils/state.js';

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

// ─────────────────────────────────────────────
// PERFORMANCE BENCHMARKS for YouTube Shorts
// ─────────────────────────────────────────────
const BENCHMARKS = {
    views_good: 1000,           // 1k+ views in 48h = strong
    views_ok: 300,              // 300+ = acceptable
    retention_good: 65,         // 65%+ retention = very good
    retention_ok: 45,           // 45%+ = acceptable
    likes_ratio_good: 0.05,     // 5%+ like rate = excellent
    likes_ratio_ok: 0.02,       // 2%+ = decent
};

// ─────────────────────────────────────────────
// SCORE CALCULATOR
// ─────────────────────────────────────────────
function scoreVideo(stats) {
    let score = 0;
    const details = [];

    // Views score (40 points)
    if (stats.views >= BENCHMARKS.views_good) { score += 40; details.push("✅ Strong view count"); }
    else if (stats.views >= BENCHMARKS.views_ok) { score += 20; details.push("⚠️ Moderate views"); }
    else { score += 0; details.push("❌ Low views — hook or thumbnail likely weak"); }

    // Retention score (40 points)
    if (stats.retentionPercentage >= BENCHMARKS.retention_good) { score += 40; details.push("✅ Excellent retention"); }
    else if (stats.retentionPercentage >= BENCHMARKS.retention_ok) { score += 20; details.push("⚠️ Mid retention — pacing may drop mid-video"); }
    else { score += 0; details.push("❌ Poor retention — viewers dropping early"); }

    // Like ratio score (20 points)
    const likeRatio = stats.views > 0 ? stats.likes / stats.views : 0;
    if (likeRatio >= BENCHMARKS.likes_ratio_good) { score += 20; details.push("✅ High engagement rate"); }
    else if (likeRatio >= BENCHMARKS.likes_ratio_ok) { score += 10; details.push("⚠️ Average engagement"); }
    else { score += 0; details.push("❌ Low likes — content not resonating emotionally"); }

    return { score, details, likeRatio: (likeRatio * 100).toFixed(1) };
}

// ─────────────────────────────────────────────
// DIAGNOSIS TEMPLATES
// Fast pattern-matching before sending to AI
// ─────────────────────────────────────────────
function diagnosePatterns(stats, scoring) {
    const patterns = [];

    if (stats.retentionPercentage < 40 && stats.views > 200) {
        patterns.push("EARLY_DROP_OFF: High impressions but viewers leaving before 50% — first 5 seconds (hook + first image) must be more shocking.");
    }
    if (stats.views < 200) {
        patterns.push("LOW_REACH: YouTube is not distributing this video — title/thumbnail CTR is likely below 3%. Next video needs a more curiosity-gap title and extreme close-up thumbnail.");
    }
    if (stats.likes / Math.max(stats.views, 1) < 0.02 && stats.retentionPercentage > 50) {
        patterns.push("LOW_EMOTION: Good watch time but few likes — script needs stronger emotional payoff and an explicit like CTA within the narration.");
    }
    if (stats.avgDurationSeconds < 20) {
        patterns.push("TOO_SHORT: Average view under 20s means the video is ending before viewers can engage. Aim for 50-60 second scripts.");
    }

    return patterns;
}

// ─────────────────────────────────────────────
// MAIN CRITIC PIPELINE
// ─────────────────────────────────────────────
async function runCriticPipeline() {
    console.log("🕵️ Critic Bot — Performance Optimisation Scan");
    console.log("──────────────────────────────────────────────");

    try {
        await connectDB();

        const unreviewedVideos = await VideoHistory.find({ reviewed: false }).sort({ date: 1 });
        if (unreviewedVideos.length === 0) {
            console.log("😴 No pending videos to evaluate.");
            process.exit(0);
        }

        console.log(`📋 Found ${unreviewedVideos.length} video(s) awaiting review.`);

        let rulesAdded = 0;

        for (let video of unreviewedVideos) {
            if (!video.videoId || video.videoId === "UNKNOWN_ID") {
                console.log(`   ⏭️ Skipping video with no ID.`);
                continue;
            }

            // Only review after 48 hours (YouTube analytics need time to stabilise)
            const uploadAge = Date.now() - new Date(video.date).getTime();
            const MIN_AGE_MS = 48 * 60 * 60 * 1000;
            if (uploadAge < MIN_AGE_MS) {
                const hoursLeft = ((MIN_AGE_MS - uploadAge) / 3600000).toFixed(1);
                console.log(`   ⏳ "${video.topic}" (Part ${video.part}) — ${hoursLeft}h until review.`);
                continue;
            }

            console.log(`\n🔍 Reviewing: "${video.topic}" Part ${video.part} [${video.videoId}]`);

            const stats = await getVideoAnalytics(video.videoId);
            if (!stats) {
                console.log(`   ⚠️ Analytics not yet available for ${video.videoId}`);
                continue;
            }

            // Score the video
            const scoring = scoreVideo(stats);
            const patterns = diagnosePatterns(stats, scoring);

            console.log(`\n   📊 PERFORMANCE REPORT:`);
            console.log(`   ├─ Views: ${stats.views} | Likes: ${stats.likes} | Like Rate: ${scoring.likeRatio}%`);
            console.log(`   ├─ Avg Duration: ${stats.avgDurationSeconds.toFixed(1)}s | Retention: ${stats.retentionPercentage.toFixed(1)}%`);
            console.log(`   ├─ Score: ${scoring.score}/100`);
            scoring.details.forEach(d => console.log(`   │  ${d}`));
            if (patterns.length > 0) {
                console.log(`   └─ Patterns Detected:`);
                patterns.forEach(p => console.log(`      → ${p}`));
            }

            // ── AI DEEP ANALYSIS ──
            console.log(`\n   🧠 Running AI deep analysis...`);

            const criticPrompt = `You are an elite YouTube Shorts growth strategist. Your job is to generate a SINGLE actionable improvement directive based on real analytics data.

VIDEO DATA:
- Topic: "${video.topic}"
- Part: ${video.part}
- Script Used: "${video.scriptUsed}"
- Image Prompts Used: ${JSON.stringify(video.imagePrompts?.slice(0, 3))}

YOUTUBE ANALYTICS:
- Views: ${stats.views}
- Likes: ${stats.likes}
- Like Rate: ${scoring.likeRatio}%
- Average View Duration: ${stats.avgDurationSeconds.toFixed(1)} seconds
- Retention Percentage: ${stats.retentionPercentage.toFixed(1)}%
- Performance Score: ${scoring.score}/100

PATTERN ANALYSIS: ${patterns.length > 0 ? patterns.join(' | ') : 'No specific patterns detected.'}

BENCHMARKS FOR CONTEXT:
- Good: 1000+ views, 65%+ retention, 5%+ like rate
- Acceptable: 300+ views, 45%+ retention, 2%+ like rate
- This video is ${scoring.score >= 60 ? 'ABOVE AVERAGE' : scoring.score >= 30 ? 'BELOW AVERAGE' : 'UNDERPERFORMING'}.

YOUR TASK:
Based on the weakest metric, generate EXACTLY ONE improvement directive for the next script.
Be highly specific about what to CHANGE (not just generic advice).
The directive should target either: hook quality, image prompt style, script pacing, emotional payoff, or title strategy.

Output ONLY raw JSON:
{
    "weakest_metric": "views|retention|likes",
    "critique": "1-2 sentence root cause analysis",
    "actionable_directive": "Rule: [specific single-sentence instruction starting with Rule: that can be applied to the next script generation]",
    "confidence": "high|medium|low"
}`;

            const model = genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.3,   // Low temp — we want consistent, factual analysis
                }
            });

            const result = await model.generateContent(criticPrompt);
            const analysis = JSON.parse(result.response.text());

            console.log(`\n   📝 AI Critique: ${analysis.critique}`);
            console.log(`   🎯 New Rule [${analysis.confidence} confidence]: ${analysis.actionable_directive}`);

            // ── SAVE RULE TO STATE ──
            let currentState = getStoryState();
            if (!currentState.dynamicRules) currentState.dynamicRules = [];
            if (!currentState.performanceHistory) currentState.performanceHistory = [];

            // Add rule (avoid duplicates)
            const ruleText = analysis.actionable_directive;
            if (!currentState.dynamicRules.includes(ruleText)) {
                currentState.dynamicRules.push(ruleText);
                rulesAdded++;
            }

            // Keep only last 10 rules (rolling window)
            if (currentState.dynamicRules.length > 10) {
                currentState.dynamicRules = currentState.dynamicRules.slice(-10);
            }

            // Log performance history for trend analysis
            currentState.performanceHistory.push({
                videoId: video.videoId,
                topic: video.topic,
                part: video.part,
                score: scoring.score,
                views: stats.views,
                retention: stats.retentionPercentage,
                likeRate: parseFloat(scoring.likeRatio),
                date: new Date().toISOString(),
            });

            // Keep last 20 history entries
            if (currentState.performanceHistory.length > 20) {
                currentState.performanceHistory = currentState.performanceHistory.slice(-20);
            }

            saveStoryState(currentState);
            console.log(`   ✅ Rule saved. Total active rules: ${currentState.dynamicRules.length}`);

            // Mark reviewed
            video.reviewed = true;
            video.performanceScore = scoring.score;
            video.analyticsSnapshot = stats;
            await video.save();
            console.log(`   ✅ Video marked reviewed in MongoDB.`);
        }

        // ── TREND REPORT ──
        const state = getStoryState();
        if (state.performanceHistory?.length >= 3) {
            const recent = state.performanceHistory.slice(-5);
            const avgScore = (recent.reduce((s, v) => s + v.score, 0) / recent.length).toFixed(0);
            const trend = state.performanceHistory.length >= 6
                ? (recent.reduce((s,v) => s + v.score, 0)/recent.length) >
                  (state.performanceHistory.slice(-10,-5).reduce((s,v) => s + v.score, 0)/Math.min(5, state.performanceHistory.length-5))
                    ? "📈 IMPROVING" : "📉 DECLINING"
                : "📊 BUILDING DATA";

            console.log(`\n📈 CHANNEL TREND: ${trend} | Avg Score (last ${recent.length} videos): ${avgScore}/100`);
        }

        console.log(`\n✅ Critic run complete. ${rulesAdded} new rule(s) added.`);
        process.exit(0);

    } catch (error) {
        console.error("❌ CRITIC PIPELINE ERROR:", error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

runCriticPipeline();
