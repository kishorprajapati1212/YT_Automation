import fs from 'fs';

const STATE_FILE = 'story_state.json';

export function getStoryState() {
    if (fs.existsSync(STATE_FILE)) {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
    // Default state: total_parts is null until the AI decides in Part 1
    return { current_part: 1, total_parts: null, topic: "", context: "" };
}

export function saveStoryState(state) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}