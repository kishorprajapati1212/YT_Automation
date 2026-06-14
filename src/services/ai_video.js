import fs from 'fs';
import { HfInference } from '@huggingface/inference';
import { config } from '../config/env.js';

const hf = new HfInference(config.HF_API_KEY);

export async function generateAiVideo(inputImagePath, outputPath) {
    console.log(`     🎬 Uploading image for AI Video generation...`);
    
    // Read the file as a buffer
    const imageBuffer = fs.readFileSync(inputImagePath);
    
    // Use the official SDK - it handles retries and connection pooling automatically
    // The model "stabilityai/stable-video-diffusion-img2vid-xt" is specifically for Image-to-Video
    const result = await hf.imageToVideo({
        data: imageBuffer,
        model: "stabilityai/stable-video-diffusion-img2vid-xt"
    });

    // Write the output blob to disk
    const buffer = Buffer.from(await result.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);
    console.log(`     ✓ Video saved to ${outputPath}`);
    return outputPath;
}