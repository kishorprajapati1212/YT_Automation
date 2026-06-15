import { execSync } from 'child_process';
import fs from 'fs';

export async function generateVoiceover(narrationText) {
    console.log("2. Generating Voiceover...");
    fs.writeFileSync('output/script.txt', narrationText);

    let edgeTtsCmd = 'edge-tts';
    if (fs.existsSync('./venv/bin/python') && fs.existsSync('./venv/bin/edge-tts')) {
        edgeTtsCmd = './venv/bin/python ./venv/bin/edge-tts';
    }

    // REMOVED subtitle generation. Added +50% volume boost.
    execSync(`${edgeTtsCmd} --voice en-US-ChristopherNeural --volume=+50% -f output/script.txt --write-media output/audio.mp3`);
    console.log("   ✓ Voiceover generated.");
}