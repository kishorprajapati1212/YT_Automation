import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';

// ─────────────────────────────────────────────
// TRANSITION LIBRARY — cinematic variety
// ─────────────────────────────────────────────
const TRANSITIONS = [
    'fade',
    'fadeblack',
    'slideleft',
    'slideright',
    'wipeleft',
    'wiperight',
    'circleopen',
    'radial',
    'smoothleft',
    'smoothright',
];

// ─────────────────────────────────────────────
// CAMERA MOVEMENT PRESETS — Ken Burns variations
// ─────────────────────────────────────────────
function getCameraMove(index, framesPerClip) {
    const moves = [
        // Slow zoom in — center
        `z='min(zoom+0.0015,1.5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`,
        // Pan left to right
        `z='1.3':x='(iw-iw/zoom)*(on/${framesPerClip})':y='ih/2-(ih/zoom/2)'`,
        // Pan right to left
        `z='1.3':x='(iw-iw/zoom)-(iw-iw/zoom)*(on/${framesPerClip})':y='ih/2-(ih/zoom/2)'`,
        // Tilt up
        `z='1.3':x='iw/2-(iw/zoom/2)':y='(ih-ih/zoom)*(on/${framesPerClip})'`,
        // Tilt down
        `z='1.3':x='iw/2-(iw/zoom/2)':y='(ih-ih/zoom)-(ih-ih/zoom)*(on/${framesPerClip})'`,
        // Slow zoom out
        `z='max(zoom-0.001,1.0)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`,
        // Diagonal pan (top-left to bottom-right)
        `z='1.3':x='(iw-iw/zoom)*(on/${framesPerClip})':y='(ih-ih/zoom)*(on/${framesPerClip})'`,
        // Diagonal pan (bottom-right to top-left)
        `z='1.3':x='(iw-iw/zoom)-(iw-iw/zoom)*(on/${framesPerClip})':y='(ih-ih/zoom)-(ih-ih/zoom)*(on/${framesPerClip})'`,
    ];
    return moves[index % moves.length];
}

