import https from 'https';
import fs from 'fs';
import { config } from '../config/env.js';

// ─────────────────────────────────────────────
// IMAGE QUALITY ENHANCER
// Appends cinematic modifiers to every prompt
// ─────────────────────────────────────────────
function enhancePrompt(prompt, index, isFirstImage) {
    const negativeKeywords = "blurry, watermark, text overlay, logo, cartoon, anime, painting, illustration, low quality, distorted face";
    
    // First image gets extra thumbnail-optimisation treatment
    const thumbnailBoost = isFirstImage
        ? "extreme close-up, maximum visual impact, high contrast between subject and background, emotionally intense expression, "
        : "";

    // Rotate colour palette for visual variety
    const palettes = [
        "cold blue and shadow tones",
        "warm amber and deep red undertones",
        "stark white light against pitch black",
        "deep emerald and obsidian",
        "golden hour with dramatic shadows",
        "industrial grey with single colour accent",
    ];
    const palette = palettes[index % palettes.length];

    return `${thumbnailBoost}${prompt}, colour palette: ${palette}, NOT: ${negativeKeywords}`;
}

// ─────────────────────────────────────────────
// PRIMARY: deAPI (Flux)
// ─────────────────────────────────────────────
function callDeapi(prompt, outputPath) {
    return new Promise((resolve, reject) => {
        if (!config.DEAPI_TOKEN) return reject(new Error("DEAPI_TOKEN missing"));

        const payload = JSON.stringify({
            model: "Flux1schnell",
            prompt: prompt,
            size: "1024x1792",  // 9:16 portrait — perfect for Shorts
            n: 1,
        });

        const options = {
            hostname: 'oai.deapi.ai',
            path: '/v1/images/generations',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.DEAPI_TOKEN}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (parsed.error) return reject(new Error(parsed.error.message));
                    const url = parsed.data?.[0]?.url;
                    if (!url) return reject(new Error("No image URL from deAPI"));

                    downloadImage(url, outputPath)
                        .then(() => resolve(outputPath))
                        .catch(reject);
                } catch (e) {
                    reject(new Error("Failed to parse deAPI response"));
                }
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

// ─────────────────────────────────────────────
// SECONDARY: Hugging Face (SDXL)
// ─────────────────────────────────────────────
function callHuggingFace(prompt, outputPath) {
    return new Promise((resolve, reject) => {
        if (!config.HF_API_KEY) return reject(new Error("HF_API_KEY missing"));

        const payload = JSON.stringify({
            inputs: prompt,
            parameters: {
                negative_prompt: "blurry, watermark, text, cartoon, low quality",
                num_inference_steps: 30,
                guidance_scale: 7.5,
                width: 1024,
                height: 1792,
            }
        });

        const options = {
            hostname: 'api-inference.huggingface.co',
            path: '/models/stabilityai/stable-diffusion-xl-base-1.0',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.HF_API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
            }
        };

        const req = https.request(options, (res) => {
            if (res.statusCode !== 200) return reject(new Error(`HF Status: ${res.statusCode}`));
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const buf = Buffer.concat(chunks);
                if (buf.length < 5000) return reject(new Error("HF returned tiny/invalid image"));
                fs.writeFileSync(outputPath, buf);
                resolve(outputPath);
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

// ─────────────────────────────────────────────
// TERTIARY: Dark-themed placeholder
// ─────────────────────────────────────────────
function downloadPlaceholder(index, outputPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(outputPath);
        // Dark mystery-themed placeholder
        https.get(
            `https://dummyimage.com/1080x1920/0a0a0a/cccccc.jpg&text=Scene+${index + 1}`,
            (res) => {
                res.pipe(file);
                file.on('finish', resolve);
            }
        ).on('error', reject);
    });
}

// ─────────────────────────────────────────────
// IMAGE DOWNLOADER (shared utility)
// ─────────────────────────────────────────────
function downloadImage(url, outputPath) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const lib = parsed.protocol === 'https:' ? https : require('http');
        const file = fs.createWriteStream(outputPath);

        lib.get(url, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                // Follow redirect
                return downloadImage(res.headers.location, outputPath).then(resolve).catch(reject);
            }
            res.pipe(file);
            file.on('finish', () => {
                // Validate image size (should be > 10KB for a real image)
                const size = fs.statSync(outputPath).size;
                if (size < 10000) {
                    fs.unlinkSync(outputPath);
                    return reject(new Error(`Downloaded image too small: ${size} bytes`));
                }
                resolve(outputPath);
            });
        }).on('error', reject);
    });
}

// ─────────────────────────────────────────────
// THUMBNAIL GENERATOR
// Uses a specially crafted prompt for the thumbnail image
// ─────────────────────────────────────────────
export async function generateThumbnailImage(thumbnailPrompt) {
    const outputPath = 'output/thumbnail.jpg';
    console.log("   🖼️ Generating optimised thumbnail...");
    await generateRealImage(thumbnailPrompt, outputPath, -1, true);
    console.log("   ✓ Thumbnail generated: output/thumbnail.jpg");
    return outputPath;
}

// ─────────────────────────────────────────────
// MAIN ORCHESTRATOR with retry logic
// ─────────────────────────────────────────────
export async function generateRealImage(prompt, outputPath, index, isThumbnail = false) {
    const isFirstImage = index === 0 || isThumbnail;
    const enhancedPrompt = enhancePrompt(prompt, Math.max(index, 0), isFirstImage);

    const maxRetries = 2;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        // Try deAPI first
        try {
            await callDeapi(enhancedPrompt, outputPath);
            console.log(`     ✓ deAPI succeeded (scene ${index + 1})`);
            return outputPath;
        } catch (deapiError) {
            console.log(`     ⚠️ deAPI failed (attempt ${attempt}): ${deapiError.message}`);
        }

        // Try Hugging Face
        try {
            await callHuggingFace(enhancedPrompt, outputPath);
            console.log(`     ✓ Hugging Face succeeded (scene ${index + 1})`);
            return outputPath;
        } catch (hfError) {
            console.log(`     ⚠️ HF failed (attempt ${attempt}): ${hfError.message}`);
        }

        if (attempt < maxRetries) {
            console.log(`     🔄 Retrying with simplified prompt...`);
            // Simplify prompt for retry
            prompt = prompt.split(',').slice(0, 3).join(',');
        }
    }

    // Final fallback
    console.log(`     📌 Using placeholder for scene ${index + 1}`);
    await downloadPlaceholder(index, outputPath);
    return outputPath;
}
