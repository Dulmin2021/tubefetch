
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

// Use Fly.io's internal port or 3001 for local
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0'; // Important for Fly.io

console.log('🚀 Starting TubeFetch Backend...');
console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🌍 Port: ${PORT}`);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS - Allow all origins in production (or specify your frontend URL)
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',')
  : ['http://localhost:3000', 'https://tubefetch.fly.dev'];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.some(allowed => origin.includes(allowed)) || origin.includes('.fly.dev')) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for now, restrict later
    }
  },
  credentials: true
}));

app.use(express.json());

// Trust proxy (important for Fly.io)
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Increased for production
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const downloadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10, // Increased for production
  message: 'Download limit exceeded. Please try again in an hour.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Validate YouTube URL
function isValidYouTubeUrl(url) {
  const patterns = [
    /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /^(https?:\/\/)?(www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
  ];
  return patterns.some(pattern => pattern.test(url));
}

// Sanitize URL
function sanitizeUrl(url) {
  return url.replace(/[;&|`$(){}[\]<>]/g, '');
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'TubeFetch API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'TubeFetch API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Get video information
app.post('/api/video-info', limiter, async (req, res) => {
  console.log('📹 Video info requested');
  
  try {
    const { url } = req.body;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!isValidYouTubeUrl(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    const sanitizedUrl = sanitizeUrl(url);
    console.log('🔍 Fetching metadata for:', sanitizedUrl);

    const command = `yt-dlp --dump-json --no-warnings "${sanitizedUrl}"`;
    
    const { stdout, stderr } = await execAsync(command, {
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 10
    });

    if (stderr && !stdout) {
      console.error('❌ yt-dlp error:', stderr);
      return res.status(500).json({ error: 'Failed to fetch video information' });
    }

    const videoData = JSON.parse(stdout);
    console.log('✅ Video found:', videoData.title);

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

// Download video
app.get('/api/download', downloadLimiter, async (req, res) => {
  console.log('⬇️  Download requested');
  
  try {
    const { url, quality } = req.query;

    if (!url || !quality) {
      return res.status(400).json({ error: 'URL and quality are required' });
    }

    if (!isValidYouTubeUrl(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    console.log('✅ Downloading:', quality, 'from', url);
    const sanitizedUrl = sanitizeUrl(url);

    // Use simpler format selection that's more reliable
    const qualityHeightMap = {
      '1080p': 1080,
      '720p': 720,
      '480p': 480,
      '360p': 360
    };

    const targetHeight = qualityHeightMap[quality] || 720;
    const formatSelector = `best[height<=${targetHeight}][ext=mp4]/best[height<=${targetHeight}]/best[ext=mp4]/best`;

    console.log('⏳ Starting download with yt-dlp (streaming to client)...');

    // Set headers immediately to start download
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="video_${quality}.mp4"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Transfer-Encoding', 'chunked');

    // Stream directly from yt-dlp to client without saving to disk
    // Use default yt-dlp settings which work better with YouTube
    const command = `yt-dlp -f "best[ext=mp4]/best" -o - "${sanitizedUrl}"`;

    console.log('📡 Piping yt-dlp output directly to client...');

    const childProcess = require('child_process').spawn('bash', ['-c', command], {
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024 * 100
    });

    let dataReceived = false;
    let errorMessage = '';

    childProcess.stdout.on('data', (chunk) => {
      dataReceived = true;
      if (!res.headersSent) {
        res.writeHead(200);
      }
      res.write(chunk);
    });

    childProcess.stderr.on('data', (chunk) => {
      errorMessage += chunk.toString();
      const msg = chunk.toString();
      // Log progress messages but don't print full details
      if (msg.includes('ERROR') || msg.includes('error')) {
        console.error('❌ yt-dlp error:', msg.substring(0, 300));
      } else {
        console.log('ℹ️  yt-dlp:', msg.substring(0, 200));
      }
    });

    childProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Download complete');
        res.end();
      } else {
        if (!dataReceived) {
          // Haven't sent headers yet, send error response
          if (!res.headersSent) {
            const cleanError = errorMessage
              .split('\n')
              .filter(line => line.includes('ERROR') || line.includes('error') || line.includes('Failed'))
              .join(' ')
              .substring(0, 500) || 'Unknown error from yt-dlp';
            
            console.error('❌ yt-dlp failed with code', code);
            res.status(500).json({
              error: 'Failed to download video',
              details: cleanError
            });
          } else {
            // Already streaming, just end the response
            res.end();
          }
        } else {
          // Already streaming data, just end
          res.end();
        }
        console.error('❌ Download process exit code:', code);
      }
    });

    childProcess.on('error', (err) => {
      console.error('❌ Process error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Failed to start download',
          details: err.message
        });
      }
    });

    // Handle client disconnect
    res.on('close', () => {
      if (!childProcess.killed) {
        childProcess.kill();
        console.log('⚠️  Client disconnected, killing download process');
      }
    });

  } catch (error) {
    console.error('❌ Download error:', error.message);
    
    if (!res.headersSent) {
      const errorMessage = error.message.substring(0, 300);
      res.status(500).json({ 
        error: `Download failed: ${errorMessage}`,
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      });
    }
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, HOST, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 TubeFetch Backend Running on Fly.io');
  console.log('='.repeat(60));
  console.log(`📍 Host: ${HOST}`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('='.repeat(60) + '\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM received, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('⚠️  SIGINT received, shutting down...');
  process.exit(0);
});