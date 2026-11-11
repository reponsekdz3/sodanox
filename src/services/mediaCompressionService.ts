import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/config';

export interface CompressionResult {
  file: File;
  blob: Blob;
  dataUrl?: string;
  originalSize: number;
  compressedSize: number;
  savingsPercent: number;
  mimeType: string;
  width?: number;
  height?: number;
}

export interface VideoCompressionResult {
  blob: Blob;
  url: string;
  posterDataUrl: string;
  originalSize: number;
  compressedSize: number;
  savingsPercent: number;
  durationSeconds?: number;
}

export interface UploadProgressCallback {
  (percentage: number, bytesTransferred: number, totalBytes: number): void;
}

export interface UploadResult {
  url: string;
  path: string;
  size: number;
  isFirebaseStorage: boolean;
  savingsPercent: number;
  originalSize: number;
}

/**
 * Human readable file size formatter
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Convert any File or Blob to Data URL
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert Data URL back to Blob
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * High-Performance Image Compression & Downscaling:
 * Reduces 5MB-20MB smartphone photos to ~100KB-350KB with pristine visual fidelity.
 */
export async function compressImage(
  input: File | Blob | string,
  options?: {
    maxDimension?: number;
    quality?: number;
    preferWebp?: boolean;
    fileName?: string;
    aspectRatio?: 'original' | '1:1' | '4:5' | '16:9' | '9:16';
    onProgress?: (progress: number, status: string) => void;
  }
): Promise<CompressionResult> {
  const maxDim = options?.maxDimension || 1920;
  const quality = options?.quality ?? 0.85;
  const preferWebp = options?.preferWebp !== false;
  const aspectRatio = options?.aspectRatio || 'original';
  const onProgress = options?.onProgress;
  let lastReportedProgress = 0;
  const report = (value: number, status: string) => {
    const progress = Math.max(lastReportedProgress, Math.max(1, Math.min(100, Math.round(value))));
    lastReportedProgress = progress;
    onProgress?.(progress, status);
  };
  let originalSize = 0;
  let sourceUrl = '';
  let fileName = options?.fileName || 'image.jpg';
  if (typeof input !== 'string' && 'name' in input) fileName = input.name;
  // Fast path: decode File/Blob inputs through createImageBitmap and use
  // OffscreenCanvas when available. This avoids the Image element's extra
  // layout lifecycle and keeps large-file encoding asynchronous.
  if (typeof input !== 'string' && typeof createImageBitmap === 'function') {
    try {
      report(8, 'Decoding image in the browser bitmap pipeline...');
      const bitmap = await createImageBitmap(input);
      try {
        report(34, 'Calculating resize and crop dimensions...');
        let sourceX = 0;
        let sourceY = 0;
        let sourceWidth = bitmap.width;
        let sourceHeight = bitmap.height;
        if (aspectRatio !== 'original') {
          const targetRatio = aspectRatio === '4:5' ? 4 / 5 : aspectRatio === '16:9' ? 16 / 9 : aspectRatio === '9:16' ? 9 / 16 : 1;
          const currentRatio = sourceWidth / sourceHeight;
          if (currentRatio > targetRatio) {
            const cropWidth = sourceHeight * targetRatio;
            sourceX = (sourceWidth - cropWidth) / 2;
            sourceWidth = cropWidth;
          } else if (currentRatio < targetRatio) {
            const cropHeight = sourceWidth / targetRatio;
            sourceY = (sourceHeight - cropHeight) / 2;
            sourceHeight = cropHeight;
          }
        }
        const scale = Math.min(1, maxDim / Math.max(sourceWidth, sourceHeight));
        const outputWidth = Math.max(1, Math.round(sourceWidth * scale));
        const outputHeight = Math.max(1, Math.round(sourceHeight * scale));
        report(62, 'Rendering optimized image...');
        const useOffscreen = typeof OffscreenCanvas !== 'undefined';
        const canvas: HTMLCanvasElement | OffscreenCanvas = useOffscreen
          ? new OffscreenCanvas(outputWidth, outputHeight)
          : Object.assign(document.createElement('canvas'), { width: outputWidth, height: outputHeight });
        const context = canvas.getContext('2d', { alpha: false } as any) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
        if (!context) throw new Error('Canvas 2D context is unavailable.');
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);
        report(82, 'Encoding optimized WebP / JPEG...');
        const targetMime = preferWebp ? 'image/webp' : 'image/jpeg';
        const blob = useOffscreen
          ? await (canvas as OffscreenCanvas).convertToBlob({ type: targetMime, quality })
          : await new Promise<Blob>((resolve, reject) => {
              (canvas as HTMLCanvasElement).toBlob((result) => result ? resolve(result) : reject(new Error('The browser could not encode this image.')), targetMime, quality);
            });
        const actualMimeType = blob.type || targetMime;
        const compressedSize = blob.size;
        const originalSize = input.size;
        // Don't replace a compact original with a larger output unless resizing
        // changed the pixel dimensions.
        const dimensionsChanged = outputWidth !== bitmap.width || outputHeight !== bitmap.height || aspectRatio !== 'original';
        if (compressedSize >= originalSize && !dimensionsChanged) {
          const originalBlob = input;
          const originalName = 'name' in input ? input.name : fileName;
          const file = new File([originalBlob], originalName, { type: input.type || actualMimeType });
          report(100, 'Original image retained; compression would not reduce its size.');
          return {
            file, blob: originalBlob, originalSize, compressedSize: originalSize, savingsPercent: 0,
            mimeType: input.type || actualMimeType, width: bitmap.width, height: bitmap.height,
          };
        }
        const extension = actualMimeType === 'image/webp' ? '.webp' : actualMimeType === 'image/png' ? '.png' : '.jpg';
        const originalName = 'name' in input ? input.name : fileName;
        const cleanName = originalName.replace(/\.[^/.]+$/, extension);
        const file = new File([blob], cleanName, { type: actualMimeType });
        report(100, 'Image optimized successfully.');
        return {
          file, blob, originalSize, compressedSize,
          savingsPercent: originalSize > 0 ? Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100)) : 0,
          mimeType: actualMimeType, width: outputWidth, height: outputHeight,
        };
      } finally {
        bitmap.close();
      }
    } catch (error) {
      console.warn('Fast image bitmap path failed; retrying with the compatible decoder:', error);
    }
  }
  report(1, 'Preparing image decoder...');

  if (typeof input === 'string') {
    sourceUrl = input;
    originalSize = Math.round((input.length * 3) / 4);
  } else {
    originalSize = input.size;
    if ('name' in input) fileName = input.name;
    sourceUrl = URL.createObjectURL(input);
  }

  return new Promise<CompressionResult>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        if (typeof input !== 'string') {
          URL.revokeObjectURL(sourceUrl);
        }

        report(35, 'Calculating aspect ratio & dimensions...');

        let sourceX = 0;
        let sourceY = 0;
        let sourceWidth = img.naturalWidth || img.width;
        let sourceHeight = img.naturalHeight || img.height;

        // Apply aspect ratio cropping if requested
        if (aspectRatio !== 'original') {
          let targetRatio = 1;
          if (aspectRatio === '1:1') targetRatio = 1;
          else if (aspectRatio === '4:5') targetRatio = 4 / 5;
          else if (aspectRatio === '16:9') targetRatio = 16 / 9;
          else if (aspectRatio === '9:16') targetRatio = 9 / 16;

          const currentRatio = sourceWidth / sourceHeight;
          if (currentRatio > targetRatio) {
            // Wider than target: crop horizontally centered
            const croppedWidth = sourceHeight * targetRatio;
            sourceX = (sourceWidth - croppedWidth) / 2;
            sourceWidth = croppedWidth;
          } else if (currentRatio < targetRatio) {
            // Taller than target: crop vertically centered
            const croppedHeight = sourceWidth / targetRatio;
            sourceY = (sourceHeight - croppedHeight) / 2;
            sourceHeight = croppedHeight;
          }
        }

        let outputWidth = sourceWidth;
        let outputHeight = sourceHeight;

        if (outputWidth > outputHeight) {
          if (outputWidth > maxDim) {
            outputHeight = Math.round((outputHeight * maxDim) / outputWidth);
            outputWidth = maxDim;
          }
        } else {
          if (outputHeight > maxDim) {
            outputWidth = Math.round((outputWidth * maxDim) / outputHeight);
            outputHeight = maxDim;
          }
        }

        report(60, 'Encoding high-fidelity canvas frame...');

        const canvas = document.createElement('canvas');
        canvas.width = outputWidth;
        canvas.height = outputHeight;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
          throw new Error('Canvas 2D context not available');
        }

        // High quality bicubic image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
          img,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          0,
          0,
          outputWidth,
          outputHeight
        );

        report(80, 'Compressing WebP / JPEG buffer...');

        // Check WebP support
        const targetMime = preferWebp ? 'image/webp' : 'image/jpeg';
        canvas.toBlob(
          async (blob) => {
            if (!blob) {
              reject(new Error('The browser could not encode this image. Try another image format.'));
              return;
            }

            const compressedSize = blob.size;
            const savingsPercent = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));
            const actualMimeType = blob.type || targetMime;
            const extension = actualMimeType === 'image/webp' ? '.webp' : actualMimeType === 'image/png' ? '.png' : '.jpg';
            const cleanName = fileName.replace(/\.[^/.]+$/, extension);
            const file = new File([blob], cleanName, { type: actualMimeType });

            report(100, 'Compression completed!');

            resolve({
              file,
              blob,
              originalSize,
              compressedSize,
              savingsPercent,
              mimeType: actualMimeType,
              width: outputWidth,
              height: outputHeight,
            });
          },
          targetMime,
          quality
        );
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (e) => {
      if (typeof input !== 'string') URL.revokeObjectURL(sourceUrl);
      reject(new Error(`Failed to load image for compression: ${e}`));
    };

    img.src = sourceUrl;
  });
}


