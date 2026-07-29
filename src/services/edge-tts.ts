export interface WordBoundary {
  text: string;
  offset: number;
  duration: number;
}

export interface EdgeTTSSynthesisResult {
  wordBoundaries: WordBoundary[];
}

const WORDS_PER_MINUTE = 150;

export function calculateWordBoundaries(text: string): WordBoundary[] {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return [];

  const msPerWord = (60 * 1000) / WORDS_PER_MINUTE;

  return words.map((word, i) => ({
    text: word,
    offset: i * msPerWord,
    duration: msPerWord * 0.75,
  }));
}

export async function synthesizePodcastAudio(
  segments: Array<{ speaker: 'host' | 'cohost'; text: string }>
): Promise<EdgeTTSSynthesisResult> {
  const allWords: WordBoundary[] = [];
  let timeOffsetMs = 0;

  for (const segment of segments) {
    const boundaries = calculateWordBoundaries(segment.text);
    for (const wb of boundaries) {
      allWords.push({
        text: wb.text,
        offset: timeOffsetMs + wb.offset,
        duration: wb.duration,
      });
    }
    const wordCount = segment.text.split(/\s+/).filter(w => w.length > 0).length;
    timeOffsetMs += wordCount * ((60 * 1000) / WORDS_PER_MINUTE) + 500;
  }

  return { wordBoundaries: allWords };
}
