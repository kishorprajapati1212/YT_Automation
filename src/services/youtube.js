import { google } from 'googleapis';
import fs from 'fs';
import { config } from '../config/env.js';

// ─────────────────────────────────────────────
// TAGS LIBRARY — mix of broad + niche
// ─────────────────────────────────────────────
const BASE_TAGS = [
    'shorts', 'youtubeshorts', 'mystery', 'history', 'facts',
    'conspiracy', 'unsolved', 'secret', 'hidden history',
    'mind blowing facts', 'scary history', 'dark history',
    'historical mysteries', 'conspiracy theory', 'truth',
];

// ─────────────────────────────────────────────
// CREATE AUTH CLIENT
// ─────────────────────────────────────────────
function createAuthClient() {
    const oAuth2Client = new google.auth.OAuth2(
        config.CLIENT_ID,
        config.CLIENT_SECRET,
        "http://localhost"
    );
    oAuth2Client.setCredentials({ refresh_token: config.REFRESH_TOKEN });
    return oAuth2Client;
}

// ─────────────────────────────────────────────
// UPLOAD VIDEO
// ─────────────────────────────────────────────
export async function uploadToYouTube(filePath, data, titleOverride = null) {
    const auth = createAuthClient();
    const youtube = google.youtube({ version: 'v3', auth });

    const title = titleOverride || data.video_title || buildDefaultTitle(data);
    const description = data.video_description || buildDefaultDescription(data);
    const tags = buildTags(data.video_tags || []);

    console.log(`🚀 Uploading: "${title}"`);
    console.log(`   Tags: ${tags.slice(0, 5).join(', ')}...`);

    const res = await youtube.videos.insert({
        part: 'snippet,status',
        requestBody: {
            snippet: {
                title,
                description,
                tags,
                categoryId: '22',       // People & Blogs (good for Shorts/mystery content)
                defaultLanguage: 'en',
                defaultAudioLanguage: 'en',
            },
            status: {
                privacyStatus: 'public',
                selfDeclaredMadeForKids: false,
                madeForKids: false,
            }
        },
        media: {
            body: fs.createReadStream(filePath)
        }
    });

    const videoId = res.data.id;
    console.log(`   ✓ Video ID: ${videoId}`);
    console.log(`   🔗 https://www.youtube.com/shorts/${videoId}`);

    return videoId;
}

// ─────────────────────────────────────────────
// UPLOAD CUSTOM THUMBNAIL
// ─────────────────────────────────────────────
export async function uploadThumbnail(videoId, thumbnailPath) {
    if (!fs.existsSync(thumbnailPath)) {
        console.log("   ⚠️ No thumbnail file found, skipping.");
        return;
    }

    try {
        const auth = createAuthClient();
        const youtube = google.youtube({ version: 'v3', auth });

        await youtube.thumbnails.set({
            videoId,
            media: {
                mimeType: 'image/jpeg',
                body: fs.createReadStream(thumbnailPath)
            }
        });
        console.log("   ✓ Custom thumbnail uploaded.");
    } catch (err) {
        // Thumbnail upload requires verified channel — don't crash if it fails
        console.warn(`   ⚠️ Thumbnail upload failed: ${err.message}`);
    }
}

// ─────────────────────────────────────────────
// TAG BUILDER
// ─────────────────────────────────────────────
function buildTags(aiTags) {
    const combined = [...new Set([...aiTags, ...BASE_TAGS])];
    // YouTube allows max 500 chars total in tags
    let total = 0;
    const filtered = [];
    for (const tag of combined) {
        total += tag.length + 1;
        if (total > 490) break;
        filtered.push(tag);
    }
    return filtered;
}

// ─────────────────────────────────────────────
// FALLBACK TITLE / DESCRIPTION builders
// ─────────────────────────────────────────────
function buildDefaultTitle(data) {
    const part = data.part || 1;
    const topic = data.topic || "Hidden Truth";
    const suffixes = [
        `Part ${part}: The Secret Is Out`,
        `Part ${part}: They Don't Want You To Know`,
        `Part ${part}: The Truth Is Darker`,
        `Part ${part}: The Mystery Deepens`,
    ];
    const suffix = suffixes[(part - 1) % suffixes.length];
    return `${topic} — ${suffix}`.slice(0, 99);
}

function buildDefaultDescription(data) {
    const topic = data.topic || "this mystery";
    return [
        `The truth about ${topic} has been hidden for decades — until now.`,
        `Every detail in this video is verified. Subscribe so you don't miss what comes next.`,
        `#shorts #mystery #history #unsolved #conspiracy #facts #hiddentruth`
    ].join(' ');
}
