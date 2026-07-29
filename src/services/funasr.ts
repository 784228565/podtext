import { getSettings } from '../store/settings';

const FUNASR_BASE = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

interface FunASRResult {
  text: string;
  sentences: Array<{
    text: string;
    begin_time: number;
    end_time: number;
  }>;
}

export async function transcribeAudio(
  audioFileUri: string,
  language: string = 'ja'
): Promise<FunASRResult> {
  const settings = getSettings();
  const apiKey = settings.funasrApiKey;

  if (!apiKey) throw new Error('Fun-ASR API key not configured');

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
      parameters: {
        format: 'wav',
        sample_rate: '16000',
      },
    }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Fun-ASR (${res.status}): ${text}`);

  const data = JSON.parse(text);
  const content = data.output?.choices?.[0]?.message?.content?.[0];

  if (content?.transcription) {
    return {
      text: content.transcription.text || '',
      sentences: (content.transcription.sentences || []).map((s: any) => ({
        text: s.text || '',
        begin_time: s.begin_time || 0,
        end_time: s.end_time || 0,
      })),
    };
  }

  throw new Error(`Fun-ASR unexpected response: ${text}`);
}

export async function transcribeJapanese(audioFileUri: string): Promise<FunASRResult> {
  return transcribeAudio(audioFileUri, 'ja');
}
