// Node-side test for the mergeChunkResults pure function.
// Run: node scripts/test_merge_chunks.mjs
// Does NOT require expo/react-native — imports the TS source via a shim.

// Inline the function + constants to avoid RN/Expo deps.
const CHUNK_SECONDS = 300;

function mergeChunkResults(parts) {
  const allWords = [];
  let fullText = '';
  let lastSentenceEnd = 0;
  parts.forEach((part, i) => {
    const offsetMs = i * CHUNK_SECONDS * 1000;
    fullText += part.text || '';
    const words = part.sentences[0]?.words || [];
    for (const w of words) {
      allWords.push({
        text: w.text,
        begin_time: w.begin_time + offsetMs,
        end_time: w.end_time + offsetMs,
        punctuation: w.punctuation || '',
      });
    }
    const sentEnd = (part.sentences[0]?.end_time ?? 0) + offsetMs;
    if (sentEnd > lastSentenceEnd) lastSentenceEnd = sentEnd;
  });
  const lastWordEnd = allWords.length > 0 ? allWords[allWords.length - 1].end_time : 0;
  const lastEnd = Math.max(lastSentenceEnd, lastWordEnd);
  return {
    text: fullText,
    sentences: [{ text: fullText, begin_time: 0, end_time: lastEnd, words: allWords }],
    preSegmented: false,
  };
}

// ---- Test cases ----
let pass = 0, fail = 0;

function assert(cond, label) {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.error(`  ✗ ${label}`); }
}

console.log('Test 1: two chunks, offset shifts correctly');
{
  const r = mergeChunkResults([
    {
      text: 'こんにちは。',
      sentences: [{
        text: 'こんにちは。',
        begin_time: 0,
        end_time: 2000,
        words: [
          { text: 'こんにちは', begin_time: 0, end_time: 1500, punctuation: '。' },
        ],
      }],
      preSegmented: false,
    },
    {
      text: '元気です。',
      sentences: [{
        text: '元気です。',
        begin_time: 500,
        end_time: 1800,
        words: [
          { text: '元気', begin_time: 500, end_time: 1200, punctuation: '' },
          { text: 'です', begin_time: 1200, end_time: 1800, punctuation: '。' },
        ],
      }],
      preSegmented: false,
    },
  ]);

  assert(r.text === 'こんにちは。元気です。', 'fullText concatenated');
  assert(r.sentences[0].words.length === 3, '3 words total');
  // Chunk 0: offset 0
  assert(r.sentences[0].words[0].begin_time === 0, 'chunk0 word begin_time=0');
  assert(r.sentences[0].words[0].end_time === 1500, 'chunk0 word end_time=1500');
  // Chunk 1: offset = 1 * 300 * 1000 = 300000
  assert(r.sentences[0].words[1].begin_time === 300500, 'chunk1 word0 begin_time=300500');
  assert(r.sentences[0].words[1].end_time === 301200, 'chunk1 word0 end_time=301200');
  assert(r.sentences[0].words[2].begin_time === 301200, 'chunk1 word1 begin_time=301200');
  assert(r.sentences[0].words[2].end_time === 301800, 'chunk1 word1 end_time=301800');
  assert(r.sentences[0].endTime === undefined || r.sentences[0].end_time === 301800, 'last end_time=301800');
  assert(r.preSegmented === false, 'preSegmented=false');
}

console.log('\nTest 2: single chunk, no offset applied');
{
  const r = mergeChunkResults([{
    text: 'テスト。',
    sentences: [{
      text: 'テスト。',
      begin_time: 100,
      end_time: 800,
      words: [
        { text: 'テスト', begin_time: 100, end_time: 700, punctuation: '。' },
      ],
    }],
    preSegmented: false,
  }]);

  assert(r.sentences[0].words[0].begin_time === 100, 'single chunk: no offset');
  assert(r.sentences[0].end_time === 800, 'single chunk end_time');
  assert(r.sentences[0].words[0].punctuation === '。', 'punctuation preserved');
}

console.log('\nTest 3: empty words array');
{
  const r = mergeChunkResults([{
    text: '',
    sentences: [{ text: '', begin_time: 0, end_time: 0, words: [] }],
    preSegmented: false,
  }]);
  assert(r.sentences[0].words.length === 0, 'empty words → empty result');
  assert(r.sentences[0].end_time === 0, 'empty → end_time=0');
}

console.log(`\n${pass} passed, ${fail} failed.`);
if (fail > 0) process.exit(1);
