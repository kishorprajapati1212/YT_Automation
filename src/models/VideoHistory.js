import mongoose from 'mongoose';

const VideoHistorySchema = new mongoose.Schema({
    videoId: { type: String, required: true },
    part: { type: Number, required: true },
    topic: { type: String, required: true },
    scriptUsed: { type: String, required: true },
    imagePrompts: { type: [String], default: [] },
    reviewed: { type: Boolean, default: false },
    date: { type: Date, default: Date.now }
});

export const VideoHistory = mongoose.model('VideoHistory', VideoHistorySchema);