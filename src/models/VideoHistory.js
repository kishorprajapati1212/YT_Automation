import mongoose from 'mongoose';

const videoHistorySchema = new mongoose.Schema({
    videoId: { 
        type: String, 
        required: true, 
        unique: true 
    },
    topic: {
        type: String,
        required: true
    },
    scriptUsed: { 
        type: String, 
        required: true 
    },
    imagePrompts: { 
        type: [String], 
        required: true 
    },
    uploadDate: { 
        type: Date, 
        default: Date.now 
    },
    analyzed: { 
        type: Boolean, 
        default: false // The Critic Bot will change this to true later
    }
});

export const VideoHistory = mongoose.model('VideoHistory', videoHistorySchema);