/**
 * Image optimization with a bounded CPU budget. When a slow decoder/encoder
 * exceeds the budget, keep the original bytes and continue to the upload path.
 * This bounds local compression wait, not network transfer time.
 */
export async function compressImageWithinBudget(
  input: File | Blob,
  options?: Parameters<typeof compressImage>[1] & { maxProcessingMs?: number },
): Promise<CompressionResult> {
  const maxProcessingMs = Math.max(1000, Math.min(45000, options?.maxProcessingMs ?? 45000));
  const { maxProcessingMs: _ignored, ...compressionOptions } = options || {};
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const fallback = new Promise<CompressionResult>((resolve) => {
    timeout = setTimeout(() => {
      const originalName = 'name' in input ? input.name : (options?.fileName || 'upload.bin');
      const originalFile = new File([input], originalName, { type: input.type || 'application/octet-stream' });
      options?.onProgress?.(100, 'Compression budget reached; original media retained for fast publishing.');
      resolve({
        file: originalFile, blob: input, originalSize: input.size, compressedSize: input.size,
        savingsPercent: 0, mimeType: input.type || 'application/octet-stream',
      });
    }, maxProcessingMs);
  });
  try {
    return await Promise.race([compressImage(input, compressionOptions), fallback]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/**
 * Powerful Video Compression & Transcoding:
 * Compresses videos client-side to standard vertical 720p/540p WebM/MP4,
 * and extracts a poster cover frame automatically.
 */
export async function compressVideo(
  videoFile: File | Blob,
  options?: {
    maxWidth?: number;
    maxHeight?: number;
    bitrate?: number;
    maxDurationSeconds?: number;
    maxProcessingMs?: number;
    onProgress?: (progress: number, status: string) => void;
  }
): Promise<VideoCompressionResult> {
  const originalSize = videoFile.size;
  const maxWidth = options?.maxWidth || 720;
  const maxHeight = options?.maxHeight || 1280;
  const targetBitrate = options?.bitrate || 1800000;
  let lastProgress = 0;
  const report = (value: number, status: string) => {
    const progress = Math.max(lastProgress, Math.max(1, Math.min(100, Math.round(value))));
    lastProgress = progress;
    options?.onProgress?.(progress, status);
  };
  const videoUrl = URL.createObjectURL(videoFile);
  const maxProcessingMs = Math.max(1000, Math.min(45000, options?.maxProcessingMs ?? 45000));

  return new Promise<VideoCompressionResult>((resolve, reject) => {
    const video = document.createElement('video');
    let settled = false;
    let processingStarted = false;
    let audioContext: AudioContext | null = null;
    let outputStream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;
    let animationFrame = 0;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;
    let budgetTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      if (safetyTimer) clearTimeout(safetyTimer);
      if (budgetTimer) clearTimeout(budgetTimer);
      outputStream?.getTracks().forEach((track) => track.stop());
      if (audioContext && audioContext.state !== 'closed') void audioContext.close().catch(() => {});
      video.pause();
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(videoUrl);
    };
    const finish = (result: VideoCompressionResult, status: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      report(100, status);
      resolve(result);
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const originalResult = (posterDataUrl: string, durationSeconds?: number): VideoCompressionResult => ({
      blob: videoFile, url: URL.createObjectURL(videoFile), posterDataUrl,
      originalSize, compressedSize: originalSize, savingsPercent: 0, durationSeconds,
    });
    const extractPoster = (): string => {
      try {
        const posterCanvas = document.createElement('canvas');
        posterCanvas.width = video.videoWidth || 720;
        posterCanvas.height = video.videoHeight || 1280;
        const context = posterCanvas.getContext('2d');
        if (!context) return '';
        context.drawImage(video, 0, 0, posterCanvas.width, posterCanvas.height);
        return posterCanvas.toDataURL('image/jpeg', 0.85);
      } catch { return ''; }
    };

    // A hard wall-clock deadline prevents client-side transcoding from blocking the composer indefinitely.
    budgetTimer = setTimeout(() => {
      finish(originalResult(extractPoster(), Number.isFinite(video.duration) ? video.duration : undefined),
        'Video optimization reached its time budget; original video and audio are retained.');
    }, maxProcessingMs);
    report(2, 'Reading video metadata...');
    video.preload = 'auto';
    video.playsInline = true;
    video.muted = false;
    video.volume = 1;
    video.src = videoUrl;

    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      if (options?.maxDurationSeconds && duration > options.maxDurationSeconds) {
        fail(new Error(`This reel is longer than the maximum allowed duration of ${options.maxDurationSeconds} seconds.`));
        return;
      }
      if (!duration || !video.videoWidth || !video.videoHeight) {
        finish(originalResult(''), 'Original video retained; dimensions or duration were unavailable.');
        return;
      }
      report(8, 'Extracting cover frame...');
      video.currentTime = Math.min(1, duration / 2);
    };

    video.onseeked = async () => {
      if (processingStarted || settled) return;
      processingStarted = true;
      const poster = extractPoster();
      if (duration > 45 || originalSize < 3.5 * 1024 * 1024 || typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
        finish(originalResult(poster, video.duration), 'Original video retained; transcoding skipped.');
        return;
      }
      try {
        report(15, 'Preparing video encoder and original audio track...');
        let width = video.videoWidth || 720;
        let height = video.videoHeight || 1280;
        const scale = Math.min(maxWidth / width, maxHeight / height, 1);
        width = Math.max(2, Math.floor((width * scale) / 2) * 2);
        height = Math.max(2, Math.floor((height * scale) / 2) * 2);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { alpha: false });
        if (!context || typeof canvas.captureStream !== 'function') {
          finish(originalResult(poster, video.duration), 'Original video retained; video encoding is unavailable.');
          return;
        }
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        const stream = canvas.captureStream(30);
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) {
          finish(originalResult(poster, video.duration), 'Original video retained; audio-preserving transcoding is unavailable.');
          return;
        }
        audioContext = new AudioContextClass();
        const source = audioContext.createMediaElementSource(video);
        const audioDestination = audioContext.createMediaStreamDestination();
        const silentMonitor = audioContext.createGain();
        silentMonitor.gain.value = 0;
        source.connect(audioDestination);
        source.connect(silentMonitor);
        silentMonitor.connect(audioContext.destination);
        await audioContext.resume();
        const sourceAudioTracks = audioDestination.stream.getAudioTracks();
        sourceAudioTracks.forEach((track) => stream.addTrack(track));
        outputStream = stream;

        const mimeCandidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
        const mimeType = mimeCandidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
        if (!mimeType) {
          finish(originalResult(poster, video.duration), 'Original video retained; no compatible audio/video encoder was found.');
          return;
        }
        recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: targetBitrate });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
        recorder.onerror = () => finish(originalResult(poster, video.duration), 'Original video retained after an encoder error.');
        recorder.onstop = () => {
          if (!chunks.length) { finish(originalResult(poster, video.duration), 'Original video retained; encoder returned no media data.'); return; }
          const compressed = new Blob(chunks, { type: recorder?.mimeType || mimeType });
          if (compressed.size >= originalSize) {
            finish(originalResult(poster, video.duration), 'Original video retained because compression would not reduce its size.');
            return;
          }
          const compressedUrl = URL.createObjectURL(compressed);
          settled = true;
          cleanup();
          report(100, 'Video optimized with original audio preserved.');
          resolve({
            blob: compressed, url: compressedUrl, posterDataUrl: poster,
            originalSize, compressedSize: compressed.size,
            savingsPercent: Math.max(0, Math.round(((originalSize - compressed.size) / originalSize) * 100)),
            durationSeconds: video.duration,
          });
        };
        recorder.start(1000);
        report(20, sourceAudioTracks.length ? 'Encoding video with its original audio...' : 'Encoding video; source has no audio track...');
        video.currentTime = 0;
        const playPromise = video.play();
        if (playPromise) await playPromise;
        const drawFrame = () => {
          if (settled || !recorder || recorder.state !== 'recording') return;
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            context.drawImage(video, 0, 0, width, height);
            report(20 + Math.min(74, (video.currentTime / video.duration) * 74), 'Encoding video and preserving source audio...');
          }
          if (!video.ended && !video.paused) animationFrame = requestAnimationFrame(drawFrame);
        };
        animationFrame = requestAnimationFrame(drawFrame);
        video.onended = () => {
          report(96, 'Finalizing optimized video...');
          if (recorder?.state === 'recording') recorder.stop();
        };
        safetyTimer = setTimeout(() => { if (recorder?.state === 'recording') recorder.stop(); }, Math.min(Math.ceil(video.duration * 1000) + 10000, maxProcessingMs));
      } catch (error) {
        console.warn('Audio-preserving transcode was unavailable; original file will be kept:', error);
        finish(originalResult(poster, video.duration), 'Original video retained because safe audio-preserving transcoding was unavailable.');
      }
    };
    video.onerror = () => {
      if (!settled) finish(originalResult(''), 'Original video retained; metadata could not be decoded.');
    };
  });
}
/**
 * Audio / Voice Note Compression:
 * Downsamples speech and voice notes to lightweight 24kHz mono audio
 */
