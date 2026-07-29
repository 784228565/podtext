import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { v4 as uuidv4 } from 'uuid';
import { generatePodcastScript } from '../../src/services/mimo';
import { synthesizePodcastAudio } from '../../src/services/edge-tts';
import { addHistory, getSettings, loadAllSettings } from '../../src/store/settings';

type Stage = 'input' | 'generating' | 'done';

export default function PodcastScreen() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('input');
  const [text, setText] = useState('');
  const [statusText, setStatusText] = useState('');

  const handleGenerate = async () => {
    if (!text.trim()) return;

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

      setStage('generating');
      setStatusText('Generating podcast script...');

      const script = await generatePodcastScript(text);

      setStatusText('Synthesizing audio with Chloe & Dean...');
      const audioResult = await synthesizePodcastAudio(
        script.segments.map((s) => ({
          speaker: s.speaker,
          text: s.text,
        }))
      );

      const id = uuidv4();
      const podcastData = {
        id,
        title: script.title,
        script: script.segments,
        wordBoundaries: audioResult.wordBoundaries,
      };

      await addHistory({
        id,
        type: 'podcast',
        title: script.title,
        data: JSON.stringify(podcastData),
      });

      setStage('done');
      setStatusText('');

      router.push(`/podcast-player/${id}`);
    } catch (err: any) {
      Alert.alert('Generation Error', err.message || 'Failed to generate podcast');
      setStage('input');
    }
  };

  if (stage === 'generating') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#D85A30" />
        <Text style={styles.statusText}>{statusText}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Text to Podcast</Text>
        <Text style={styles.desc}>
          Paste any text and generate an English dual-host podcast conversation.
          Host (Chloe) and co-host (Dean) will discuss the content naturally.
        </Text>

        <TextInput
          style={styles.textInput}
          placeholder="Paste your text here... (article, news, notes, etc.)"
          placeholderTextColor="#B4B2A9"
          multiline
          numberOfLines={10}
          textAlignVertical="top"
          value={text}
          onChangeText={setText}
        />

        <Pressable
          style={[styles.generateBtn, !text.trim() && styles.generateBtnDisabled]}
          onPress={handleGenerate}
          disabled={!text.trim()}
        >
          <Text style={styles.generateBtnText}>Generate Podcast</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1EFE8',
  },
  centered: {
    flex: 1,
    backgroundColor: '#F1EFE8',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
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
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    padding: 16,
    fontSize: 15,
    color: '#2C2C2A',
    minHeight: 180,
    lineHeight: 22,
  },
  generateBtn: {
    backgroundColor: '#D85A30',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  generateBtnDisabled: {
    opacity: 0.5,
  },
  generateBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  statusText: {
    fontSize: 14,
    color: '#888780',
    marginTop: 16,
  },
});
