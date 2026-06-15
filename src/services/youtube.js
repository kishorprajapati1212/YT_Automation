import { google } from 'googleapis';
import fs from 'fs';
import { config } from '../config/env.js';

export async function uploadToYouTube(filePath, title, description) {
    const oAuth2Client = new google.auth.OAuth2(
        config.CLIENT_ID,
        config.CLIENT_SECRET,
        "http://localhost" 
    );

    // This is the "Magic Key" for unattended daily uploads
    oAuth2Client.setCredentials({
        refresh_token: config.REFRESH_TOKEN 
    });

    const youtube = google.youtube({ version: 'v3', auth: oAuth2Client });

    console.log("🚀 Uploading to YouTube...");
    const res = await youtube.videos.insert({
        part: 'snippet,status',
        requestBody: {
            snippet: { 
                title: title, 
                description: description, 
                tags: ['history', 'shorts', 'facts'], 
                categoryId: '22' 
            },
            status: { 
                privacyStatus: 'public', // Set to public for your daily run
                selfDeclaredMadeForKids: false 
            }
        },
        media: { 
            body: fs.createReadStream(filePath) 
        }
    });

    return res.data.id;
}