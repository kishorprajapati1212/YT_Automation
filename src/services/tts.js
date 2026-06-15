import { execSync } from 'child_process';
import fs from 'fs';

export async function generateVoiceover(narrationText) {
    console.log("2. Generating Voiceover...");
    fs.writeFileSync('output/script.txt', narrationText);

    // Check if local venv exists. If yes, use it directly. If no, assume GitHub Actions.
    let edgeTtsCmd = 'edge-tts';
    if (fs.existsSync('./venv/bin/python') && fs.existsSync('./venv/bin/edge-tts')) {
        edgeTtsCmd = './venv/bin/python ./venv/bin/edge-tts';
    }

    // Generate Voiceover via Edge-TTS
    execSync(`${edgeTtsCmd} --voice en-US-ChristopherNeural -f output/script.txt --write-media output/audio.mp3 --write-subtitles output/subs.vtt`);
    console.log("   ✓ Voiceover generated.");
}