import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { uuidv4 } from '../../src/utils/uuid';
import { transcribeAudio } from '../../src/services/funasr';
import { translateText } from '../../src/services/mimo';
import { generateBilingualSubtitles, generateSRT, SubtitleEntry } from '../../src/utils/srt';
import { addHistory, getSettings, loadAllSettings } from '../../src/store/settings';

type ProcessingState = 'idle' | 'transcribing' | 'translating' | 'done';

export default function SubtitleScreen() {
  const router = useRouter();
  const [state, setState] = useState<ProcessingState>('idle');
  const [statusText, setStatusText] = useState('');
  const [subtitles, setSubtitles] = useState<SubtitleEntry[]>([]);
  const [selectedLang, setSelectedLang] = useState<'ja' | 'en'>('ja');

  const handlePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['video/*', 'audio/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      const sizeMB = (file.size || 0) / (1024 * 1024);
      if (sizeMB > 15) {
        Alert.alert('File too large', 'Max 15MB. Use a shorter clip.');
        return;
      }
      await processVideo(file.uri, selectedLang);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed');
    }
  };

  const processVideo = async (uri: string, lang: string) => {
    try {
      await loadAllSettings();
      const settings = getSettings();
      if (!settings.mimoApiKey) {
        Alert.alert('API Key Required', 'Set MiMo API key in Settings first.');
        return;
      }
      setState('transcribing');
      setStatusText(`Transcribing (${lang === 'ja' ? 'Japanese' : 'English'})...`);
      const result = await transcribeAudio(uri, lang);

      // Parse words from Fun-ASR response, split by "。" punctuation
      const rawWords = (result.sentences[0]?.words || []).map((w: any) => ({
        text: (w.text || '') + (w.punctuation || ''),
        begin_time: w.begin_time || 0,
        end_time: w.end_time || 0,
        punct: w.punctuation || '',
      }));
      const fullText = result.sentences[0]?.text || result.text;

      // Split by "。" from full text, rebuild sentences tracking word positions
      const parts = fullText.split(/(?<=。)/g);
      const rawSentences = parts.filter((s: string) => s.trim());
      const sentences: any[] = [];
      let wordPos = 0;

      for (const st of rawSentences) {
        const clean = st.replace(/\s+/g, '');
        const sentWords: any[] = [];
        let charUsed = 0;

        while (wordPos < rawWords.length && charUsed < clean.length) {
          const w = rawWords[wordPos];
          // count non-space chars in this word (text + punct)
          const wLen = w.text.replace(/\s+/g, '').length;
          if (wLen === 0) { wordPos++; continue; }
          const remaining = clean.length - charUsed;
          if (wLen <= remaining) {
            sentWords.push(w);
            charUsed += wLen;
            wordPos++;
          } else {
            break;
          }
        }

        const begin = sentWords[0]?.begin_time ?? 0;
        const end = sentWords.length > 0 ? sentWords[sentWords.length - 1].end_time : begin + 2000;
        sentences.push({ text: st, begin_time: begin, end_time: end, words: sentWords });
      }

      setState('translating');
      setStatusText('Translating...');
      const translations = await Promise.all(
        sentences.map((s: any) =>
          translateText(s.text, lang === 'ja' ? 'Japanese' : 'English', 'Chinese')
        )
      );

      const entries = generateBilingualSubtitles(sentences, translations);
      setSubtitles(entries);
      const id = uuidv4();

      await addHistory({
        id, type: 'video',
        title: uri.split('/').pop() || 'Untitled',
        data: JSON.stringify({ videoUri: uri, subtitles: entries }),
      });

      setState('done');
      setStatusText('');
      router.push(`/player/${id}`);
    } catch (err: any) {
      Alert.alert('Processing Error', err.message || 'Failed');
      setState('idle');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Video Subtitle Generator</Text>
        <Text style={styles.desc}>Import a video/audio to generate bilingual subtitles (JP/EN → CN)</Text>
        <View style={styles.langRow}>
          <Pressable style={[styles.langBtn, selectedLang === 'ja' && styles.langOn]} onPress={() => setSelectedLang('ja')}>
            <Text style={[styles.langText, selectedLang === 'ja' && styles.langOnText]}>Japanese</Text>
          </Pressable>
          <Pressable style={[styles.langBtn, selectedLang === 'en' && styles.langOn]} onPress={() => setSelectedLang('en')}>
            <Text style={[styles.langText, selectedLang === 'en' && styles.langOnText]}>English</Text>
          </Pressable>
        </View>
        <Pressable style={styles.importBtn} onPress={handlePick} disabled={state !== 'idle'}>
          <Text style={styles.importText}>{state === 'idle' ? 'Import File' : 'Processing...'}</Text>
        </Pressable>
        {state !== 'idle' && state !== 'done' && (
          <View style={styles.prog}><ActivityIndicator color="#534AB7" /><Text style={styles.progText}>{statusText}</Text></View>
        )}
        {state === 'done' && (
          <View style={styles.done}><Text style={styles.doneTitle}>Done!</Text><Text style={styles.doneSub}>{subtitles.length} sentences</Text></View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1EFE8' },
  content: { padding: 20 },
  title: { fontSize: 22, fontWeight: '500', color: '#2C2C2A', marginBottom: 8 },
  desc: { fontSize: 14, color: '#888780', lineHeight: 20, marginBottom: 24 },
  langRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  langBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 0.5, borderColor: '#D3D1C7', backgroundColor: '#FFFFFF', alignItems: 'center' },
  langOn: { backgroundColor: '#EEEDFE', borderColor: '#534AB7' },
  langText: { fontSize: 14, fontWeight: '500', color: '#888780' },
  langOnText: { color: '#534AB7' },
  importBtn: { backgroundColor: '#534AB7', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  importText: { color: '#FFFFFF', fontSize: 16, fontWeight: '500' },
  prog: { marginTop: 20, alignItems: 'center', gap: 12 },
  progText: { fontSize: 14, color: '#888780' },
  done: { marginTop: 20, padding: 20, backgroundColor: '#E1F5EE', borderRadius: 12, borderWidth: 0.5, borderColor: '#9FE1CB' },
  doneTitle: { fontSize: 15, fontWeight: '500', color: '#085041' },
  doneSub: { fontSize: 13, color: '#0F6E56', marginTop: 4 },
});
