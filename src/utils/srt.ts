export interface SubtitleEntry {
  index: number;
  startMs: number;
  endMs: number;
  original: string;
  translation: string;
}

export function parseSRT(srtContent: string): SubtitleEntry[] {
  const entries: SubtitleEntry[] = [];
  const blocks = srtContent.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    const index = parseInt(lines[0], 10);
    if (isNaN(index)) continue;

    const timeMatch = lines[1].match(
      /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/
    );
    if (!timeMatch) continue;

    const startMs =
      parseInt(timeMatch[1]) * 3600000 +
      parseInt(timeMatch[2]) * 60000 +
      parseInt(timeMatch[3]) * 1000 +
      parseInt(timeMatch[4]);

    const endMs =
      parseInt(timeMatch[5]) * 3600000 +
      parseInt(timeMatch[6]) * 60000 +
      parseInt(timeMatch[7]) * 1000 +
      parseInt(timeMatch[8]);

    const text = lines.slice(2).join('\n').trim();

    const parts = text.split('\n');
    const original = parts[0] || '';
    const translation = parts[1] || '';

    entries.push({ index, startMs, endMs, original, translation });
  }

  return entries;
}

function msToSRTTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = Math.floor(ms % 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

export function generateSRT(entries: SubtitleEntry[]): string {
  return entries
    .map(
      (e) =>
        `${e.index}\n${msToSRTTime(e.startMs)} --> ${msToSRTTime(e.endMs)}\n${e.original}\n${e.translation}`
    )
    .join('\n\n');
}

export function generateBilingualSubtitles(
  originalSentences: Array<{ text: string; begin_time: number; end_time: number }>,
  translations: string[]
): SubtitleEntry[] {
  return originalSentences.map((s, i) => ({
    index: i + 1,
    startMs: s.begin_time,
    endMs: s.end_time,
    original: s.text,
    translation: translations[i] || '',
  }));
}
