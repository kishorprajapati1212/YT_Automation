import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';
import { config } from '../config/env.js';

export async function renderVideo(data) {
    console.log("4. Calculating cinematic crossfades and audio mixing...");

    if (!fs.existsSync('output/audio.mp3')) throw new Error("CRITICAL: audio.mp3 missing!");
    if (!fs.existsSync('assets/bgm.mp3')) throw new Error("CRITICAL: bgm.mp3 missing!");
    if (!fs.existsSync('output/subs.vtt')) throw new Error("CRITICAL: subs.vtt missing!");

    let audioDuration; 
    try {
        const durationStr = execSync("ffprobe -i output/audio.mp3 -show_entries format=duration -v quiet -of csv='p=0'").toString().trim();
        audioDuration = parseFloat(durationStr);
        if (isNaN(audioDuration)) throw new Error("ffprobe NaN");
    } catch (e) {
        audioDuration = data.narration.length / 14; 
    }
    
    const fps = 30;
    const imageCount = data.image_prompts.length;
    const fadeDuration = 0.5; // Half-second smooth crossfade
    
    // Each image needs to be slightly longer to account for the overlapping fade
    const imageDuration = (audioDuration / imageCount) + fadeDuration;
    const framesPerClip = Math.ceil(imageDuration * fps);
    
    let command = ffmpeg()
        .input('output/audio.mp3') 
        .input('assets/bgm.mp3'); 
    
    let filterComplex = [];

    // Premium Ken Burns Effects (Calculated dynamically to the exact frame count)
    const cameraMoves = [
        `z='min(zoom+0.0015,1.5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`, // Zoom Center
        `z='1.2':x='(iw-iw/zoom)*(in/${framesPerClip})':y='ih/2-(ih/zoom/2)'`, // Pan Right
        `z='1.2':x='(iw-iw/zoom)-(iw-iw/zoom)*(in/${framesPerClip})':y='ih/2-(ih/zoom/2)'`, // Pan Left
        `z='1.2':x='iw/2-(iw/zoom/2)':y='(ih-ih/zoom)*(in/${framesPerClip})'` // Pan Down
    ];

    // 1. Process Images & Camera Moves
    for (let i = 0; i < imageCount; i++) {
        if (!fs.existsSync(`output/img${i}.jpg`)) throw new Error(`CRITICAL: img${i}.jpg missing!`);
        command = command.input(`output/img${i}.jpg`);
        const moveEffect = cameraMoves[i % cameraMoves.length];
        
        filterComplex.push(`[${i+2}:v]scale=1080*1.2:1920*1.2,zoompan=${moveEffect}:d=${framesPerClip}:s=1080x1920:fps=${fps}[v${i}]`);
    }

    // 2. Build the Crossfade (xfade) Chain
    if (imageCount > 1) {
        let currentOut = `v0`;
        let currentLength = imageDuration;

        for (let i = 1; i < imageCount; i++) {
            const offset = currentLength - fadeDuration;
            const nextIn = `v${i}`;
            const outName = (i === imageCount - 1) ? `v_concat` : `x${i}`;

            // Add smooth fade transition
            filterComplex.push(`[${currentOut}][${nextIn}]xfade=transition=fade:duration=${fadeDuration}:offset=${offset}[${outName}]`);

            currentOut = outName;
            currentLength = currentLength + imageDuration - fadeDuration;
        }
    } else {
        filterComplex.push(`[v0]copy[v_concat]`);
    }

    // 3. Burn Subtitles
    const absoluteSubsPath = 'output/subs.vtt';
    filterComplex.push(`[v_concat]subtitles='${absoluteSubsPath}':force_style='FontSize=26,PrimaryColour=&H00FFFF&,OutlineColour=&H000000&,BorderStyle=1,Outline=2,Shadow=1,Alignment=2,MarginV=60'[outv]`);

    // 4. Studio Audio Mix (Boost Voice 200%, Drop BGM to 5%)
    filterComplex.push(`[0:a]volume=2.0[voice_loud];[1:a]volume=0.05[bgm_low];[voice_loud][bgm_low]amix=inputs=2:duration=first:dropout_transition=2[outa]`);

    console.log("5. Rendering Final Video...");
    
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
            .on('start', () => console.log("   🎬 FFmpeg render process started..."))
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