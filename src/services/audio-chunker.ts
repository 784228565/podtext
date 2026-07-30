import * as FileSystem from 'expo-file-system/legacy';

// ffmpeg-kit-react-native is a native module — absent from Expo Go, present in
// an EAS dev build. Same runtime-probe pattern as the player's ExponentAV
// check: require it, verify the native module exists, degrade gracefully.
let FFmpegKit: any = null;
try {
  const mod = require('ffmpeg-kit-react-native');
  const { NativeModules } = require('react-native');
  if (mod && mod.FFmpegKit && NativeModules.FFmpegKit) {
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
  const session = await FFmpegKit.execute(args);
  const rc = await session.getReturnCode();
  if (!rc.isValueSuccess()) {
    const output = await session.getOutput();
    throw new Error(`ffmpeg failed (rc=${rc.getValue()}): ${output || args}`);
  }
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
  const wavUri = `${WORK_DIR}full.wav`;
  await runFFmpeg(`-y -i "${inputUri}" -vn -ac 1 -ar 16000 -f wav "${wavUri}"`);
  const info = await FileSystem.getInfoAsync(wavUri);
  if (!info.exists || !info.size) throw new Error('ffmpeg produced no output');
  return { uri: wavUri, sizeBytes: info.size };
}

// Split a WAV into fixed-duration chunks. Returns chunk uris in order.
// Offset of chunk i = i * CHUNK_SECONDS (ffmpeg pads the last one short).
export async function splitWavIntoChunks(wavUri: string): Promise<string[]> {
  if (!FFmpegKit) throw new Error('ffmpeg not available in this build');
  const pattern = `${WORK_DIR}chunk_%04d.wav`;
  await runFFmpeg(
    `-y -i "${wavUri}" -f segment -segment_time ${CHUNK_SECONDS} -c copy "${pattern}"`
  );
  const names = (await FileSystem.readDirectoryAsync(WORK_DIR))
    .filter((n) => /^chunk_\d+\.wav$/.test(n))
    .sort();
  if (names.length === 0) throw new Error('ffmpeg split produced no chunks');
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
