import { open, stat } from 'fs/promises';
import { resolve, basename, sep } from 'path';
import { homedir, tmpdir } from 'os';
import { getOAuth2Token, hasOAuth2Config } from './client.js';

// X API v2 media upload endpoint (replaced v1.1 upload.twitter.com, sunset June 2025)
// Ref: https://docs.x.com/x-api/media-upload/api-reference
const UPLOAD_URL = 'https://upload.x.com/2/media/upload';
const CHUNK_SIZE = 5 * 1024 * 1024;

// Directories from which media upload is permitted (prevents path traversal)
const ALLOWED_ROOTS = [
  resolve(homedir()),
  resolve(tmpdir()),
];

function assertSafePath(resolvedPath: string): void {
  const isAllowed = ALLOWED_ROOTS.some(
    (root) => resolvedPath.startsWith(root + sep) || resolvedPath === root
  );
  if (!isAllowed) {
    throw new Error(
      `File path is outside permitted directories. ` +
      `Allowed roots: ${ALLOWED_ROOTS.join(', ')}`
    );
  }
}

const IMAGE_MIME_TYPES: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

const VIDEO_MIME_TYPES: Readonly<Record<string, string>> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  webm: 'video/webm',
  m4v: 'video/x-m4v',
};

const ALL_MIME_TYPES: Readonly<Record<string, string>> = {
  ...IMAGE_MIME_TYPES,
  ...VIDEO_MIME_TYPES,
};

const IMAGE_MAX_SIZE = 5 * 1024 * 1024;
const VIDEO_MAX_SIZE = 512 * 1024 * 1024;

interface ValidatedFile {
  readonly path: string;
  readonly mimeType: string;
  readonly size: number;
  readonly isVideo: boolean;
}

async function validateFile(filePath: string): Promise<ValidatedFile> {
  const sanitizedPath = resolve(filePath);
  assertSafePath(sanitizedPath);

  let fileStats;
  try {
    fileStats = await stat(sanitizedPath);
  } catch {
    throw new Error(`File not found: ${basename(sanitizedPath)}`);
  }

  if (!fileStats.isFile()) {
    throw new Error(`Path is not a file: ${basename(sanitizedPath)}`);
  }

  const ext = sanitizedPath.toLowerCase().split('.').pop() ?? '';
  const mimeType = ALL_MIME_TYPES[ext];

  if (!mimeType) {
    throw new Error(
      `Unsupported format. Supported: ${Object.keys(ALL_MIME_TYPES).join(', ')}`
    );
  }

  const isVideo = ext in VIDEO_MIME_TYPES;
  const maxSize = isVideo ? VIDEO_MAX_SIZE : IMAGE_MAX_SIZE;

  if (fileStats.size > maxSize) {
    const limitMB = maxSize / (1024 * 1024);
    const fileMB = (fileStats.size / (1024 * 1024)).toFixed(2);
    throw new Error(`File size ${fileMB}MB exceeds ${limitMB}MB limit`);
  }

  return { path: sanitizedPath, mimeType, size: fileStats.size, isVideo };
}

async function readFileChunk(filePath: string, start: number, length: number): Promise<Buffer> {
  const fh = await open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    await fh.read(buffer, 0, length, start);
    return buffer;
  } finally {
    await fh.close();
  }
}

async function requireOAuth2Token(): Promise<string> {
  const token = await getOAuth2Token();
  if (!token) {
    throw new Error(
      'Media upload requires OAuth 2.0 (v1.1 upload was sunset June 2025). ' +
      'Set TWITTER_OAUTH2_ACCESS_TOKEN or TWITTER_CLIENT_ID + TWITTER_OAUTH2_REFRESH_TOKEN.'
    );
  }
  return token;
}

async function simpleUpload(file: ValidatedFile, token: string): Promise<string> {
  const mediaCategory = file.mimeType === 'image/gif' ? 'tweet_gif' : 'tweet_image';
  const imageBuffer = await readFileChunk(file.path, 0, file.size);

  const formData = new FormData();
  formData.append('media_data', imageBuffer.toString('base64'));
  formData.append('media_category', mediaCategory);

  const response = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    console.error(`[Media Upload] API error: ${await response.text()}`);
    throw new Error(`Upload failed with status ${response.status}`);
  }

  const data = (await response.json()) as { media_id_string?: string };
  if (!data.media_id_string) {
    throw new Error('Upload response missing media_id_string');
  }
  return data.media_id_string;
}

