import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { getHistory } from '../../src/store/settings';
import { PodcastSegment } from '../../src/services/mimo';
import { WordBoundary } from '../../src/services/edge-tts';

interface PodcastData {
  id: string;
  title: string;
  script: PodcastSegment[];
  wordBoundaries: WordBoundary[];
}

export default function PodcastPlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [podcast, setPodcast] = useState<PodcastData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [activeWordIdx, setActiveWordIdx] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);

  useEffect(() => {
    (async () => {
      const history = await getHistory();
      const item = history.find((h) => h.id === id);
      if (item) {
        const data = JSON.parse(item.data) as PodcastData;
        setPodcast(data);
        if (data.wordBoundaries.length > 0) {
          const last = data.wordBoundaries[data.wordBoundaries.length - 1];
          setDurationMs(last.offset + last.duration);
        }
      }
    })();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [id]);

  const updateWordHighlight = useCallback(
    (ms: number, boundaries: WordBoundary[]) => {
      const idx = boundaries.findIndex(
        (wb) => ms >= wb.offset && ms <= wb.offset + wb.duration
      );
      setActiveWordIdx(idx);
    },
    []
  );

  useEffect(() => {
    if (isPlaying && podcast) {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current + pausedAtRef.current;
        setPositionMs(elapsed);
        if (podcast.wordBoundaries) {
          updateWordHighlight(elapsed, podcast.wordBoundaries);
        }
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, podcast]);

  const togglePlayback = () => {
    if (isPlaying) {
      pausedAtRef.current = positionMs;
      setIsPlaying(false);
    } else {
      startTimeRef.current = Date.now();
      setIsPlaying(true);
    }
  };

  const seekTo = (ms: number) => {
    pausedAtRef.current = ms;
    setPositionMs(ms);
    if (isPlaying) {
      startTimeRef.current = Date.now();
    }
  };

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${String(sec).padStart(2, '0')}`;
  };

  if (!podcast) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const { script, wordBoundaries } = podcast;
  const fullText = script.map((s) => s.text).join(' ');

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: podcast.title }} />

      <ScrollView style={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>{podcast.title}</Text>
          <Text style={styles.hosts}>
            Host: Chloe . Co-host: Dean .{' '}
            {durationMs > 0 ? formatTime(durationMs) : ''}
          </Text>
        </View>

        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: durationMs > 0 ? `${Math.min((positionMs / durationMs) * 100, 100)}%` : '0%' },
            ]}
          />
        </View>

        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(positionMs)}</Text>
          <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
        </View>

        <View style={styles.transcriptContainer}>
          <Text style={styles.transcriptLabel}>Transcript</Text>
          <Text style={styles.transcript}>
            {fullText.split(' ').map((word, idx) => (
              <Text
                key={idx}
                style={[
                  styles.word,
                  idx === activeWordIdx && styles.wordActive,
                ]}
                onPress={() => {
                  if (wordBoundaries[idx]) {
                    seekTo(wordBoundaries[idx].offset);
                  }
                }}
              >
                {word}{' '}
              </Text>
            ))}
          </Text>
        </View>

        {script.map((seg, segIdx) => (
          <View key={segIdx} style={styles.segmentContainer}>
            <View
              style={[
                styles.segmentBadge,
                seg.speaker === 'host' ? styles.badgeHost : styles.badgeCohost,
              ]}
            >
              <Text style={styles.badgeText}>
                {seg.speaker === 'host' ? 'Chloe' : 'Dean'}
              </Text>
            </View>
            <Text style={styles.segmentText}>{seg.text}</Text>
            <Text style={styles.segmentTranslation}>{seg.translation}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.playerBar}>
        <Pressable onPress={togglePlayback} style={styles.playerBtn}>
          <Text style={styles.playerBtnText}>{isPlaying ? '\u23F8' : '\u25B6'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1EFE8' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14, color: '#888780' },
  scroll: { flex: 1 },
  header: { padding: 20, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '500', color: '#712B13' },
  hosts: { fontSize: 13, color: '#993C1D', marginTop: 4 },
  progressBar: { height: 4, backgroundColor: '#D3D1C7', marginHorizontal: 20, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#D85A30', borderRadius: 2 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 16 },
  timeText: { fontSize: 12, color: '#888780' },
  transcriptContainer: { marginHorizontal: 16, marginBottom: 20, padding: 14, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 0.5, borderColor: '#D3D1C7' },
  transcriptLabel: { fontSize: 12, color: '#888780', marginBottom: 8 },
  transcript: { fontSize: 16, lineHeight: 28, color: '#2C2C2A' },
  word: { paddingVertical: 2, paddingHorizontal: 3, borderRadius: 4 },
  wordActive: { backgroundColor: '#EEEDFE', color: '#534AB7', fontWeight: '500' },
  segmentContainer: { marginHorizontal: 16, marginBottom: 16, padding: 16, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 0.5, borderColor: '#D3D1C7' },
  segmentBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 8 },
  badgeHost: { backgroundColor: '#EEEDFE' },
  badgeCohost: { backgroundColor: '#E1F5EE' },
  badgeText: { fontSize: 12, fontWeight: '500', color: '#534AB7' },
  segmentText: { fontSize: 15, color: '#2C2C2A', lineHeight: 22 },
  segmentTranslation: { fontSize: 13, color: '#888780', marginTop: 6, lineHeight: 19 },
  playerBar: { backgroundColor: '#FFFFFF', borderTopWidth: 0.5, borderTopColor: '#D3D1C7', padding: 16, alignItems: 'center' },
  playerBtn: { padding: 12 },
  playerBtnText: { fontSize: 28, color: '#D85A30' },
});
