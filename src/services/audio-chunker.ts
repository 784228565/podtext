import * as FileSystem from 'expo-file-system/legacy';
import { debug, truncate } from '../utils/debug';

// ffmpeg-kit-react-native (lufinkey fork) bundles the AAR in android/libs/
// — no remote Maven dependency. Absent from Expo Go, present in EAS dev build.
let FFmpegKit: any = null;
try {
  const mod = require('ffmpeg-kit-react-native');
  const { NativeModules } = require('react-native');
  // ffmpeg-kit-react-native registers its native module as
  // FFmpegKitReactNativeModule, not FFmpegKit. The JS wrapper
  // (FFmpegKit) and the native bridge are separate things.
  if (mod && mod.FFmpegKit && NativeModules.FFmpegKitReactNativeModule) {
    FFmpegKit = mod.FFmpegKit;
  }
} catch {
  FFmpegKit = null;
}

export function isFFmpegAvailable(): boolean {
  return !!FFmpegKit;
}

const WORK_DIR = `${FileSystem.cacheDirectory}chunker/`;

// 16 kHz mono 16-bit PCM = 32 KB/s. A 5-minute chunk ≈ 9.4 MB, whose base64
// form (~12.5 MB) stays safely under the ~20 MB data-uri cap of the sync
// flash model.
export const CHUNK_SECONDS = 300;

async function runFFmpeg(args: string): Promise<void> {
  debug('FFMPEG', 'execute:', truncate(args, 200));
  const start = Date.now();
  const session = await FFmpegKit.execute(args);
  const rc = await session.getReturnCode();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  if (!rc.isValueSuccess()) {
    const output = await session.getOutput();
    debug('FFMPEG', `FAILED (${elapsed}s) rc=${rc.getValue()}:`, truncate(output || '', 500));
    throw new Error(`ffmpeg failed (rc=${rc.getValue()}): ${output || args}`);
  }
  debug('FFMPEG', `OK (${elapsed}s)`);
}

async function prepareWorkDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(WORK_DIR);
  if (info.exists) {
    await FileSystem.deleteAsync(WORK_DIR, { idempotent: true });
  }
  await FileSystem.makeDirectoryAsync(WORK_DIR, { intermediates: true });
}

// Extract the audio track of any media file as 16 kHz mono WAV.
// Returns the wav uri + its size in bytes.
export async function extractAudioWav(
  inputUri: string
): Promise<{ uri: string; sizeBytes: number }> {
  if (!FFmpegKit) throw new Error('ffmpeg not available in this build');
  await prepareWorkDir();
  debug('CHUNKER', 'extractAudioWav from:', truncate(inputUri, 120));
  const wavUri = `${WORK_DIR}full.wav`;
  await runFFmpeg(`-y -i "${inputUri}" -vn -ac 1 -ar 16000 -f wav "${wavUri}"`);
  const info = await FileSystem.getInfoAsync(wavUri);
  if (!info.exists || !info.size) throw new Error('ffmpeg produced no output');
  debug('CHUNKER', `WAV extracted: ${(info.size / 1024 / 1024).toFixed(1)} MB`);
  return { uri: wavUri, sizeBytes: info.size };
}

// Split a WAV into fixed-duration chunks. Returns chunk uris in order.
// Offset of chunk i = i * CHUNK_SECONDS (ffmpeg pads the last one short).
// NOTE: do NOT use `-c copy` with WAV — the segment muxer copies raw PCM
// bytes without generating proper RIFF headers for each chunk, producing
// invalid WAV files that ASR cannot decode. Let ffmpeg remux (no quality
// loss for PCM→PCM) so every chunk gets a valid WAV header.
export async function splitWavIntoChunks(wavUri: string): Promise<string[]> {
  if (!FFmpegKit) throw new Error('ffmpeg not available in this build');
  const pattern = `${WORK_DIR}chunk_%04d.wav`;
  debug('CHUNKER', 'splitWavIntoChunks, segment_time=', CHUNK_SECONDS, 's');
  await runFFmpeg(
    `-y -i "${wavUri}" -f segment -segment_time ${CHUNK_SECONDS} "${pattern}"`
  );
  const names = (await FileSystem.readDirectoryAsync(WORK_DIR))
    .filter((n) => /^chunk_\d+\.wav$/.test(n))
    .sort();
  if (names.length === 0) throw new Error('ffmpeg split produced no chunks');
  debug('CHUNKER', `split into ${names.length} chunks`);
  return names.map((n) => `${WORK_DIR}${n}`);
}

// One-shot helper: media file → wav chunks (or a single wav when small).
// Callers should always clean up with cleanupChunks() when done.
export async function mediaToWavChunks(
  inputUri: string,
  singleFileMaxBytes: number
): Promise<{ uris: string[]; chunked: boolean }> {
  const { uri, sizeBytes } = await extractAudioWav(inputUri);
  if (sizeBytes <= singleFileMaxBytes) {
    return { uris: [uri], chunked: false };
  }
  const uris = await splitWavIntoChunks(uri);
  return { uris, chunked: true };
}

export async function cleanupChunks(): Promise<void> {
  try {
    await FileSystem.deleteAsync(WORK_DIR, { idempotent: true });
  } catch {
    // best effort
  }
}
