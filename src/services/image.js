import https from 'https';
import fs from 'fs';
import { config } from '../config/env.js';

// Primary: deAPI
function callDeapi(prompt, outputPath) {
    return new Promise((resolve, reject) => {
        if (!config.DEAPI_TOKEN) return reject(new Error("DEAPI_TOKEN missing"));

        const payload = JSON.stringify({ model: "Flux1schnell", prompt: prompt, size: "1024x1536" });
        const options = {
            hostname: 'oai.deapi.ai',
            path: '/v1/images/generations',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.DEAPI_TOKEN}`,
                'Content-Type': 'application/json',
                'Content-Length': payload.length
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (parsed.error) return reject(new Error(parsed.error.message));
                    if (!parsed.data || !parsed.data[0].url) return reject(new Error("No URL returned from deAPI."));

                    https.get(parsed.data[0].url, (imgRes) => {
                        const fileStream = fs.createWriteStream(outputPath);
                        imgRes.pipe(fileStream);
                        fileStream.on('finish', () => resolve(outputPath));
                    }).on('error', reject);
                } catch (e) { reject(new Error("Failed to parse deAPI.")); }
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

// Secondary: Hugging Face Fallback
function callHuggingFace(prompt, outputPath) {
    return new Promise((resolve, reject) => {
        if (!config.HF_API_KEY) return reject(new Error("HF_API_KEY missing"));

        const payload = JSON.stringify({ inputs: prompt });
        const options = {
            hostname: 'api-inference.huggingface.co',
            path: '/models/stabilityai/stable-diffusion-xl-base-1.0',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.HF_API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': payload.length
            }
        };

        const req = https.request(options, (res) => {
            if (res.statusCode !== 200) return reject(new Error(`HF Status: ${res.statusCode}`));
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                fs.writeFileSync(outputPath, Buffer.concat(chunks));
                resolve(outputPath);
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

// Tertiary: Safe Placeholder Fallback
function downloadPlaceholder(index) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(`output/img${index}.jpg`);
        https.get(`https://dummyimage.com/1080x1920/2b2b2b/ffffff.jpg&text=Fallback+Scene+${index + 1}`, (response) => {
            response.pipe(file);
            file.on('finish', () => resolve());
        }).on('error', reject);
    });
}

// The Orchestrator
export async function generateRealImage(prompt, outputPath, index) {
    try {
        await callDeapi(prompt, outputPath);
        console.log(`     ✓ deAPI succeeded.`);
    } catch (deapiError) {
        console.log(`     - deAPI failed (${deapiError.message}). Falling back to Hugging Face...`);
        try {
            await callHuggingFace(prompt, outputPath);
            console.log(`     ✓ Hugging Face succeeded.`);
        } catch (hfError) {
            console.log(`     - Hugging Face failed (${hfError.message}). Using safe placeholder.`);
            await downloadPlaceholder(index);
        }
    }
}