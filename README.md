# 🎥 TubeFetch

A fast, simple, and reliable YouTube video downloader built with React and Node.js. Download your favorite YouTube videos in multiple quality options with a clean, modern interface.

![TubeFetch](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![React](https://img.shields.io/badge/react-19.2.0-blue)

## ⚡ Features

- 🚀 **Fast Downloads** - Direct streaming from YouTube to your browser
- 📺 **Multiple Quality Options** - Choose from 360p, 480p, 720p, and 1080p
- 🎨 **Modern UI** - Clean, responsive design with real-time video preview
- ⚡ **Real-time Streaming** - Download starts immediately without server-side buffering
- 🔒 **Secure** - Rate limiting and input validation for security
- 📱 **Responsive** - Works seamlessly on desktop and mobile devices
- 🎯 **Simple** - Just paste a URL, select quality, and download

## ⚠️ Legal Notice

**Important:** This tool is for **personal use only**. Downloading videos may violate YouTube's Terms of Service. Only download content you own or have permission to download. You are responsible for respecting copyright laws and intellectual property rights.

## 🛠️ Tech Stack

### Frontend
- **React** 19.2.0 - UI framework
- **Lucide React** - Modern icon library
- **CSS3** - Styling with gradients and animations

### Backend
- **Node.js** - Runtime environment
- **Express** 5.1.0 - Web framework
- **yt-dlp** - YouTube download engine
- **Helmet** - Security middleware
- **express-rate-limit** - API rate limiting
- **CORS** - Cross-origin resource sharing

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18.0.0 or higher)
- **npm** or **yarn**
- **yt-dlp** - [Installation Guide](https://github.com/yt-dlp/yt-dlp#installation)

### Installing yt-dlp

```bash
# Linux/macOS
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ~/.local/bin/yt-dlp
chmod a+rx ~/.local/bin/yt-dlp

# Or via pip
pip install yt-dlp

# Or via homebrew (macOS)
brew install yt-dlp
```

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Dulmin2021/tubefetch.git
cd tubefetch
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

### 4. Configure Environment Variables (Optional)

Create a `.env` file in the `backend` directory:

```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

Create a `.env` file in the `frontend` directory:

```env
REACT_APP_API_URL=http://localhost:3001
```

### 5. Start the Backend Server

```bash
cd backend
npm start
```

The backend will run on `http://localhost:3001`

### 6. Start the Frontend Development Server

```bash
cd frontend
npm start
```

The frontend will run on `http://localhost:3000`

## 🎯 Usage

1. **Open the app** in your browser at `http://localhost:3000`
2. **Paste a YouTube URL** in the input field
3. **Click "Fetch Video"** to retrieve video information
4. **Select your preferred quality** (360p, 480p, 720p, or 1080p)
5. **Click "Download Video"** to start the download
6. **Wait for the download** to complete - the file will be saved to your Downloads folder

## 🏗️ Project Structure

```
tubefetch/
├── backend/
│   ├── server.js          # Express server and API routes
│   ├── temp/              # Temporary storage (auto-created)
│   └── package.json       # Backend dependencies
├── frontend/
│   ├── public/
│   │   └── index.html     # HTML template
│   ├── src/
│   │   ├── App.js         # Main React component
│   │   ├── App.css        # Styling
│   │   └── index.js       # React entry point
│   └── package.json       # Frontend dependencies
├── docker-compose.yml     # Docker configuration
├── Dockerfile             # Docker image definition
└── README.md              # Project documentation
```

## 🐳 Docker Deployment

### Build and Run with Docker Compose

```bash
# Build and start containers
docker-compose up --build

# Run in detached mode
docker-compose up -d

# Stop containers
docker-compose down
```

### Access the Application

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001`

## 📡 API Endpoints

### GET `/`
Health check endpoint

**Response:**
```json
{
  "status": "healthy",
  "service": "TubeFetch API",
  "version": "1.0.0",
  "timestamp": "2025-12-16T20:00:00.000Z"
}
```

### POST `/api/video-info`
Fetch video metadata

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

**Response:**
```json
{
  "title": "Video Title",
  "thumbnail": "https://...",
  "duration": "10:30",
  "author": "Channel Name",
  "formats": [
    {
      "quality": "720p",
      "format": "mp4",
      "filesize": "~25 MB",
      "format_id": "22"
    }
  ]
}
```

### GET `/api/download`
Download video

**Query Parameters:**
- `url` - YouTube video URL (required)
- `quality` - Video quality: 360p, 480p, 720p, or 1080p (required)

**Response:**
Streams video file directly to client

## 🔧 Configuration

### Rate Limiting

The API includes rate limiting to prevent abuse:

- **Video Info**: 20 requests per 15 minutes
- **Downloads**: 10 downloads per hour

Modify in `backend/server.js`:

```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20
});

const downloadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10
});
```

## 🔒 Security Features

- **Helmet.js** - Sets secure HTTP headers
- **CORS** - Configurable cross-origin resource sharing
- **Input Validation** - URL sanitization and validation
- **Rate Limiting** - Prevents API abuse
- **Timeouts** - Prevents hanging requests

## 🐛 Troubleshooting

### yt-dlp not found
```bash
# Verify installation
yt-dlp --version

# Add to PATH if needed
export PATH="$HOME/.local/bin:$PATH"
```

### HTTP 403 Forbidden errors
YouTube occasionally blocks downloads. This is usually temporary. Try:
- Updating yt-dlp: `pip install --upgrade yt-dlp`
- Waiting a few minutes and trying again
- Using a different video

### Download stuck on "Preparing Download..."
- Check that yt-dlp is properly installed
- Check backend console for error messages
- Ensure the video isn't age-restricted or region-locked

### CORS errors
Update `backend/server.js` to include your frontend URL:

```javascript
const allowedOrigins = [
  'http://localhost:3000',
  'https://yourdomain.com'
];
```

## 📝 Development

### Backend Development Mode

```bash
cd backend
npm run dev  # Uses nodemon for auto-restart
```

### Frontend Development Mode

```bash
cd frontend
npm start  # Hot reload enabled
```

### Build for Production

```bash
cd frontend
npm run build
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚖️ Disclaimer

This project is for educational purposes only. The developers do not encourage or condone the downloading of copyrighted material without permission. Users are solely responsible for their actions and must comply with applicable laws and YouTube's Terms of Service.

## 🙏 Acknowledgments

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - The powerful download engine
- [React](https://react.dev/) - The UI framework
- [Express](https://expressjs.com/) - The backend framework
- [Lucide](https://lucide.dev/) - Beautiful icon library

## 📧 Contact

Project Link: [https://github.com/Dulmin2021/tubefetch](https://github.com/Dulmin2021/tubefetch)

---

Made with ❤️ by Dulmin2021
