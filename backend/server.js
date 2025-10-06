// backend server for tubefetch

const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3001;

// ==========================================
// STEP 1: Security & Middleware Setup
// ==========================================
console.log('🔒 Setting up security...');

// Security headers
app.use(helmet());

// CORS - Allow frontend to access backend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Parse JSON requests
app.use(express.json());

// ==========================================
// STEP 2: Rate Limiting (Prevent Abuse)
// ==========================================
console.log('⏱️  Setting up rate limiting...');

// General API rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Too many requests, please try again later.'
});

// Download rate limiter (stricter)
const downloadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 downloads per hour
  message: 'Download limit exceeded. Please try again in an hour.'
});

// ==========================================
// STEP 3: Helper Functions
// ==========================================

// Validate YouTube URL
function isValidYouTubeUrl(url) {
  const patterns = [
    /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /^(https?:\/\/)?(www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
  ];
  return patterns.some(pattern => pattern.test(url));
}

// Sanitize URL to prevent command injection
function sanitizeUrl(url) {
  return url.replace(/[;&|`$(){}[\]<>]/g, '');
}

// ==========================================
// STEP 4: API Endpoints
// ==========================================

// Health Check Endpoint
app.get('/health', (req, res) => {
  console.log('✅ Health check requested');
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'TubeFetch API',
    version: '1.0.0'
  });
});

// Get Video Information
app.post('/api/video-info', limiter, async (req, res) => {
  console.log('\n📹 Video info requested');
  
  try {
    const { url } = req.body;
    
    // Validation
    if (!url || typeof url !== 'string') {
      console.log('❌ No URL provided');
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!isValidYouTubeUrl(url)) {
      console.log('❌ Invalid YouTube URL:', url);
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    console.log('✅ Valid URL:', url);
    const sanitizedUrl = sanitizeUrl(url);

    // Use yt-dlp to get video metadata
    console.log('🔍 Fetching video metadata...');
    const command = `yt-dlp --dump-json --no-warnings "${sanitizedUrl}"`;
    
    const { stdout, stderr } = await execAsync(command, {
      timeout: 30000, // 30 second timeout
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });

    if (stderr && !stdout) {
      console.error('❌ yt-dlp error:', stderr);
      return res.status(500).json({ error: 'Failed to fetch video information' });
    }

    const videoData = JSON.parse(stdout);
    console.log('✅ Video found:', videoData.title);

    // Extract available formats
    const formats = videoData.formats
      .filter(f => f.vcodec !== 'none' && f.acodec !== 'none' && f.ext === 'mp4')
      .map(f => ({
        quality: f.height ? `${f.height}p` : 'Unknown',
        format: f.ext,
        filesize: f.filesize ? `~${Math.round(f.filesize / 1024 / 1024)} MB` : 'Unknown',
        format_id: f.format_id
      }))
      .filter((f, i, arr) => arr.findIndex(t => t.quality === f.quality) === i)
      .sort((a, b) => parseInt(b.quality) - parseInt(a.quality))
      .slice(0, 4);

    const response = {
      title: videoData.title,
      thumbnail: videoData.thumbnail,
      duration: videoData.duration_string || 'Unknown',
      author: videoData.uploader || videoData.channel,
      formats: formats.length > 0 ? formats : [
        { quality: '720p', format: 'mp4', filesize: 'Unknown', format_id: 'best' },
        { quality: '480p', format: 'mp4', filesize: 'Unknown', format_id: 'best' },
        { quality: '360p', format: 'mp4', filesize: 'Unknown', format_id: 'best' }
      ]
    };

    console.log('✅ Sending video info');
    res.json(response);

  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.killed) {
      return res.status(504).json({ error: 'Request timeout' });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch video information',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Download Video
app.get('/api/download', downloadLimiter, async (req, res) => {
  console.log('\n⬇️  Download requested');
  
  try {
    const { url, quality } = req.query;

    // Validation
    if (!url || !quality) {
      console.log('❌ Missing parameters');
      return res.status(400).json({ error: 'URL and quality are required' });
    }

    if (!isValidYouTubeUrl(url)) {
      console.log('❌ Invalid URL');
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    console.log('✅ Download request:', quality, 'from', url);
    const sanitizedUrl = sanitizeUrl(url);

    // Quality to format mapping
    const qualityMap = {
      '1080p': 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]',
      '720p': 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]',
      '480p': 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]',
      '360p': 'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]'
    };

    const formatSelector = qualityMap[quality] || 'best[ext=mp4]';

    // Create temp directory
    const tempDir = path.join(__dirname, 'temp');
    await fs.mkdir(tempDir, { recursive: true });

    const timestamp = Date.now();
    const outputTemplate = path.join(tempDir, `video_${timestamp}.%(ext)s`);

    // Download with yt-dlp
    console.log('⏳ Downloading video...');
    const command = `yt-dlp -f "${formatSelector}" --merge-output-format mp4 -o "${outputTemplate}" "${sanitizedUrl}"`;

    await execAsync(command, {
      timeout: 300000, // 5 minute timeout
      maxBuffer: 1024 * 1024 * 100 // 100MB buffer
    });

    // Find downloaded file
    const files = await fs.readdir(tempDir);
    const videoFile = files.find(f => f.startsWith(`video_${timestamp}`));

    if (!videoFile) {
      throw new Error('Downloaded file not found');
    }

    const filePath = path.join(tempDir, videoFile);
    const stat = await fs.stat(filePath);

    console.log('✅ Video ready, streaming to client...');

    // Set headers
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="video_${quality}.mp4"`);

    // Stream file
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);

    // Cleanup after streaming
    fileStream.on('end', async () => {
      try {
        await fs.unlink(filePath);
        console.log('🗑️  Cleaned up:', videoFile);
      } catch (err) {
        console.error('Cleanup error:', err);
      }
    });

    fileStream.on('error', (err) => {
      console.error('Stream error:', err);
      res.status(500).end();
    });

  } catch (error) {
    console.error('❌ Download error:', error.message);
    
    if (error.killed) {
      return res.status(504).json({ error: 'Download timeout' });
    }
    
    res.status(500).json({ 
      error: 'Download failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ==========================================
// STEP 5: Start Server
// ==========================================

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log('🚀 TubeFetch Backend Server Started!');
  console.log('='.repeat(50));
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📝 API base: http://localhost:${PORT}/api`);
  console.log('='.repeat(50) + '\n');
  console.log('✅ Server is ready to accept requests!\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n⚠️  SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n⚠️  SIGINT received, shutting down gracefully...');
  process.exit(0);
});