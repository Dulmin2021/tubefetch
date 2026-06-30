#!/usr/bin/env node

'use strict';

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const cliProgress = require('cli-progress');

// ─── Helpers ────────────────────────────────────────────────────────────────

function isValidYouTubeUrl(url) {
  const patterns = [
    /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /^(https?:\/\/)?(www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  return patterns.some(p => p.test(url));
}

function checkYtDlp() {
  try {
    execSync('yt-dlp --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// ─── Clipboard ──────────────────────────────────────────────────────────────

function getClipboard() {
  try {
    if (process.platform === 'win32') {
      return execSync('powershell -command "Get-Clipboard"', { encoding: 'utf8', timeout: 3000 }).trim();
    } else if (process.platform === 'darwin') {
      return execSync('pbpaste', { encoding: 'utf8', timeout: 3000 }).trim();
    } else {
      return execSync('xclip -selection clipboard -o 2>/dev/null || xsel --clipboard --output 2>/dev/null', { encoding: 'utf8', timeout: 3000 }).trim();
    }
  } catch {
    return '';
  }
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return 'Unknown';
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').substring(0, 80);
}

// ─── Banner ─────────────────────────────────────────────────────────────────

function printBanner() {
  console.log('\n' + chalk.redBright.bold([
    '  ████████╗██╗   ██╗██████╗ ███████╗███████╗███████╗████████╗ ██████╗██╗  ██╗',
    '     ██╔══╝██║   ██║██╔══██╗██╔════╝██╔════╝██╔════╝╚══██╔══╝██╔════╝██║  ██║',
    '     ██║   ██║   ██║██████╔╝█████╗  █████╗  █████╗     ██║   ██║     ███████║',
    '     ██║   ██║   ██║██╔══██╗██╔══╝  ██╔══╝  ██╔══╝     ██║   ██║     ██╔══██║',
    '     ██║   ╚██████╔╝██████╔╝███████╗██║     ███████╗   ██║   ╚██████╗██║  ██║',
    '     ╚═╝    ╚═════╝ ╚═════╝ ╚══════╝╚═╝     ╚══════╝   ╚═╝    ╚═════╝╚═╝  ╚═╝',
  ].join('\n')));
  console.log(chalk.gray('  ─────────────────────────────────────────────────────────────────────────────'));
  console.log(chalk.white.bold('  📺  YouTube Video Downloader') + chalk.gray(' · powered by yt-dlp'));
  console.log(chalk.gray('  ─────────────────────────────────────────────────────────────────────────────\n'));
}

// ─── Fetch video info ────────────────────────────────────────────────────────

async function fetchVideoInfo(url) {
  return new Promise((resolve, reject) => {
    const args = ['--dump-json', '--no-warnings', '--no-playlist', url];
    const proc = spawn('yt-dlp', args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', d => (stdout += d.toString()));
    proc.stderr.on('data', d => (stderr += d.toString()));

    proc.on('close', code => {
      if (code !== 0 || !stdout.trim()) {
        return reject(new Error(stderr.trim() || 'yt-dlp returned no data'));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error('Failed to parse video metadata'));
      }
    });

    proc.on('error', err => reject(new Error(`yt-dlp not found: ${err.message}`)));
  });
}

// ─── Build format list ───────────────────────────────────────────────────────

function buildFormatChoices(videoData) {
  const seen = new Set();
  const choices = [];

  // Video formats
  const videoFormats = (videoData.formats || [])
    .filter(f => f.vcodec && f.vcodec !== 'none' && f.height)
    .sort((a, b) => (b.height || 0) - (a.height || 0));

  for (const f of videoFormats) {
    const label = `${f.height}p`;
    if (seen.has(label)) continue;
    seen.add(label);
    const size = formatBytes(f.filesize || f.filesize_approx);
    choices.push({
      name: `${chalk.cyan(label.padEnd(8))} ${chalk.gray('mp4')}  ${chalk.yellow(size)}`,
      value: { type: 'video', quality: label, height: f.height },
      short: label,
    });
    if (choices.length >= 5) break;
  }

  // Audio only
  choices.push({
    name: `${chalk.magenta('Audio'.padEnd(8))} ${chalk.gray('mp3')}  ${chalk.yellow('~varies')}`,
    value: { type: 'audio', quality: 'audio' },
    short: 'Audio only',
  });

  return choices;
}

// ─── Download ────────────────────────────────────────────────────────────────

async function downloadVideo(url, format, outputDir, videoTitle) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(outputDir, { recursive: true });

    const safeName = sanitizeFilename(videoTitle);
    const suffix = format.type === 'audio' ? 'audio' : format.quality;
    const outputTemplate = path.join(outputDir, `${safeName}_${suffix}.%(ext)s`);

    let args;
    if (format.type === 'audio') {
      args = [
        '-x', '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--no-playlist',
        '--newline',
        '-o', outputTemplate,
        url,
      ];
    } else {
      args = [
        '-f', `best[height<=${format.height}][ext=mp4]/best[height<=${format.height}]/best[ext=mp4]/best`,
        '--no-playlist',
        '--newline',
        '-o', outputTemplate,
        url,
      ];
    }

    console.log('');
    const bar = new cliProgress.SingleBar({
      format: `  ${chalk.green('{bar}')} {percentage}%  ${chalk.gray('|')} ${chalk.cyan('{downloaded}')}  ${chalk.gray('ETA:')} {eta_formatted}`,
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true,
      clearOnComplete: false,
    });

    bar.start(100, 0, { downloaded: '0 MB', eta_formatted: '...' });

    const proc = spawn('yt-dlp', args);
    let lastFile = '';

    proc.stdout.on('data', data => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        // Parse progress: [download]  55.2% of ~100MB at 3.00MiB/s ETA 00:12
        const pct = line.match(/\[download\]\s+([\d.]+)%/);
        const downloaded = line.match(/of\s+~?([\d.]+\s*\w+B)/);
        const eta = line.match(/ETA\s+([\d:]+)/);
        const dest = line.match(/\[download\] Destination:\s+(.+)/);

        if (dest) lastFile = dest[1].trim();
        if (pct) {
          const p = parseFloat(pct[1]);
          bar.update(p, {
            downloaded: downloaded ? downloaded[1] : '',
            eta_formatted: eta ? eta[1] : '...',
          });
        }
      }
    });

    proc.stderr.on('data', data => {
      const msg = data.toString();
      // Only show real errors, not warnings
      if (msg.includes('ERROR')) {
        bar.stop();
        console.error(chalk.red('\n  ❌ ' + msg.trim()));
      }
    });

    proc.on('close', code => {
      bar.update(100, { downloaded: '', eta_formatted: 'Done' });
      bar.stop();
      if (code === 0) {
        resolve(lastFile || outputTemplate);
      } else {
        reject(new Error(`yt-dlp exited with code ${code}`));
      }
    });

    proc.on('error', err => {
      bar.stop();
      reject(new Error(`Failed to start yt-dlp: ${err.message}`));
    });
  });
}