// ─────────────────────────────────────────────
// SUBTITLE GENERATOR (word-level captions)
// ─────────────────────────────────────────────
async function generateSubtitles(narration, audioDuration, outputPath) {
    console.log("   📝 Generating word-level subtitles...");

    const words = narration.trim().split(/\s+/);
    const wordsPerSecond = words.length / audioDuration;
    const msPerWord = 1000 / wordsPerSecond;

    // Group into 3-word chunks for readability
    const chunks = [];
    for (let i = 0; i < words.length; i += 3) {
        chunks.push(words.slice(i, i + 3).join(' '));
    }

    const msDuration = (audioDuration * 1000) / chunks.length;

    let srt = '';
    chunks.forEach((chunk, i) => {
        const startMs = i * msDuration;
        const endMs = Math.min((i + 1) * msDuration - 50, audioDuration * 1000);

        const fmt = (ms) => {
            const h = Math.floor(ms / 3600000);
            const m = Math.floor((ms % 3600000) / 60000);
            const s = Math.floor((ms % 60000) / 1000);
            const ms2 = Math.floor(ms % 1000);
            return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms2).padStart(3,'0')}`;
        };

        srt += `${i + 1}\n${fmt(startMs)} --> ${fmt(endMs)}\n${chunk}\n\n`;
    });

    fs.writeFileSync(outputPath, srt, 'utf8');
    console.log(`   ✓ Subtitles generated: ${chunks.length} caption blocks`);
    return outputPath;
}

// ─────────────────────────────────────────────
// AUDIO PROBE — get exact duration
// ─────────────────────────────────────────────
function getAudioDuration(filePath) {
    try {
        const dur = execSync(
            `ffprobe -i "${filePath}" -show_entries format=duration -v quiet -of csv='p=0'`
        ).toString().trim();
        const parsed = parseFloat(dur);
        if (!isNaN(parsed)) return parsed;
    } catch {}
    return null;
}

// ─────────────────────────────────────────────
// MAIN VIDEO RENDERER
// ─────────────────────────────────────────────
export async function renderVideo(data) {
    console.log("4. Assembling cinematic video...");

    const audioPath = 'output/audio.mp3';
    const bgmPath = 'assets/bgm.mp3';
    const srtPath = 'output/subtitles.srt';

    if (!fs.existsSync(audioPath)) throw new Error("CRITICAL: audio.mp3 missing!");
    if (!fs.existsSync(bgmPath)) throw new Error("CRITICAL: bgm.mp3 missing!");

    const audioDuration = getAudioDuration(audioPath) || (data.narration.length / 14);
    console.log(`   ✓ Audio duration: ${audioDuration.toFixed(2)}s`);

    // Generate subtitles
    await generateSubtitles(data.narration, audioDuration, srtPath);

    const fps = 30;
    const imageCount = data.image_prompts.length;
    const fadeDuration = 0.6;
    const imageDuration = (audioDuration / imageCount) + fadeDuration;
    const framesPerClip = Math.ceil(imageDuration * fps);

    // Validate all images exist
    for (let i = 0; i < imageCount; i++) {
        if (!fs.existsSync(`output/img${i}.jpg`)) {
            throw new Error(`CRITICAL: img${i}.jpg missing!`);
        }
    }

    let command = ffmpeg()
        .input(audioPath)
        .input(bgmPath);

    // Add all images as inputs
    for (let i = 0; i < imageCount; i++) {
        command = command.input(`output/img${i}.jpg`);
    }

    let filterComplex = [];

    // ── SCENE PROCESSING with diverse camera moves ──
    for (let i = 0; i < imageCount; i++) {
        const move = getCameraMove(i, framesPerClip);
        filterComplex.push(
            `[${i + 2}:v]` +
            `scale=1080*1.35:1920*1.35,` +  // slight overscale for zoom headroom
            `zoompan=${move}:d=${framesPerClip}:s=1080x1920:fps=${fps},` +
            `setsar=1[v${i}]`
        );
    }

    // ── TRANSITIONS — rotate through different styles ──
    if (imageCount > 1) {
        let currentOut = 'v0';
        let currentLength = imageDuration;

        for (let i = 1; i < imageCount; i++) {
            const transition = TRANSITIONS[i % TRANSITIONS.length];
            const offset = currentLength - fadeDuration;
            const outName = (i === imageCount - 1) ? 'v_raw' : `x${i}`;

            filterComplex.push(
                `[${currentOut}][v${i}]xfade=transition=${transition}:duration=${fadeDuration}:offset=${offset}[${outName}]`
            );

            currentOut = outName;
            currentLength = currentLength + imageDuration - fadeDuration;
        }
    } else {
        filterComplex.push(`[v0]copy[v_raw]`);
    }

    // ── POST-PROCESSING: color grade + vignette ──
    filterComplex.push(
        `[v_raw]` +
        `eq=saturation=1.15:contrast=1.05:brightness=-0.02,` +   // cinematic grade
        `vignette=PI/4.5,` +                                       // edge darkening
        `unsharp=5:5:0.8:3:3:0[v_graded]`                        // subtle sharpening
    );

    // ── SUBTITLES overlay ──
    const absSrtPath = path.resolve(srtPath).replace(/\\/g, '/');
    filterComplex.push(
        `[v_graded]subtitles='${absSrtPath}':` +
        `force_style='FontName=Arial Black,FontSize=14,Bold=1,` +
        `PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,` +
        `Outline=3,Shadow=2,MarginV=120,Alignment=2'[outv]`
    );

    // ── AUDIO MIX: voice + music ──
    filterComplex.push(
        `[0:a]volume=2.2,acompressor=threshold=0.1:ratio=3:attack=5:release=50[voice];` +
        `[1:a]volume=0.06,afade=t=out:st=${Math.max(audioDuration - 2, 0)}:d=2[bgm];` +
        `[voice][bgm]amix=inputs=2:duration=first:dropout_transition=3[outa]`
    );

    console.log("5. Rendering final video with subtitles and cinematic grading...");

    return new Promise((resolve, reject) => {
        command
            .complexFilter(filterComplex)
            .outputOptions([
                '-map [outv]',
                '-map [outa]',
                '-c:v libx264',
                '-preset fast',
                '-crf 18',           // higher quality encode
                '-pix_fmt yuv420p',
                '-c:a aac',
                '-b:a 192k',
                '-movflags +faststart',  // web-optimised
                '-r', String(fps),
            ])
            .output('output/final_short.mp4')
            .on('start', cmd => console.log("   🎬 FFmpeg started..."))
            .on('end', () => {
                const size = (fs.statSync('output/final_short.mp4').size / 1024 / 1024).toFixed(2);
                console.log(`   ✓ Video rendered: ${size} MB`);
                resolve();
            })
            .on('error', (err, stdout, stderr) => {
                console.error("   ❌ FFmpeg error:", err.message);
                // Retry without subtitles if subtitle burn-in failed
                if (err.message.includes('subtitle') || err.message.includes('srt')) {
                    console.log("   ⚠️ Retrying without subtitles...");
                    renderVideoFallback(data, filterComplex, command, resolve, reject);
                } else {
                    console.error("   🚨 FFMPEG LOG:\n", stderr);
                    reject(err);
                }
            })
            .run();
    });
}

