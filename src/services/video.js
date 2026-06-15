import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';
import { config } from '../config/env.js';

export async function renderVideo(data) {
    console.log("4. Calculating exact audio sync and building cinematic camera moves...");

    // --- 1. NEW: PRE-FLIGHT SAFETY CHECKS ---
    if (!fs.existsSync('output/audio.mp3')) throw new Error("CRITICAL: audio.mp3 is missing! TTS failed.");
    if (!fs.existsSync('assets/bgm.mp3')) throw new Error("CRITICAL: bgm.mp3 is missing from the assets folder!");
    if (!fs.existsSync('output/subs.vtt')) throw new Error("CRITICAL: subs.vtt is missing! Subtitles failed.");

    let audioDuration; 
    try {
        const durationStr = execSync("ffprobe -i output/audio.mp3 -show_entries format=duration -v quiet -of csv='p=0'").toString().trim();
        audioDuration = parseFloat(durationStr);
        if (isNaN(audioDuration)) throw new Error("ffprobe NaN");
    } catch (e) {
        audioDuration = data.narration.length / 14; 
    }
    
    const fps = 30;
    const framesPerImage = Math.ceil((audioDuration / data.image_prompts.length) * fps);
    
    // Inputs
    let command = ffmpeg()
        .input('output/audio.mp3') // Input 0: Main Voiceover
        .input('assets/bgm.mp3');  // Input 1: Background Music (NOW POINTS TO ASSETS)
    
    let filterComplex = [];
    let concatInputs = "";

    const cameraMoves = [
        `z='min(zoom+0.001,1.5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`,        // Slow Zoom In
        `z='1.2':x='(iw-iw/zoom)-(in/50)*(iw-iw/zoom)':y='ih/2-(ih/zoom/2)'`,     // Pan Right to Left
        `z='1.2':x='(in/50)*(iw-iw/zoom)':y='ih/2-(ih/zoom/2)'`,                  // Pan Left to Right
        `z='1.2':x='iw/2-(iw/zoom/2)':y='(ih-ih/zoom)-(in/50)*(ih-ih/zoom)'`      // Slow Pan Bottom to Top
    ];

    // Map Images (Inputs 2 through N+1)
    for (let i = 0; i < data.image_prompts.length; i++) {
        if (!fs.existsSync(`output/img${i}.jpg`)) throw new Error(`CRITICAL: img${i}.jpg is missing!`);
        
        command = command.input(`output/img${i}.jpg`);
        const moveEffect = cameraMoves[i % cameraMoves.length];
        
        filterComplex.push(`[${i+2}:v]scale=1080*1.2:1920*1.2,zoompan=${moveEffect}:d=${framesPerImage}:s=1080x1920:fps=${fps}[v${i}]`);
        concatInputs += `[v${i}]`;
    }

    filterComplex.push(`${concatInputs}concat=n=${data.image_prompts.length}:v=1:a=0[v_concat]`);

    // --- 2. FIXED: LINUX SUBTITLE COMPATIBILITY ---
    const absoluteSubsPath = 'output/subs.vtt';
    filterComplex.push(`[v_concat]subtitles='${absoluteSubsPath}':force_style='FontSize=26,PrimaryColour=&H00FFFF&,OutlineColour=&H000000&,BorderStyle=1,Outline=2,Shadow=1,Alignment=2,MarginV=60'[outv]`);

    filterComplex.push(`[1:a]volume=0.1[bgm_low];[0:a][bgm_low]amix=inputs=2:duration=first:dropout_transition=2[outa]`);

    console.log("5. Rendering Final Animated Video with Mixed Audio...");
    
    return new Promise((resolve, reject) => {
        command
            .complexFilter(filterComplex)
            .outputOptions([
                '-map [outv]',       
                '-map [outa]',       
                '-c:v libx264', 
                '-preset fast',      
                '-pix_fmt yuv420p', 
                '-c:a aac', 
                '-b:a 192k'
            ])
            .output('output/final_short.mp4')
            .on('start', (cmdLine) => {
                console.log("   🎬 FFmpeg render process started...");
            })
            .on('end', () => {
                console.log("   ✓ FFmpeg finished processing completely.");
                resolve();
            })
            .on('error', (err, stdout, stderr) => {
                console.error("   ❌ FFmpeg processing error:", err.message);
                console.error("   🚨 REAL FFMPEG CRASH LOG:\n", stderr);
                reject(err);
            })
            .run(); 
    });
}