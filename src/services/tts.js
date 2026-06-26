import { execSync } from 'child_process';
import fs from 'fs';

// ─────────────────────────────────────────────
// VOICE PROFILES — optimised for mystery/drama
// ─────────────────────────────────────────────
const VOICE_PROFILES = [
    { voice: 'en-US-ChristopherNeural', rate: '-5%', pitch: '-5Hz' },   // Deep, authoritative (primary)
    { voice: 'en-US-GuyNeural', rate: '-8%', pitch: '-8Hz' },            // Rich, warm
    { voice: 'en-GB-RyanNeural', rate: '-5%', pitch: '-3Hz' },           // British gravitas
    { voice: 'en-AU-WilliamNeural', rate: '-6%', pitch: '-5Hz' },        // Australian depth
];

function getEdgeTtsCmd() {
    if (fs.existsSync('./venv/bin/python') && fs.existsSync('./venv/bin/edge-tts')) {
        return './venv/bin/python ./venv/bin/edge-tts';
    }
    return 'edge-tts';
}

// ─────────────────────────────────────────────
// NARRATION PREPROCESSOR
// Adds strategic pauses for dramatic effect
// ─────────────────────────────────────────────
function preprocessNarration(text) {
    return text
        // Add pause after dramatic single words
        .replace(/\.\s+/g, '. ')
        // Add SSML-style pauses via edge-tts break tags
        .replace(/\.\.\./g, '...<break time="600ms"/>')
        .replace(/([!?])\s/g, '$1<break time="400ms"/> ')
        // Emphasise numbers/dates
        .replace(/(\d{4})/g, '<emphasis level="strong">$1</emphasis>')
        .trim();
}

// ─────────────────────────────────────────────
// MAIN VOICEOVER GENERATOR
// ─────────────────────────────────────────────
export async function generateVoiceover(narrationText, voiceIndex = 0) {
    console.log("2. Generating voiceover...");

    const profile = VOICE_PROFILES[voiceIndex % VOICE_PROFILES.length];
    const edgeTtsCmd = getEdgeTtsCmd();

    // Write clean script
    fs.writeFileSync('output/script.txt', narrationText, 'utf8');

    // Write preprocessed script for TTS
    const processedText = preprocessNarration(narrationText);
    fs.writeFileSync('output/script_processed.txt', processedText, 'utf8');

    const cmd = [
        edgeTtsCmd,
        `--voice ${profile.voice}`,
        `--rate="${profile.rate}"`,
        `--pitch="${profile.pitch}"`,
        `--volume="+50%"`,
        `-f output/script.txt`,   // Use clean script (processed can cause issues)
        `--write-media output/audio_raw.mp3`,
    ].join(' ');

    try {
        execSync(cmd, { stdio: 'pipe' });

        // Post-process audio with FFmpeg: normalize + slight compression
        execSync(
            `ffmpeg -y -i output/audio_raw.mp3 ` +
            `-af "loudnorm=I=-16:TP=-1.5:LRA=11,acompressor=threshold=0.12:ratio=3:attack=5:release=50" ` +
            `output/audio.mp3`,
            { stdio: 'pipe' }
        );

        // Cleanup raw file
        if (fs.existsSync('output/audio_raw.mp3')) {
            fs.unlinkSync('output/audio_raw.mp3');
        }

        const duration = getAudioDuration('output/audio.mp3');
        console.log(`   ✓ Voiceover generated: ${duration?.toFixed(1)}s | Voice: ${profile.voice}`);
    } catch (err) {
        // Fallback: use raw audio without post-processing
        console.warn(`   ⚠️ Audio post-processing failed, using raw output: ${err.message}`);
        if (fs.existsSync('output/audio_raw.mp3')) {
            fs.renameSync('output/audio_raw.mp3', 'output/audio.mp3');
        } else {
            throw new Error("Voiceover generation completely failed.");
        }
    }
}

function getAudioDuration(filePath) {
    try {
        const dur = execSync(
            `ffprobe -i "${filePath}" -show_entries format=duration -v quiet -of csv='p=0'`
        ).toString().trim();
        return parseFloat(dur);
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// VOICE ROTATOR — vary voice across series parts
// so returning viewers hear variety
// ─────────────────────────────────────────────
export function getVoiceForPart(partNumber) {
    return (partNumber - 1) % VOICE_PROFILES.length;
}
