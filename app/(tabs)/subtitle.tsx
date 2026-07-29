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
import { v4 as uuidv4 } from 'uuid';
import { transcribeAudio } from '../../src/services/funasr';
import { translateText } from '../../src/services/mimo';
import { generateBilingualSubtitles, generateSRT, SubtitleEntry } from '../../src/utils/srt';
import { addHistory, getSettings } from '../../src/store/settings';
import { loadAllSettings } from '../../src/store/settings';

type ProcessingState = 'idle' | 'extracting' | 'transcribing' | 'translating' | 'done';

export default function SubtitleScreen() {
  const router = useRouter();
  const [state, setState] = useState<ProcessingState>('idle');
  const [statusText, setStatusText] = useState('');
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [subtitles, setSubtitles] = useState<SubtitleEntry[]>([]);
  const [selectedLang, setSelectedLang] = useState<'ja' | 'en'>('ja');

  const handlePickVideo = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['video/*', 'audio/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      const sizeMB = (file.size || 0) / (1024 * 1024);
      if (sizeMB > 10) {
        Alert.alert('File too large', 'Max 10MB. Pick a shorter video or audio clip.');
        return;
      }
      setVideoUri(file.uri);
      await processVideo(file.uri, selectedLang);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to pick video');
    }
  };

  const processVideo = async (uri: string, lang: string) => {
    try {
      await loadAllSettings();
      const settings = getSettings();

      if (!settings.mimoApiKey) {
        Alert.alert(
          'API Key Required',
          'Please configure your MiMo API key in Settings first.'
        );
        return;
      }

      setState('extracting');
      setStatusText('Extracting audio...');

      setState('transcribing');
      setStatusText(`Transcribing (${lang === 'ja' ? 'Japanese' : 'English'})...`);
      const result = await transcribeAudio(uri, lang);

      setState('translating');
      setStatusText('Translating...');
      const translations = await Promise.all(
        result.sentences.map((s) =>
          translateText(s.text, lang === 'ja' ? 'Japanese' : 'English', 'Chinese')
        )
      );

      const entries = generateBilingualSubtitles(result.sentences, translations);
      setSubtitles(entries);

      const srt = generateSRT(entries);
      const id = uuidv4();

      await addHistory({
        id,
        type: 'video',
        title: uri.split('/').pop() || 'Untitled',
        data: JSON.stringify({ videoUri: uri, subtitles: entries, srt }),
      });

      setState('done');
      setStatusText('Done!');
      router.push(`/player/${id}`);
    } catch (err: any) {
      Alert.alert('Processing Error', err.message || 'Failed to process video');
      setState('idle');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Audio Subtitle Generator</Text>
        <Text style={styles.desc}>
          Import a local video to generate bilingual subtitles (Japanese/English → Chinese)
        </Text>

        <View style={styles.langSelector}>
          <Pressable
            style={[styles.langBtn, selectedLang === 'ja' && styles.langBtnActive]}
            onPress={() => setSelectedLang('ja')}
          >
            <Text
              style={[
                styles.langBtnText,
                selectedLang === 'ja' && styles.langBtnTextActive,
              ]}
            >
              Japanese
            </Text>
          </Pressable>
          <Pressable
            style={[styles.langBtn, selectedLang === 'en' && styles.langBtnActive]}
            onPress={() => setSelectedLang('en')}
          >
            <Text
              style={[
                styles.langBtnText,
                selectedLang === 'en' && styles.langBtnTextActive,
              ]}
            >
              English
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={styles.importBtn}
          onPress={handlePickVideo}
          disabled={state !== 'idle'}
        >
          <Text style={styles.importBtnText}>
            {state === 'idle' ? 'Import Audio' : 'Processing...'}
          </Text>
        </Pressable>

        {state !== 'idle' && state !== 'done' && (
          <View style={styles.progress}>
            <ActivityIndicator color="#534AB7" />
            <Text style={styles.progressText}>{statusText}</Text>
          </View>
        )}

        {state === 'done' && (
          <View style={styles.doneBox}>
            <Text style={styles.doneTitle}>Subtitles generated!</Text>
            <Text style={styles.doneSubtitle}>
              {subtitles.length} segments ready
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1EFE8',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '500',
    color: '#2C2C2A',
    marginBottom: 8,
  },
  desc: {
    fontSize: 14,
    color: '#888780',
    lineHeight: 20,
    marginBottom: 24,
  },
  langSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  langBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  langBtnActive: {
    backgroundColor: '#EEEDFE',
    borderColor: '#534AB7',
  },
  langBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#888780',
  },
  langBtnTextActive: {
    color: '#534AB7',
  },
  importBtn: {
    backgroundColor: '#534AB7',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  importBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  progress: {
    marginTop: 20,
    alignItems: 'center',
    gap: 12,
  },
  progressText: {
    fontSize: 14,
    color: '#888780',
  },
  doneBox: {
    marginTop: 20,
    padding: 20,
    backgroundColor: '#E1F5EE',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#9FE1CB',
  },
  doneTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#085041',
  },
  doneSubtitle: {
    fontSize: 13,
    color: '#0F6E56',
    marginTop: 4,
  },
});