// ─────────────────────────────────────────────
// FALLBACK: render without subtitles if srt fails
// ─────────────────────────────────────────────
async function renderVideoFallback(data, _fc, _cmd, resolve, reject) {
    const audioPath = 'output/audio.mp3';
    const bgmPath = 'assets/bgm.mp3';
    const imageCount = data.image_prompts.length;

    const audioDuration = getAudioDuration(audioPath) || (data.narration.length / 14);
    const fps = 30;
    const fadeDuration = 0.6;
    const imageDuration = (audioDuration / imageCount) + fadeDuration;
    const framesPerClip = Math.ceil(imageDuration * fps);

    let command = ffmpeg().input(audioPath).input(bgmPath);
    for (let i = 0; i < imageCount; i++) command = command.input(`output/img${i}.jpg`);

    let fc = [];
    for (let i = 0; i < imageCount; i++) {
        const move = getCameraMove(i, framesPerClip);
        fc.push(`[${i+2}:v]scale=1080*1.35:1920*1.35,zoompan=${move}:d=${framesPerClip}:s=1080x1920:fps=${fps},setsar=1[v${i}]`);
    }
    if (imageCount > 1) {
        let cur = 'v0', curLen = imageDuration;
        for (let i = 1; i < imageCount; i++) {
            const t = TRANSITIONS[i % TRANSITIONS.length];
            const off = curLen - fadeDuration;
            const out = i === imageCount - 1 ? 'v_raw' : `x${i}`;
            fc.push(`[${cur}][v${i}]xfade=transition=${t}:duration=${fadeDuration}:offset=${off}[${out}]`);
            cur = out; curLen = curLen + imageDuration - fadeDuration;
        }
    } else {
        fc.push(`[v0]copy[v_raw]`);
    }
    fc.push(`[v_raw]eq=saturation=1.15:contrast=1.05,vignette=PI/4.5[outv]`);
    fc.push(`[0:a]volume=2.2[voice];[1:a]volume=0.06[bgm];[voice][bgm]amix=inputs=2:duration=first[outa]`);

    command.complexFilter(fc)
        .outputOptions(['-map [outv]','-map [outa]','-c:v libx264','-preset fast','-crf 18','-pix_fmt yuv420p','-c:a aac','-b:a 192k','-movflags +faststart'])
        .output('output/final_short.mp4')
        .on('end', resolve)
        .on('error', reject)
        .run();
}
