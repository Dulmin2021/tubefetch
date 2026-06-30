# TubeFetch CLI 📺

A YouTube video downloader that runs entirely in your terminal — no browser, no web server, no UI.

## Requirements

- [Node.js](https://nodejs.org/) v16+
- [yt-dlp](https://github.com/yt-dlp/yt-dlp#installation) installed and available in PATH
- [ffmpeg](https://ffmpeg.org/) (optional, needed for audio extraction)

### Install yt-dlp (Windows)
```powershell
winget install yt-dlp
# or
pip install yt-dlp
```

---

## Installation

```bash
git clone https://github.com/your-username/tubefetch.git
cd tubefetch
npm install
```

---

## Usage

### Interactive Mode
Just run the script and follow the prompts:
```bash
node tubefetch.js
```

You'll be asked for:
1. A YouTube URL
2. Quality selection (e.g. 1080p, 720p, 480p, 360p, or audio-only)

### Non-Interactive (Flag) Mode
Pass arguments directly for scripting or automation:
```bash
# Download 720p video
node tubefetch.js --url "https://youtube.com/watch?v=VIDEO_ID" --quality 720p

# Download audio only (mp3)
node tubefetch.js --url "https://youtube.com/watch?v=VIDEO_ID" --quality audio

# Custom output directory
node tubefetch.js --url "https://youtube.com/watch?v=VIDEO_ID" --quality 1080p --output ./my-videos
```

### All Options
```
Options:
  -u, --url <url>        YouTube video URL
  -q, --quality <quality> Video quality: 1080p | 720p | 480p | 360p | audio
  -o, --output <dir>     Output directory (default: ./downloads)
  -V, --version          Show version number
  -h, --help             Show help
```

---

## Output

Downloaded files are saved to `./downloads/` by default:
```
downloads/
  My_Awesome_Video_720p.mp4
  Another_Video_audio.mp3
```

---

## What It Looks Like

```
  ████████╗██╗   ██╗██████╗ ███████╗███████╗███████╗████████╗ ██████╗██╗  ██╗
  ...

  📺  YouTube Video Downloader · powered by yt-dlp

? Enter YouTube URL: https://youtube.com/watch?v=dQw4w9WgXcQ
✔ Video info fetched!

  ────────────────────────────────────────────────────────────
  Title     Never Gonna Give You Up
  Channel   Rick Astley
  Duration  3:33
  Views     1,600,000,000
  ────────────────────────────────────────────────────────────

? Select quality: 720p

  ⬇  Downloading 720p to ./downloads ...

  ████████████░░░░░░░░░░ 55%  | ~45 MB  ETA: 00:12

  ✔  Download complete!
  📁  Saved to: C:\Users\you\tubefetch\downloads\Never_Gonna_Give_You_Up_720p.mp4
```

---

## License

ISC
