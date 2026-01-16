import { spawn } from 'child_process';
import { mkdir, rm, writeFile } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getStorage } from '../storage/index.js';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { getKeyFromLicenseServer } from '../utils/grpc-client.js';

export interface PackagingJobData {
  jobId: string;
  contentId: string;
  inputPath: string;
  keyId?: string;  // If provided, content will be encrypted
  outputFormats: ('dash' | 'hls')[];
  drmSystems?: ('clearkey' | 'widevine' | 'fairplay')[];
  videoTracks?: {
    resolution?: string;
    bitrate?: number;
  }[];
  audioTracks?: {
    language?: string;
    bitrate?: number;
  }[];
}

export interface PackagingJobResult {
  contentId: string;
  outputs: {
    format: 'dash' | 'hls';
    manifestUrl: string;
    segments: string[];
  }[];
  keyId?: string;
  duration?: number;
}

/**
 * Process a packaging job using Shaka Packager
 */
export async function processPackagingJob(
  data: PackagingJobData,
  onProgress: (progress: number) => void
): Promise<PackagingJobResult> {
  const storage = getStorage();
  const workDir = path.join('/tmp', 'opendrm', data.jobId);
  const outputDir = path.join(workDir, 'output');

  try {
    // Create working directories
    await mkdir(workDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });

    onProgress(10);

    // Get encryption key if specified
    let keyInfo: { keyId: string; keyValue: string } | null = null;
    if (data.keyId) {
      keyInfo = await getKeyFromLicenseServer(data.keyId);
      logger.info({ keyId: data.keyId }, 'Retrieved encryption key');
    }

    onProgress(20);

    // Build Shaka Packager command
    const args = buildPackagerArgs(data, outputDir, keyInfo);

    logger.debug({ args }, 'Running Shaka Packager');

    // Run Shaka Packager
    await runPackager(args, onProgress);

    onProgress(80);

    // Upload outputs to storage
    const outputs = await uploadOutputs(data, outputDir, storage);

    onProgress(95);

    // Clean up temp files
    await rm(workDir, { recursive: true, force: true });

    onProgress(100);

    return {
      contentId: data.contentId,
      outputs,
      keyId: data.keyId,
    };
  } catch (error) {
    // Clean up on error
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

/**
 * Build Shaka Packager command arguments
 */
function buildPackagerArgs(
  data: PackagingJobData,
  outputDir: string,
  keyInfo: { keyId: string; keyValue: string } | null
): string[] {
  const args: string[] = [];

  // Input specification
  args.push(`in=${data.inputPath},stream=video,out=${outputDir}/video.mp4`);
  args.push(`in=${data.inputPath},stream=audio,out=${outputDir}/audio.mp4`);

  // Output formats
  if (data.outputFormats.includes('dash')) {
    args.push(`--mpd_output=${outputDir}/manifest.mpd`);
  }

  if (data.outputFormats.includes('hls')) {
    args.push(`--hls_master_playlist_output=${outputDir}/master.m3u8`);
  }

  // Encryption
  if (keyInfo) {
    args.push('--enable_raw_key_encryption');
    args.push(`--keys=key_id=${keyInfo.keyId}:key=${keyInfo.keyValue}`);

    // Add PSSH boxes for different DRM systems
    if (data.drmSystems?.includes('clearkey')) {
      args.push('--protection_scheme=cenc');
    }

    if (data.drmSystems?.includes('widevine')) {
      // Widevine PSSH would be added here if we had the provider
      args.push('--generate_static_live_mpd');
    }
  }

  // Segment settings
  args.push('--segment_duration=4');
  args.push('--fragment_duration=4');

  return args;
}

/**
 * Run Shaka Packager
 */
async function runPackager(
  args: string[],
  onProgress: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const packager = spawn(config.shakaPackagerPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';

    packager.stdout.on('data', (data) => {
      const line = data.toString();
      logger.debug({ output: line }, 'Packager output');

      // Parse progress from output if available
      const progressMatch = line.match(/(\d+)%/);
      if (progressMatch) {
        const progress = parseInt(progressMatch[1], 10);
        // Map packager progress (0-100) to our range (20-80)
        onProgress(20 + Math.floor(progress * 0.6));
      }
    });

    packager.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    packager.on('error', (error) => {
      reject(new Error(`Failed to start packager: ${error.message}`));
    });

    packager.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Packager exited with code ${code}: ${stderr}`));
      }
    });
  });
}

/**
 * Upload packaged outputs to storage
 */
async function uploadOutputs(
  data: PackagingJobData,
  outputDir: string,
  storage: ReturnType<typeof getStorage>
): Promise<PackagingJobResult['outputs']> {
  const { readdir, readFile } = await import('fs/promises');
  const outputs: PackagingJobResult['outputs'] = [];
  const storagePath = `content/${data.contentId}`;

  // List all files in output directory
  const files = await readdir(outputDir);

  for (const file of files) {
    const filePath = path.join(outputDir, file);
    const content = await readFile(filePath);
    const destPath = `${storagePath}/${file}`;

    await storage.write(destPath, content);
    logger.debug({ file: destPath }, 'Uploaded file');
  }

  // Build output info
  if (data.outputFormats.includes('dash')) {
    outputs.push({
      format: 'dash',
      manifestUrl: storage.getUrl(`${storagePath}/manifest.mpd`),
      segments: files
        .filter((f) => f.endsWith('.m4s') || f.endsWith('.mp4'))
        .map((f) => storage.getUrl(`${storagePath}/${f}`)),
    });
  }

  if (data.outputFormats.includes('hls')) {
    outputs.push({
      format: 'hls',
      manifestUrl: storage.getUrl(`${storagePath}/master.m3u8`),
      segments: files
        .filter((f) => f.endsWith('.ts') || f.endsWith('.m4s'))
        .map((f) => storage.getUrl(`${storagePath}/${f}`)),
    });
  }

  return outputs;
}
