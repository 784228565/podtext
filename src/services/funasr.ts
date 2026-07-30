import * as FileSystem from 'expo-file-system/legacy';
import { getSettings } from '../store/settings';

const FUNASR_BASE = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const FUNASR_ASYNC_SUBMIT = 'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription';
const FUNASR_TASK_BASE = 'https://dashscope.aliyuncs.com/api/v1/tasks';
const DASHSCOPE_UPLOAD = 'https://dashscope.aliyuncs.com/api/v1/uploads';

// Threshold above which we use the async file-transcription path (bypasses the
// ~20MB base64 Data-URI limit of the synchronous flash model). Kept well below
// 20MB so a known-size file can never hit the data-uri cap.
export const LARGE_FILE_MB = 15;

interface FunASRWord {
  text: string;
  begin_time: number;
  end_time: number;
  // Trailing punctuation attached to the word by Fun-ASR ("。"、"，"…).
  // subtitle.tsx relies on it to rebuild sentence boundaries.
  punctuation?: string;
}

interface FunASRSentence {
  text: string;
  begin_time: number;
  end_time: number;
  words?: FunASRWord[];
}

export interface FunASRResult {
  text: string;
  sentences: FunASRSentence[];
  // When true, `sentences` is ALREADY segmented (async path). When false,
  // `sentences[0]` holds one blob with all words and subtitle.tsx must split by "。".
  preSegmented: boolean;
}