// ─── Display video info panel ────────────────────────────────────────────────

function displayVideoInfo(info) {
  const border = chalk.gray('─'.repeat(60));
  console.log('\n  ' + border);
  console.log(`  ${chalk.gray('Title    ')} ${chalk.white.bold(info.title)}`);
  console.log(`  ${chalk.gray('Channel  ')} ${chalk.white(info.uploader || info.channel || 'Unknown')}`);
  console.log(`  ${chalk.gray('Duration ')} ${chalk.yellow(info.duration_string || 'Unknown')}`);
  console.log(`  ${chalk.gray('Views    ')} ${chalk.white(info.view_count ? info.view_count.toLocaleString() : 'Unknown')}`);
  console.log('  ' + border + '\n');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  program
    .name('tubefetch')
    .description('YouTube video downloader CLI')
    .version('2.0.0')
    .option('-u, --url <url>', 'YouTube video URL')
    .option('-q, --quality <quality>', 'Video quality (e.g. 1080p, 720p, 480p, 360p, audio)')
    .option('-o, --output <dir>', 'Output directory', './downloads')
    .parse(process.argv);

  const opts = program.opts();

  printBanner();

  // yt-dlp check
  if (!checkYtDlp()) {
    console.error(chalk.red('  ❌  yt-dlp is not installed or not found in PATH.'));
    console.log(chalk.gray('  ➜  Install it from: https://github.com/yt-dlp/yt-dlp#installation\n'));
    process.exit(1);
  }

  // ── Get URL ──
  let url = opts.url;

  if (!url) {
    // Try clipboard first — avoids CMD & breakage issue
    const clipUrl = getClipboard();
    if (clipUrl && isValidYouTubeUrl(clipUrl)) {
      console.log(`  ${chalk.gray('📋 Clipboard URL detected:')} ${chalk.cyan(clipUrl)}`);
      const { useClip } = await inquirer.prompt([{
        type: 'confirm',
        name: 'useClip',
        message: chalk.white('Use this URL?'),
        default: true,
      }]);
      if (useClip) url = clipUrl;
    }
  }

  if (!url && !opts.url) {
    console.log(chalk.gray('  💡 Tip: Copy the YouTube URL first — we can read it from your clipboard automatically!\n'));
    const answer = await inquirer.prompt([{
      type: 'input',
      name: 'url',
      message: chalk.white('Enter YouTube URL:'),
      validate: input => {
        const trimmed = input.trim();
        if (!trimmed) return 'URL cannot be empty';
        if (!isValidYouTubeUrl(trimmed)) return 'Please enter a valid YouTube URL (e.g. https://youtube.com/watch?v=...)';
        return true;
      },
    }]);
    url = answer.url.trim();
  } else if (opts.url && !isValidYouTubeUrl(opts.url)) {
    console.error(chalk.red('  ❌  Invalid YouTube URL'));
    process.exit(1);
  }

  // ── Fetch info ──
  const spinner = ora({ text: chalk.gray('Fetching video info...'), color: 'red' }).start();
  let videoData;
  try {
    videoData = await fetchVideoInfo(url);
    spinner.succeed(chalk.green('Video info fetched!'));
  } catch (err) {
    spinner.fail(chalk.red('Failed to fetch video info'));
    console.error(chalk.gray(`  ${err.message}\n`));
    process.exit(1);
  }

  displayVideoInfo(videoData);

  // ── Choose format ──
  const formatChoices = buildFormatChoices(videoData);
  let selectedFormat;

  if (opts.quality) {
    const q = opts.quality.toLowerCase();
    if (q === 'audio') {
      selectedFormat = { type: 'audio', quality: 'audio' };
    } else {
      const height = parseInt(q);
      if (!isNaN(height)) {
        selectedFormat = { type: 'video', quality: `${height}p`, height };
      }
    }
  }

  if (!selectedFormat) {
    const answer = await inquirer.prompt([{
      type: 'list',
      name: 'format',
      message: chalk.white('Select quality:'),
      choices: formatChoices,
      pageSize: 8,
    }]);
    selectedFormat = answer.format;
  }

  // ── Download ──
  const outputDir = opts.output || './downloads';
  console.log(chalk.gray(`\n  ⬇  Downloading ${chalk.white.bold(selectedFormat.quality)} to ${chalk.cyan(outputDir)} ...\n`));

  try {
    const savedPath = await downloadVideo(url, selectedFormat, outputDir, videoData.title);
    console.log('\n  ' + chalk.green('✔') + chalk.white.bold('  Download complete!'));
    console.log(chalk.gray(`  📁  Saved to: ${chalk.cyan(path.resolve(savedPath || outputDir))}\n`));
  } catch (err) {
    console.error(chalk.red(`\n  ❌  Download failed: ${err.message}\n`));
    process.exit(1);
  }
}

main().catch(err => {
  console.error(chalk.red(`\n  ❌  Unexpected error: ${err.message}\n`));
  process.exit(1);
});
