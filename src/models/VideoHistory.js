import mongoose from 'mongoose';

const VideoHistorySchema = new mongoose.Schema({
    videoId:          { type: String, required: true },
    part:             { type: Number, required: true },
    topic:            { type: String, required: true },
    scriptUsed:       { type: String, required: true },
    imagePrompts:     { type: [String], default: [] },
    thumbnailPrompt:  { type: String, default: '' },
    titleUsed:        { type: String, default: '' },
    tags:             { type: [String], default: [] },

    // Critic / analytics fields
    reviewed:         { type: Boolean, default: false },
    performanceScore: { type: Number, default: null },
    analyticsSnapshot: {
        views:               { type: Number, default: null },
        likes:               { type: Number, default: null },
        avgDurationSeconds:  { type: Number, default: null },
        retentionPercentage: { type: Number, default: null },
    },

    date: { type: Date, default: Date.now },
});

export const VideoHistory = mongoose.model('VideoHistory', VideoHistorySchema);