export async function transcribeAudio(
  audioFileUri: string,
  language: string = 'ja',
  onProgress?: (msg: string) => void
): Promise<FunASRResult> {
  const settings = getSettings();
  const apiKey = settings.funasrApiKey;
  if (!apiKey) throw new Error('Fun-ASR API key not configured');
  onProgress?.('转录中...');

  const response = await fetch(audioFileUri);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let base64 = '';
  for (let i = 0; i < bytes.length; i += 4096) {
    base64 += String.fromCharCode(...bytes.subarray(i, i + 4096));
  }
  base64 = btoa(base64);
  const dataUri = `data:audio/mpeg;base64,${base64}`;

  const res = await fetch(FUNASR_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-DashScope-SSE': 'disable',
    },
    body: JSON.stringify({
      model: 'fun-asr-flash-2026-06-15',
      input: {
        messages: [{
          role: 'user',
          content: [{ type: 'input_audio', input_audio: { data: dataUri } }],
        }],
      },
      parameters: { format: 'wav', sample_rate: '16000' },
    }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Fun-ASR (${res.status}): ${text}`);

  const data = JSON.parse(text);
  const sentence = data.output?.output?.sentence;
  if (sentence?.text) {
    const words = (sentence.words || []).map((w: any) => ({
      text: w.text || '',
      begin_time: w.begin_time || 0,
      end_time: w.end_time || 0,
      punctuation: w.punctuation || '',
    }));
    return {
      text: sentence.text,
      sentences: [{ text: sentence.text, begin_time: sentence.begin_time || 0, end_time: sentence.end_time || 0, words }],
      preSegmented: false,
    };
  }
  throw new Error(`Fun-ASR unexpected response: ${text}`);
}

export async function transcribeJapanese(audioFileUri: string): Promise<FunASRResult> {
  return transcribeAudio(audioFileUri, 'ja');
}

// ---------------------------------------------------------------------------
// Large-file path: upload to DashScope temporary OSS, then async transcription.
// ---------------------------------------------------------------------------

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Expo SDK >=54 replaces the global fetch with expo/fetch (winter runtime),
// whose convertFormDataAsync only accepts string / Blob / { bytes() } parts
// and throws "Unsupported FormDataPart implementation" for React Native's
// classic { uri, name, type } file parts. XMLHttpRequest is NOT replaced and
// streams { uri } parts through the native networking stack (no JS memory
// buffering — important for large videos), so the OSS upload must go via XHR.
function postMultipartXHR(url: string, form: FormData): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText || '' });
    xhr.onerror = () => reject(new Error('OSS upload network error'));
    xhr.ontimeout = () => reject(new Error('OSS upload timed out'));
    xhr.send(form);
  });
}

async function uploadToTempOSS(
  fileUri: string,
  fileName: string,
  mimeType: string,
  apiKey: string
): Promise<string> {
  // Step 1: get upload policy
  const policyRes = await fetch(
    `${DASHSCOPE_UPLOAD}?action=getPolicy&model=fun-asr`,
    { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
  );
  const policyJson = await policyRes.json();
  // DashScope returns the policy nested under different shapes across models;
  // tolerate both `data` and `output` wrappers and grab the first usable blob.
  const d = policyJson.data || policyJson.output || policyJson;
  if (!d || (!d.upload_host && !d.upload_url) || (!d.upload_dir && !d.object_key_prefix)) {
    throw new Error(`Fun-ASR upload policy missing fields: ${JSON.stringify(policyJson)}`);
  }

  // Tolerant field extraction — field names vary across DashScope docs versions.
  const uploadHost = d.upload_host || d.upload_url;
  const uploadDir = d.upload_dir || d.object_key_prefix || d.dir;
  const ossAccessKeyId = d.oss_access_key_id || d.ossAccessKeyId || d.accessid;
  const signature = d.signature || d.sign || d.policy_signature;
  const policy = d.policy;
  const acl = d.x_oss_object_acl || d.acl || 'private';
  const forbidOverwrite = d.x_oss_forbid_overwrite || d.forbidOverwrite || 'true';

  // Step 2: POST file to OSS with signed policy
  const form = new FormData();
  if (ossAccessKeyId) form.append('OSSAccessKeyId', ossAccessKeyId);
  if (signature) form.append('Signature', signature);
  if (policy) form.append('policy', policy);
  form.append('x-oss-object-acl', acl);
  form.append('x-oss-forbid-overwrite', String(forbidOverwrite));
  form.append('key', `${uploadDir}/${fileName}`);
  form.append('success_action_status', '200');
  // Native XHR upload accepts a { uri, name, type } object for file parts
  // (never the raw asset) and sets the multipart boundary itself.
  form.append('file', {
    uri: fileUri,
    name: fileName || `upload-${Date.now()}.bin`,
    type: mimeType || 'application/octet-stream',
  } as any);

  const ossRes = await postMultipartXHR(uploadHost, form);
  if (ossRes.status < 200 || ossRes.status >= 300) {
    throw new Error(`Fun-ASR OSS upload failed (${ossRes.status}): ${ossRes.body}`);
  }
  // The oss:// URL is deterministic from upload_dir + fileName.
  return `oss://${uploadDir}/${fileName}`;
}

function num(v: any, fallback = 0): number {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && !isNaN(n) ? n : fallback;
}

// Tolerant extraction of sentence/word timings from the many possible shapes
// returned by the async fun-asr task.
function extractSentences(payload: any): FunASRSentence[] {
  if (!payload) return [];
  let candidates: any[] = [];

  // Direct shapes
  if (Array.isArray(payload.sentences)) candidates = payload.sentences;
  else if (Array.isArray(payload.transcripts)) candidates = payload.transcripts;
  else if (Array.isArray(payload.sentence_info)) candidates = payload.sentence_info;

  // Nested under a results[] array (task query response)
  const results = payload.results || payload.output?.results;
  if (Array.isArray(results)) {
    for (const r of results) {
      if (Array.isArray(r.sentence_info)) candidates = candidates.concat(r.sentence_info);
      else if (Array.isArray(r.sentences)) candidates = candidates.concat(r.sentences);
      else if (Array.isArray(r.transcripts)) candidates = candidates.concat(r.transcripts);
      else if (r.transcription_url) {
        // Defer: caller resolves the URL and re-invokes extractSentences.
        (payload as any).__needFetch = r.transcription_url;
      }
    }
  }

  const out: FunASRSentence[] = [];
  for (const c of candidates) {
    const text = c.text ?? c.sentence ?? c.content ?? '';
    if (!text) continue;
    const words: FunASRWord[] = (c.words || c.word_info || []).map((w: any) => ({
      text: w.text ?? '',
      begin_time: num(w.begin_time ?? w.start, 0),
      end_time: num(w.end_time ?? w.end, 0),
      punctuation: w.punctuation ?? '',
    }));
    out.push({
      text,
      begin_time: num(c.begin_time ?? c.start, 0),
      end_time: num(c.end_time ?? c.end, 0),
      words,
    });
  }
  return out;
}

async function transcribeLargeFile(
  fileUri: string,
  fileName: string,
  mimeType: string,
  apiKey: string,
  onProgress?: (msg: string) => void
): Promise<FunASRResult> {
  // 1. Upload
  onProgress?.('上传文件中...');
  const ossUrl = await uploadToTempOSS(fileUri, fileName, mimeType, apiKey);
  onProgress?.('文件已上传，等待转录...');

  // 2. Submit async task
  const subRes = await fetch(FUNASR_ASYNC_SUBMIT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable',
      'X-DashScope-OssResourceResolve': 'enable',
    },
    body: JSON.stringify({
      model: 'fun-asr',
      input: { file_urls: [ossUrl] },
      parameters: { channel_id: [0] },
    }),
  });
  const subJson = await subRes.json();
  if (!subRes.ok || !subJson.output?.task_id) {
    throw new Error(`Fun-ASR async submit failed: ${JSON.stringify(subJson)}`);
  }
  const taskId = subJson.output.task_id;

  // 3. Poll
  let last: any = null;
  const deadline = Date.now() + 10 * 60 * 1000; // 10 min
  const startedAt = Date.now();
  while (Date.now() < deadline) {
    await sleep(3000);
    const waited = Math.round((Date.now() - startedAt) / 1000);
    onProgress?.(`转录中（已等待 ${waited}s）...`);
    const qRes = await fetch(`${FUNASR_TASK_BASE}/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const qj = await qRes.json();
    last = qj;
    const status = qj.output?.task_status;
    if (status === 'SUCCEEDED') break;
    if (status === 'FAILED') throw new Error(`Fun-ASR task failed: ${JSON.stringify(qj.output || qj)}`);
  }
  if (last?.output?.task_status !== 'SUCCEEDED') {
    throw new Error(`Fun-ASR task did not finish in time: ${JSON.stringify(last?.output || last)}`);
  }

  // 4. Parse
  let sentences = extractSentences(last);
  // If results referenced a transcription_url, fetch and parse it too.
  const needFetch = (last as any).__needFetch;
  if (sentences.length === 0 && needFetch) {
    try {
      const fr = await fetch(needFetch, { headers: { Authorization: `Bearer ${apiKey}` } });
      const fj = await fr.json();
      sentences = extractSentences(fj);
    } catch { /* ignore, fall through */ }
  }

  if (sentences.length === 0) {
    throw new Error(`Fun-ASR async returned no sentences: ${JSON.stringify(last?.output || last)}`);
  }

  const fullText = sentences.map((s) => s.text).join('');
  return { text: fullText, sentences, preSegmented: true };
}

// Dispatch: small files use the synchronous flash model (word-level timings);
// large files use async file transcription (sentence-level timings).
export async function transcribe(
  fileUri: string,
  fileName: string,
  mimeType: string,
  sizeBytes: number,
  language: string = 'ja',
  onProgress?: (msg: string) => void
): Promise<FunASRResult> {
  const settings = getSettings();
  if (!settings.funasrApiKey) throw new Error('Fun-ASR API key not configured');
  let sizeMB = (sizeBytes || 0) / (1024 * 1024);

  // The document picker often reports size=0 on Android. Blindly treating
  // unknown size as "large" would route EVERY file to the async path, which
  // only returns sentence-level timings (no word highlight). Probe the real
  // size from disk first; only if the probe fails do we fall back to async.
  if (sizeMB <= 0) {
    try {
      const info = await FileSystem.getInfoAsync(fileUri);
      if (info.exists && typeof info.size === 'number' && info.size > 0) {
        sizeMB = info.size / (1024 * 1024);
      }
    } catch {
      // probe failed — sizeMB stays 0 → async path below
    }
  }

  // The synchronous flash model caps at ~20MB via base64 Data-URI.
  // Route to the async (OSS upload) path only when the file is clearly large
  // or its size could not be determined at all.
  if (sizeMB > LARGE_FILE_MB || sizeMB <= 0) {
    onProgress?.(
      sizeMB > LARGE_FILE_MB
        ? `文件较大（${sizeMB.toFixed(1)}MB），使用大文件异步转录...`
        : '文件大小未知，使用大文件异步转录...'
    );
    return transcribeLargeFile(fileUri, fileName, mimeType, settings.funasrApiKey, onProgress);
  }

  // Known small file → synchronous path (preserves word-level timings).
  try {
    return await transcribeAudio(fileUri, language, onProgress);
  } catch (err: any) {
    const msg = err?.message || '';
    // The sync path caps at 20MB data-uri. If it failed because of size, retry
    // via the async path instead of surfacing a hard error.
    if (/TooLarge|20971520|data-uri|max bytes/i.test(msg)) {
      onProgress?.('文件超过同步接口限制，自动切换到大文件异步转录...');
      return transcribeLargeFile(fileUri, fileName, mimeType, settings.funasrApiKey, onProgress);
    }
    throw err;
  }
}
