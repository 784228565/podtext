import { getSettings } from '../store/settings';

const MIMO_BASE = 'https://api.xiaomimimo.com/v1';

interface MiMoTranslationResult {
  translated: string;
  original: string;
}

export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  const settings = getSettings();
  if (!settings.mimoApiKey) throw new Error('MiMo API key not configured');

  const res = await fetch(`${MIMO_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': settings.mimoApiKey,
    },
    body: JSON.stringify({
      model: 'mimo-v2.5-pro',
      messages: [
        {
          role: 'user',
          content: `Translate the following text from ${sourceLang} to ${targetLang}. Return ONLY the translation, no explanations:\n\n${text}`,
        },
      ],
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiMo API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content.trim();
}

export interface PodcastScript {
  title: string;
  segments: PodcastSegment[];
}

export interface PodcastSegment {
  speaker: 'host' | 'cohost';
  text: string;
  translation: string;
}

export async function generatePodcastScript(
  inputText: string,
  sourceLang: string = 'auto'
): Promise<PodcastScript> {
  const settings = getSettings();
  if (!settings.mimoApiKey) throw new Error('MiMo API key not configured');

  const prompt = `You are a podcast script generator. Given the following text, create an engaging English dual-host conversation between Chloe (host, professional and warm) and Dean (co-host, curious and witty).

Rules:
- Generate 10-20 dialogue exchanges
- Each turn should be 1-3 sentences, conversational
- Chloe starts and leads the discussion
- Dean asks insightful follow-up questions
- Content should be educational yet entertaining
- Include a title for the episode

Output format (strict JSON):
{
  "title": "Episode title",
  "segments": [
    {"speaker": "host", "text": "English dialogue", "translation": "Chinese translation"},
    {"speaker": "cohost", "text": "English dialogue", "translation": "Chinese translation"}
  ]
}

Source text:
${inputText}`;

  const res = await fetch(`${MIMO_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': settings.mimoApiKey,
    },
    body: JSON.stringify({
      model: 'mimo-v2.5-pro',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.8,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiMo API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const content = data.choices[0].message.content.trim();

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    return JSON.parse(jsonMatch[0]) as PodcastScript;
  } catch (e) {
    throw new Error(`Failed to parse podcast script: ${e}`);
  }
}

export async function transcribeAudio(
  audioBase64: string,
  format: string = 'wav'
): Promise<string> {
  const settings = getSettings();
  if (!settings.mimoApiKey) throw new Error('MiMo API key not configured');

  const res = await fetch(`${MIMO_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': settings.mimoApiKey,
    },
    body: JSON.stringify({
      model: 'mimo-v2.5-asr',
      messages: [{ role: 'assistant', content: audioBase64 }],
      audio: { format },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiMo ASR error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content.trim();
}
