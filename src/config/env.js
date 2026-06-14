import 'dotenv/config';

export const config = {
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    REFRESH_TOKEN: process.env.YOUTUBE_REFRESH_TOKEN,
    CLIENT_ID:  process.env.YOUTUBE_CLIENT_ID,
    CLIENT_SECRET:  process.env.YOUTUBE_CLIENT_SECRET,
    DEAPI_TOKEN: process.env.DEAPI_TOKEN,
    HF_API_KEY: process.env.HF_API_KEY || process.env.HUGGINGFACE_API_KEY,
    WORKSPACE_DIR: process.cwd(),
};
if (!config.GROQ_API_KEY || !config.DEAPI_TOKEN) {
    console.error("❌ CRITICAL ERROR: Missing API Keys in .env file.");
    process.exit(1);
}