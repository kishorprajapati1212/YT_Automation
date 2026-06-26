# YT Automation v2 — Upgrade Guide

## What Changed & Why

### Problem
- Only 395 views over 10 days = algorithm not pushing videos
- Root causes: weak hooks, no subtitles, single transition type, poor thumbnail strategy, generic metadata

---

## File-by-File Upgrades

### `src/services/llm.js` — Script Generator
| Before | After |
|--------|-------|
| Generic mystery prompt | Hook bank with 8 proven viral formulas |
| Single style tag | Diverse topic categories for variety |
| No word count validation | Auto-retry if script < 70 words |
| No metadata output | Now outputs title, description, tags, thumbnail prompt |
| Fixed creativity | temperature=0.9 for more engaging scripts |

### `src/services/video.js` — Video Renderer
| Before | After |
|--------|-------|
| Only `fade` transition | 10 transition types rotating per scene |
| 4 camera move presets | 8 camera move presets including diagonals |
| No subtitles (removed) | Word-level subtitles burned into video |
| No colour grade | Saturation +15%, contrast +5%, sharpening |
| Basic vignette | Vignette + cinematic grade combined |
| No audio compression | Voice compressor + BGM fade-out at end |
| Basic encode | CRF 18 (higher quality) + faststart flag |

### `src/services/image.js` — Image Generator
| Before | After |
|--------|-------|
| Fixed 1024x1536 size | 1024x1792 (better 9:16 ratio for Shorts) |
| No prompt enhancement | Auto-adds colour palette variety per scene |
| Single retry | 2 attempts with prompt simplification on retry |
| No image validation | Checks file size > 10KB before accepting |
| No thumbnail generation | Separate `generateThumbnailImage()` function |

### `src/services/tts.js` — Voiceover
| Before | After |
|--------|-------|
| Single voice | 4 voice profiles (Christopher, Guy, Ryan, William) |
| No rate/pitch control | -5% rate, -5Hz pitch for deeper drama |
| No audio post-processing | FFmpeg loudnorm + compression after TTS |
| Voice never changes | Voice rotates per part number for variety |

### `src/services/youtube.js` — Uploader
| Before | After |
|--------|-------|
| Hardcoded description | Uses AI-generated description from llm.js |
| 3 basic tags | 15 tags mixing broad + niche long-tail |
| No thumbnail upload | `uploadThumbnail()` uploads custom thumbnail |
| No URL logging | Prints full YouTube Shorts URL after upload |

### `critic.js` — Self-Learning Bot
| Before | After |
|--------|-------|
| Basic analytics fetch | Performance scoring system (0-100) |
| Generic AI critique | Pattern detection before AI analysis |
| Single rule output | Identifies WEAKEST metric, targets fix |
| No trend tracking | Performance history stored in state |
| No duplicate rule check | Deduplicates rules before saving |
| No channel trend report | Prints improving/declining trend after run |

### `index.js` — Main Pipeline
| Before | After |
|--------|-------|
| Hardcoded title templates | AI-generated + A/B title variants |
| No thumbnail step | Generates and uploads custom thumbnail |
| Rules reset on series end | `dynamicRules` preserved across series |
| No pipeline logging | Detailed step-by-step status output |
| No error log file | Saves `output/error_log.json` on failure |

---

## Why These Changes Help Views

1. **Subtitles** — YouTube's algorithm ranks videos with captions higher. Viewers watching on mute stay longer.
2. **Transition variety** — Slide/wipe/radial transitions feel more professional than fade-only; retention increases.
3. **Colour grading** — Cinematic look makes thumbnails and mid-video frames more visually distinct.
4. **Custom thumbnails** — CTR is the #1 factor for YouTube distribution. A dedicated thumbnail prompt gets more clicks.
5. **Better titles** — Curiosity-gap titles with power words outperform "Part X" titles by 3-5x CTR.
6. **Voice variety** — Rotating voices stops subscriber fatigue across multi-part series.
7. **Smarter critic** — Pattern detection catches "early drop-off" vs "low reach" — different problems, different fixes.

---

## Quick Start

```bash
# Copy your .env from the original repo (no changes needed)
cp ../YT_Automation/.env .env

# Copy your background music
cp ../YT_Automation/assets/bgm.mp3 assets/bgm.mp3

npm install
node index.js       # run the video pipeline
node critic.js      # run analytics review (after 48h)
```