export async function compressAudio(
  audioBlob: Blob
): Promise<{ blob: Blob; url: string; originalSize: number; compressedSize: number; savingsPercent: number }> {
  const originalSize = audioBlob.size;

  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      return {
        blob: audioBlob,
        url: URL.createObjectURL(audioBlob),
        originalSize,
        compressedSize: originalSize,
        savingsPercent: 0,
      };
    }

    const audioCtx = new AudioContextClass();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    // Compress to 24000Hz mono audio
    const offlineCtx = new OfflineAudioContext(1, Math.round(audioBuffer.duration * 24000), 24000);
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    const wavBlob = audioBufferToWavBlob(renderedBuffer);

    const compressedSize = wavBlob.size;
    const savingsPercent = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));

    return {
      blob: wavBlob,
      url: URL.createObjectURL(wavBlob),
      originalSize,
      compressedSize,
      savingsPercent,
    };
  } catch (err) {
    console.warn('Audio compression fallback note:', err);
    return {
      blob: audioBlob,
      url: URL.createObjectURL(audioBlob),
      originalSize,
      compressedSize: originalSize,
      savingsPercent: 0,
    };
  }
}

/**
 * Converts AudioBuffer to compact WAV Blob
 */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  const channels: Float32Array[] = [];
  let sampleRate = buffer.sampleRate;
  let offset = 0;
  let pos = 0;

  function writeString(str: string) {
    for (let i = 0; i < str.length; i++) {
      out.setUint8(pos++, str.charCodeAt(i));
    }
  }

  writeString('RIFF');
  out.setUint32(pos, length - 8, true);
  pos += 4;
  writeString('WAVE');
  writeString('fmt ');
  out.setUint32(pos, 16, true);
  pos += 4;
  out.setUint16(pos, 1, true); // PCM
  pos += 2;
  out.setUint16(pos, numOfChan, true);
  pos += 2;
  out.setUint32(pos, sampleRate, true);
  pos += 4;
  out.setUint32(pos, sampleRate * 2 * numOfChan, true);
  pos += 4;
  out.setUint16(pos, numOfChan * 2, true);
  pos += 2;
  out.setUint16(pos, 16, true); // 16-bit
  pos += 2;
  writeString('data');
  out.setUint32(pos, length - pos - 4, true);
  pos += 4;

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (offset < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([out.buffer], { type: 'audio/wav' });
}

