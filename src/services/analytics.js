import { google } from 'googleapis';
import { config } from '../config/env.js';

export async function getVideoAnalytics(videoId) {
    console.log(`📊 Fetching Analytics for Video: ${videoId}...`);

    const oAuth2Client = new google.auth.OAuth2(
        config.CLIENT_ID,
        config.CLIENT_SECRET,
        "http://localhost"
    );

    // This uses your new Master Token!
    oAuth2Client.setCredentials({
        refresh_token: config.REFRESH_TOKEN 
    });

    const youtubeAnalytics = google.youtubeAnalytics({
        version: 'v2',
        auth: oAuth2Client
    });

    // YouTube Analytics requires explicit YYYY-MM-DD dates.
    // Data takes about 48 hours to fully process on YouTube's end.
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];
    
    // Look back up to 5 days to ensure we catch the data
    const pastDate = new Date(today);
    pastDate.setDate(pastDate.getDate() - 5); 
    const startDate = pastDate.toISOString().split('T')[0];

    try {
        const res = await youtubeAnalytics.reports.query({
            ids: 'channel==MINE',
            startDate: startDate,
            endDate: endDate,
            metrics: 'views,likes,averageViewDuration,averageViewPercentage', // The vital stats
            filters: `video==${videoId}`,
            dimensions: 'video'
        });

        // The API returns a raw array. We map it to a clean object.
        if (res.data.rows && res.data.rows.length > 0) {
            const dataRow = res.data.rows[0];
            const stats = {
                views: dataRow[1],
                likes: dataRow[2],
                averageViewDurationSeconds: dataRow[3],
                averageViewPercentage: dataRow[4] // This is your retention hook!
            };
            
            console.log("   ✅ Analytics harvested:", stats);
            return stats;
        } else {
            console.log("   ⏳ Analytics not fully populated by YouTube yet. We will try again tomorrow.");
            return null;
        }
    } catch (error) {
        console.error("   ❌ Analytics API Error:", error.message);
        return null;
    }
}