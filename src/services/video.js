import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';

export async function renderVideo(data) {
    console.log("4. Calculating cinematic crossfades and audio mixing...");

    if (!fs.existsSync('output/audio.mp3')) throw new Error("CRITICAL: audio.mp3 missing!");
    if (!fs.existsSync('assets/bgm.mp3')) throw new Error("CRITICAL: bgm.mp3 missing!");
    
    // REMOVED the subtitle safety check

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
    const fadeDuration = 0.5; 
    
    const imageDuration = (audioDuration / imageCount) + fadeDuration;
    const framesPerClip = Math.ceil(imageDuration * fps);
    
    let command = ffmpeg()
        .input('output/audio.mp3') 
        .input('assets/bgm.mp3'); 
    
    let filterComplex = [];

    // INCREASED MOVEMENT: Zoom is faster, panning is wider.
    const cameraMoves = [
        `z='min(zoom+0.003,1.8)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`, 
        `z='1.35':x='(iw-iw/zoom)*(in/${framesPerClip})':y='ih/2-(ih/zoom/2)'`, 
        `z='1.35':x='(iw-iw/zoom)-(iw-iw/zoom)*(in/${framesPerClip})':y='ih/2-(ih/zoom/2)'`, 
        `z='1.35':x='iw/2-(iw/zoom/2)':y='(ih-ih/zoom)*(in/${framesPerClip})'` 
    ];

    for (let i = 0; i < imageCount; i++) {
        if (!fs.existsSync(`output/img${i}.jpg`)) throw new Error(`CRITICAL: img${i}.jpg missing!`);
        command = command.input(`output/img${i}.jpg`);
        const moveEffect = cameraMoves[i % cameraMoves.length];
        
        filterComplex.push(`[${i+2}:v]scale=1080*1.2:1920*1.2,zoompan=${moveEffect}:d=${framesPerClip}:s=1080x1920:fps=${fps}[v${i}]`);
    }

    if (imageCount > 1) {
        let currentOut = `v0`;
        let currentLength = imageDuration;

        for (let i = 1; i < imageCount; i++) {
            const offset = currentLength - fadeDuration;
            const nextIn = `v${i}`;
            const outName = (i === imageCount - 1) ? `v_concat_raw` : `x${i}`;

            filterComplex.push(`[${currentOut}][${nextIn}]xfade=transition=fade:duration=${fadeDuration}:offset=${offset}[${outName}]`);

            currentOut = outName;
            currentLength = currentLength + imageDuration - fadeDuration;
        }
    } else {
        filterComplex.push(`[v0]copy[v_concat_raw]`);
    }

    // ADDED VIGNETTE: Darkens the edges to focus the eye, replacing the subtitle filter.
    filterComplex.push(`[v_concat_raw]vignette=PI/4[outv]`);

    // Studio Audio Mix
    filterComplex.push(`[0:a]volume=2.0[voice_loud];[1:a]volume=0.05[bgm_low];[voice_loud][bgm_low]amix=inputs=2:duration=first:dropout_transition=2[outa]`);

    console.log("5. Rendering Final Video without subtitles...");
    
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