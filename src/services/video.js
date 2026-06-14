import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';
import { config } from '../config/env.js';

export async function renderVideo(data) {
    console.log("4. Calculating exact audio sync and building cinematic camera moves...");
    
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
        .input('output/bgm.mp3');  // Input 1: Background Music
    
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
        command = command.input(`output/img${i}.jpg`);
        const moveEffect = cameraMoves[i % cameraMoves.length];
        
        // Apply the cinematic camera moves
        filterComplex.push(`[${i+2}:v]scale=1080*1.2:1920*1.2,zoompan=${moveEffect}:d=${framesPerImage}:s=1080x1920:fps=${fps}[v${i}]`);
        concatInputs += `[v${i}]`;
    }

    // Stitch video frames together
    filterComplex.push(`${concatInputs}concat=n=${data.image_prompts.length}:v=1:a=0[v_concat]`);

    // Burn subtitles
    const absoluteSubsPath = path.resolve(config.WORKSPACE_DIR, 'output/subs.vtt').replace(/\\/g, '/').replace(/:/g, '\\:');
    filterComplex.push(`[v_concat]subtitles='${absoluteSubsPath}':force_style='FontSize=26,PrimaryColour=&H00FFFF&,OutlineColour=&H000000&,BorderStyle=1,Outline=2,Shadow=1,Alignment=2,MarginV=60'[outv]`);

    // --- PROFESSIONAL AUDIO MIXING ---
    filterComplex.push(`[1:a]volume=0.1[bgm_low];[0:a][bgm_low]amix=inputs=2:duration=first:dropout_transition=2[outa]`);

    console.log("5. Rendering Final Animated Video with Mixed Audio...");
    
    return new Promise((resolve, reject) => {
        command
            .complexFilter(filterComplex)
            .outputOptions([
                '-map [outv]',       // The animated subtitled video
                '-map [outa]',       // The mixed voiceover + background music
                '-c:v libx264', 
                '-preset fast',      
                '-pix_fmt yuv420p', 
                '-c:a aac', 
                '-b:a 192k'
            ])
            // CHANGED HERE: Registering output destination and event handlers BEFORE running the binary
            .output('output/final_short.mp4')
            .on('start', (cmdLine) => {
                console.log("   🎬 FFmpeg render process started...");
            })
            .on('end', () => {
                console.log("   ✓ FFmpeg finished processing completely.");
                resolve();
            })
            .on('error', (err) => {
                console.error("   ❌ FFmpeg processing error:", err.message);
                reject(err);
            })
            .run(); // Explicitly fires the render execution last
    });
}