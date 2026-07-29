import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { getHistory } from '../../src/store/settings';
import { SubtitleEntry } from '../../src/utils/srt';

export default function VideoPlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [subtitleEntries, setSubtitleEntries] = useState<SubtitleEntry[]>([]);

  useEffect(() => {
    (async () => {
      const history = await getHistory();
      const item = history.find((h) => h.id === id);
      if (item) {
        const parsed = JSON.parse(item.data);
        setSubtitleEntries(parsed.subtitles || []);
      }
    })();
  }, [id]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Video Player' }} />

      <View style={styles.videoArea}>
        <Text style={styles.videoPlaceholderText}>Video playback requires dev build</Text>
      </View>

      <ScrollView style={styles.subtitleList}>
        {subtitleEntries.map((entry, idx) => (
          <View
            key={entry.index}
            style={[
              styles.subtitleBlock,
              idx === 0 && styles.subtitleBlockActive,
            ]}
          >
            <Text style={styles.subtitleOriginal}>{entry.original}</Text>
            <Text style={styles.subtitleTranslation}>{entry.translation}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1EFE8' },
  videoArea: {
    width: '100%', height: 100,
    backgroundColor: '#2C2C2A',
    alignItems: 'center', justifyContent: 'center',
  },
  videoPlaceholderText: { color: '#888780', fontSize: 14 },
  subtitleList: { flex: 1, padding: 12 },
  subtitleBlock: {
    padding: 12, marginBottom: 8, borderRadius: 8,
    borderLeftWidth: 3, borderLeftColor: '#D3D1C7',
    backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#D3D1C7',
  },
  subtitleBlockActive: { borderLeftColor: '#534AB7', backgroundColor: '#EEEDFE' },
  subtitleOriginal: { fontSize: 15, fontWeight: '500', color: '#2C2C2A', lineHeight: 22 },
  subtitleTranslation: { fontSize: 13, color: '#888780', marginTop: 4, lineHeight: 18 },
});
