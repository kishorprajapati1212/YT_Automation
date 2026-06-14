import { execSync } from 'child_process';
import fs from 'fs';
import https from 'https';

export function generateVoiceover(narrationText) {
    console.log("2. Generating Voiceover & Background Music...");
    fs.writeFileSync('output/script.txt', narrationText);

    // Check if local venv exists. If yes, use it directly. If no, assume GitHub Actions.
    let edgeTtsCmd = 'edge-tts';
    if (fs.existsSync('./venv/bin/python') && fs.existsSync('./venv/bin/edge-tts')) {
        edgeTtsCmd = './venv/bin/python ./venv/bin/edge-tts';
    }

    // 1. Generate Voiceover via Edge-TTS
    execSync(`${edgeTtsCmd} --voice en-US-ChristopherNeural -f output/script.txt --write-media output/audio.mp3 --write-subtitles output/subs.vtt`);
    // 2. Download Royalty-Free Background Music (Reliable CDN)
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream('output/bgm.mp3');

        // Using a highly reliable, unblocked CDN for a public domain lofi track
        const options = {
            hostname: 'cdn.pixabay.com',
            path: '/download/audio/2022/05/27/audio_1808fbf07a.mp3',
            method: 'GET',
            headers: {
                // Faking a browser user-agent stops basic bot-blockers
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        };

        https.get(options, (response) => {
            // Check for redirects (301 or 302)
            if (response.statusCode === 301 || response.statusCode === 302) {
                https.get(response.headers.location, (redirectResponse) => {
                    redirectResponse.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        console.log("   ✓ Background music downloaded (Redirected).");
                        resolve();
                    });
                }).on('error', reject);
            } else if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    console.log("   ✓ Background music downloaded.");
                    resolve();
                });
            } else {
                reject(new Error(`Failed to download BGM. Status Code: ${response.statusCode}`));
            }
        }).on('error', reject);
    });
}   