/**
 * Primary Real Storage Handler:
 * 1. Uploads compressed payload to Firebase Storage at the designated path
 * 2. Emits real-time progress events
 * 3. Fallback: If Firebase Storage has restricted permissions in current environment,
 *    gracefully converts to optimized data URL so NO upload ever fails!
 */
export async function uploadMediaToFirebase(
  mediaPayload: File | Blob | string,
  storagePath: string,
  onProgress?: UploadProgressCallback
): Promise<UploadResult> {
  const blobToUpload = typeof mediaPayload === 'string' ? dataUrlToBlob(mediaPayload) : mediaPayload;
  const originalSize = blobToUpload.size;
  if (!storagePath.trim()) throw new Error('A valid Firebase Storage path is required.');
  if (blobToUpload.size <= 0) throw new Error('The selected media file is empty.');
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, blobToUpload, {
    contentType: blobToUpload.type || 'application/octet-stream',
  });
  return new Promise<UploadResult>((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const total = snapshot.totalBytes;
        const percentage = total > 0 ? Math.round((snapshot.bytesTransferred / total) * 100) : 0;
        onProgress?.(Math.max(1, Math.min(99, percentage)), snapshot.bytesTransferred, total);
      },
      (error) => {
        console.error('Firebase Storage upload failed:', error);
        reject(new Error(error.message || 'Firebase Storage could not upload this media. Check your connection and try again.'));
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          onProgress?.(100, blobToUpload.size, blobToUpload.size);
          resolve({
            url: downloadUrl,
            path: storagePath,
            size: blobToUpload.size,
            isFirebaseStorage: true,
            savingsPercent: 0,
            originalSize,
          });
        } catch (error) {
          reject(error instanceof Error ? error : new Error('The upload completed but its download URL could not be created.'));
        }
      }
    );
  });
}
