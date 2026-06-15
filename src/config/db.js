import mongoose from 'mongoose';
import { config } from './env.js';

export const connectDB = async () => {
    try {
        // Fallback to process.env in case config doesn't map it directly yet
        const uri = process.env.MONGO_URI || config.MONGO_URI; 
        
        if (!uri) {
            throw new Error("MONGO_URI is missing from .env file");
        }

        await mongoose.connect(uri);
        console.log("📦 MongoDB Connected Successfully!");
    } catch (error) {
        console.error("❌ MongoDB Connection Failed:", error.message);
        // We do NOT exit the process here. If the DB fails, we still want the video to render!
    }
};