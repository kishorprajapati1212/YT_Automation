import { google } from 'googleapis';
import { config } from '../config/env.js';

export async function getVideoAnalytics(videoId) {
    console.log(`📊 Querying YouTube Studio for Video: ${videoId}...`);

    const oAuth2Client = new google.auth.OAuth2(
        config.CLIENT_ID,
        config.CLIENT_SECRET,
        "http://localhost"
    );

    oAuth2Client.setCredentials({
        refresh_token: config.REFRESH_TOKEN 
    });

    const youtubeAnalytics = google.youtubeAnalytics({
        version: 'v2',
        auth: oAuth2Client
    });

    const today = new Date();
    const endDate = today.toISOString().split('T')[0];
    
    // Look back up to 30 days to guarantee we capture data processing windows
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 30); 
    const startDate = pastDate.toISOString().split('T')[0];

    try {
        const res = await youtubeAnalytics.reports.query({
            ids: 'channel==MINE',
            startDate: startDate,
            endDate: endDate,
            metrics: 'views,likes,averageViewDuration,averageViewPercentage',
            filters: `video==${videoId}`,
            dimensions: 'video'
        });

        if (res.data.rows && res.data.rows.length > 0) {
            const row = res.data.rows[0];
            const stats = {
                views: parseInt(row[1], 10),
                likes: parseInt(row[2], 10),
                avgDurationSeconds: parseFloat(row[3]),
                retentionPercentage: parseFloat(row[4]) // 0% to 100%+
            };
            console.log("   ✅ Data successfully retrieved:", stats);
            return stats;
        }
        
        return null;
    } catch (error) {
        console.error(`   ❌ Failed to pull telemetry for ${videoId}:`, error.message);
        return null;
    }
}