async function chunkedUpload(file: ValidatedFile, token: string): Promise<string> {
  const headers = { Authorization: `Bearer ${token}` };

  // INIT
  const initResponse = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      command: 'INIT',
      total_bytes: file.size.toString(),
      media_type: file.mimeType,
      media_category: 'tweet_video',
    }),
  });

  if (!initResponse.ok) {
    console.error(`[Media Upload] INIT error: ${await initResponse.text()}`);
    throw new Error(`Upload INIT failed with status ${initResponse.status}`);
  }

  const initData = (await initResponse.json()) as { media_id_string?: string };
  if (!initData.media_id_string) {
    throw new Error('Upload INIT response missing media_id_string');
  }
  const mediaId = initData.media_id_string;

  // APPEND chunks — read each chunk from disk on demand to avoid loading entire video into memory
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const length = Math.min(CHUNK_SIZE, file.size - start);
    const chunk = await readFileChunk(file.path, start, length);

    const formData = new FormData();
    formData.append('command', 'APPEND');
    formData.append('media_id', mediaId);
    formData.append('segment_index', i.toString());
    formData.append('media', new Blob([new Uint8Array(chunk)]));

    const appendResponse = await fetch(UPLOAD_URL, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!appendResponse.ok) {
      console.error(`[Media Upload] APPEND chunk ${i} error: ${await appendResponse.text()}`);
      throw new Error(`Upload APPEND chunk ${i} failed with status ${appendResponse.status}`);
    }
  }

  // FINALIZE
  const finalizeResponse = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ command: 'FINALIZE', media_id: mediaId }),
  });

  if (!finalizeResponse.ok) {
    console.error(`[Media Upload] FINALIZE error: ${await finalizeResponse.text()}`);
    throw new Error(`Upload FINALIZE failed with status ${finalizeResponse.status}`);
  }

  const finalizeData = (await finalizeResponse.json()) as {
    media_id_string: string;
    processing_info?: { state: string; check_after_secs: number };
  };

  if (finalizeData.processing_info) {
    await waitForProcessing(mediaId, token);
  }

  return mediaId;
}

const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes max wait

async function waitForProcessing(mediaId: string, token: string): Promise<void> {
  const deadline = Date.now() + PROCESSING_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const response = await fetch(
      `${UPLOAD_URL}?command=STATUS&media_id=${mediaId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      console.error(`[Media Upload] Status check error: ${await response.text()}`);
      throw new Error(`Media status check failed with status ${response.status}`);
    }

    const data = (await response.json()) as {
      processing_info?: {
        state: string;
        check_after_secs: number;
        error?: { message: string };
      };
    };

    if (!data.processing_info) return;

    const { state, check_after_secs, error } = data.processing_info;
    if (state === 'succeeded') return;
    if (state === 'failed') {
      throw new Error(`Video processing failed: ${error?.message ?? 'unknown error'}`);
    }

    const waitMs = Math.min((check_after_secs ?? 5) * 1000, deadline - Date.now());
    if (waitMs <= 0) break;
    await new Promise((r) => setTimeout(r, waitMs));
  }

  throw new Error('Video processing timed out after 5 minutes');
}

export async function uploadMedia(filePath: string): Promise<string> {
  if (!hasOAuth2Config()) {
    throw new Error(
      'Media upload requires OAuth 2.0 (v1.1 upload endpoint was sunset June 2025). ' +
      'Set TWITTER_OAUTH2_ACCESS_TOKEN or TWITTER_CLIENT_ID + TWITTER_OAUTH2_REFRESH_TOKEN.'
    );
  }

  const file = await validateFile(filePath);
  const token = await requireOAuth2Token();

  return file.isVideo ? chunkedUpload(file, token) : simpleUpload(file, token);
}
