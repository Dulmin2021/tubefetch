
import React, { useState } from 'react';
import { Download, AlertCircle, CheckCircle, Loader, Video, Info } from 'lucide-react';
import './App.css';

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [videoInfo, setVideoInfo] = useState(null);
  const [error, setError] = useState('');
  const [selectedQuality, setSelectedQuality] = useState('');

  // API URL - reads from environment variable or defaults to localhost
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  // Validate YouTube URL
  const validateYouTubeUrl = (url) => {
    const patterns = [
      /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
      /^(https?:\/\/)?(www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/
    ];
    return patterns.some(pattern => pattern.test(url));
  };

  // Fetch video information from backend
  const handleFetchVideo = async () => {
    setError('');
    setVideoInfo(null);
    
    if (!url.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }

    if (!validateYouTubeUrl(url)) {
      setError('Please enter a valid YouTube URL');
      return;
    }

    setLoading(true);

    try {
      console.log('Fetching video info from:', `${API_URL}/api/video-info`);
      
      const response = await fetch(`${API_URL}/api/video-info`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch video information');
      }
      
      const data = await response.json();
      console.log('Video info received:', data);
      
      setVideoInfo(data);
      setSelectedQuality(data.formats[0]?.quality || '720p');
      setLoading(false);
      
    } catch (err) {
      console.error('Error fetching video:', err);
      setError(err.message || 'Failed to fetch video information. Make sure the backend is running.');
      setLoading(false);
    }
  };

  // Download video
  const handleDownload = async () => {
    if (!videoInfo || !selectedQuality) return;

    setLoading(true);
    setError('');

    try {
      // Create download URL with query parameters
      const downloadUrl = `${API_URL}/api/download?url=${encodeURIComponent(url)}&quality=${selectedQuality}`;
      
      console.log('Starting download from:', downloadUrl);
      
      // Fetch the video file with a longer timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3600000); // 60 minutes timeout for streaming
      
      const response = await fetch(downloadUrl, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        let errorMessage = `Download failed with status ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          if (errorData.details) {
            errorMessage += `: ${errorData.details}`;
          }
        } catch (e) {
          // Response wasn't JSON
        }
        throw new Error(errorMessage);
      }

      // Get the filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'video.mp4';
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Convert response to blob with progress
      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error('Download returned empty file. The video may not be available.');
      }

      // Create blob URL and download
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      
      // Append to body, click, and cleanup
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
        setLoading(false);
        const sizeInMB = (blob.size / 1024 / 1024).toFixed(2);
        alert(`✅ Download completed!\n\nVideo: ${videoInfo.title}\nQuality: ${selectedQuality}\nFile: ${filename}\nSize: ${sizeInMB}MB`);
      }, 500);
      
    } catch (err) {
      console.error('Download error:', err);
      
      let errorMessage = err.message;
      if (err.name === 'AbortError') {
        errorMessage = 'Download timeout. The video took too long to process.';
      }
      
      setError(`❌ ${errorMessage}`);
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        {/* Header */}
        <header className="header">
          <div className="container">
            <div className="header-content">
              <div className="logo">
                <Video className="logo-icon" />
                <h1>TubeFetch</h1>
              </div>
              <span className="version">v1.0</span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="main-content">
          {/* Hero Section */}
          <div className="hero">
            <h2 className="hero-title">Download YouTube Videos</h2>
            <p className="hero-subtitle">
              Fast, reliable, and simple. Paste a URL and download in seconds.
            </p>
          </div>

          {/* URL Input Section */}
          <div className="card">
            <div className="input-section">
              <label className="input-label">YouTube Video URL</label>
              <div className="input-group">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleFetchVideo()}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="input-field"
                  disabled={loading}
                />
                <button
                  onClick={handleFetchVideo}
                  disabled={loading}
                  className="fetch-button"
                >
                  {loading ? (
                    <>
                      <Loader className="button-icon spin" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      <Info className="button-icon" />
                      <span>Fetch Video</span>
                    </>
                  )}
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="error-message">
                  <AlertCircle className="error-icon" />
                  <span>{error}</span>
                </div>
              )}

              {/* Connection Status */}
              <div className="info-message">
                <Info className="info-icon" />
                <span>Backend: {API_URL}</span>
              </div>
            </div>
          </div>

          {/* Video Info & Download Section */}
          {videoInfo && (
            <div className="card">
              {/* Video Preview */}
              <div className="video-preview">
                <img
                  src={videoInfo.thumbnail}
                  alt={videoInfo.title}
                  className="thumbnail"
                />
                <div className="video-details">
                  <h3 className="video-title">{videoInfo.title}</h3>
                  <div className="video-meta">
                    <span>{videoInfo.author}</span>
                    <span>•</span>
                    <span>{videoInfo.duration}</span>
                  </div>
                </div>
                <CheckCircle className="success-icon" />
              </div>

              {/* Quality Selection */}
              <div className="quality-section">
                <label className="input-label">Select Quality</label>
                <div className="quality-grid">
                  {videoInfo.formats.map((format) => (
                    <button
                      key={format.quality}
                      onClick={() => setSelectedQuality(format.quality)}
                      className={`quality-button ${selectedQuality === format.quality ? 'selected' : ''}`}
                    >
                      <div className="quality-label">{format.quality}</div>
                      <div className="quality-size">{format.filesize}</div>
                      <div className="quality-format">{format.format}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Download Button */}
              <button
                onClick={handleDownload}
                disabled={loading}
                className="download-button"
              >
                {loading ? (
                  <>
                    <Loader className="button-icon spin" />
                    <span>Preparing Download...</span>
                  </>
                ) : (
                  <>
                    <Download className="button-icon" />
                    <span>Download Video ({selectedQuality})</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Features */}
          <div className="features">
            <div className="feature">
              <div className="feature-icon">
                <Download />
              </div>
              <h3>Fast Downloads</h3>
              <p>Get your videos in seconds with optimized download speeds</p>
            </div>
            <div className="feature">
              <div className="feature-icon">
                <Video />
              </div>
              <h3>Multiple Qualities</h3>
              <p>Choose from 360p to 1080p based on your needs</p>
            </div>
            <div className="feature">
              <div className="feature-icon">
                <CheckCircle />
              </div>
              <h3>Simple & Clean</h3>
              <p>No ads, no clutter. Just paste and download</p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="footer">
          <div className="container">
            <p>© 2023 TubeFetch. Use responsibly and respect copyright laws.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;