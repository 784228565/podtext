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
import { useVideoPlayer, VideoView } from 'expo-video';

interface SubtitleWord {
  text: string;
  begin_time: number;
  end_time: number;
}

interface SubtitleEntry {
  index: number;
  startMs: number;
  endMs: number;
  original: string;
  translation: string;
  words?: SubtitleWord[];
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, '0')}`;
}

export default function VideoPlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [entries, setEntries] = useState<SubtitleEntry[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [activeWordIdx, setActiveWordIdx] = useState(-1);
  const [videoUri, setVideoUri] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // expo-video player — always created (hooks must be unconditional).
  // Passes a fallback URI when videoUri is not yet loaded; VideoView is not
  // rendered in that state, so the placeholder never plays.
  const player = useVideoPlayer(
    videoUri || { uri: '' },
    (init) => { init.loop = false; },
  );

  useEffect(() => {
    (async () => {
      const history = await getHistory();
      const item = history.find((h) => h.id === id);
      if (item) {
        const parsed = JSON.parse(item.data);
        const subs: SubtitleEntry[] = parsed.subtitles || [];
        setEntries(subs);
        setVideoUri(parsed.videoUri || null);
        if (subs.length > 0) {
          setDurationMs(subs[subs.length - 1].endMs);
        }
      }
    })();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [id]);

  // Drive subtitle highlighting from a given playback position.
  const applyPosition = useCallback((elapsed: number) => {
    setPositionMs(elapsed);
    const idx = entries.findIndex((e) => elapsed >= e.startMs && elapsed < e.endMs);
    setActiveIdx(idx);
    if (idx >= 0 && entries[idx].words && entries[idx].words.length > 0) {
      const words = entries[idx].words!;
      const wi = words.findIndex((w) => elapsed >= w.begin_time && elapsed < w.end_time);
      setActiveWordIdx(wi);
    } else {
      setActiveWordIdx(-1);
    }
  }, [entries]);

  // Poll the VideoPlayer for current position — expo-video does not provide
  // a continuous callback, but currentTime is updated synchronously each frame.
  useEffect(() => {
    if (isPlaying && videoUri) {
      pollRef.current = setInterval(() => {
        const pos = player.currentTime * 1000;
        const dur = player.duration * 1000;
        setPositionMs(pos);
        if (dur > 0) setDurationMs(dur);
        applyPosition(pos);
        // Reset on completion (player stops but we need to sync UI).
        if (player.duration > 0 && player.currentTime >= player.duration - 0.1) {
          setIsPlaying(false);
          setPositionMs(0);
        }
      }, 100);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isPlaying, videoUri, player, applyPosition]);

  useEffect(() => {
    if (activeIdx >= 0 && scrollRef.current) {
      scrollRef.current.scrollTo({ y: activeIdx * 100, animated: true });
    }
  }, [activeIdx]);

  const toggle = () => {
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
  };

  const seek = (ms: number) => {
    player.currentTime = ms / 1000;
    setPositionMs(ms);
    applyPosition(ms);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Bilingual Subtitles' }} />

      <View style={styles.controls}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: durationMs > 0 ? `${Math.min((positionMs / durationMs) * 100, 100)}%` : '0%' }]} />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.t}>{formatTime(positionMs)}</Text>
          <Text style={styles.t}>{formatTime(durationMs)}</Text>
        </View>
        <Pressable onPress={toggle} style={styles.playBtn}>
          <Text style={styles.playIcon}>{isPlaying ? '\u23F8' : '\u25B6'}</Text>
        </Pressable>
      </View>

      <ScrollView ref={scrollRef} style={styles.list} contentContainerStyle={styles.listC}>
        {entries.map((e, i) => {
          const isActive = i === activeIdx;
          const hasTimings = e.words && e.words.length > 0;
          return (
            <Pressable key={e.index} onPress={() => seek(e.startMs)} style={[styles.block, isActive && styles.blockActive]}>
              <Text style={styles.ts}>{formatTime(e.startMs)}</Text>
              {hasTimings ? (
                <Text style={styles.orig}>
                  {e.words!.map((w, wi) => (
                    <Text key={wi} style={isActive && wi === activeWordIdx ? styles.wordHi : null}>{w.text}</Text>
                  ))}
                </Text>
              ) : (
                <Text style={styles.orig}>{e.original}</Text>
              )}
              <Text style={styles.trans}>{e.translation}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {videoUri && (
        <VideoView
          player={player}
          style={styles.hiddenVideo}
          nativeControls={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1EFE8' },
  controls: {
    backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10,
    borderBottomWidth: 0.5, borderBottomColor: '#D3D1C7', alignItems: 'center',
  },
  progressBar: { width: '100%', height: 4, backgroundColor: '#D3D1C7', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#534AB7', borderRadius: 2 },
  timeRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  t: { fontSize: 11, color: '#888780' },
  playBtn: { paddingVertical: 6, paddingHorizontal: 20 },
  playIcon: { fontSize: 26, color: '#534AB7' },
  list: { flex: 1 },
  listC: { padding: 14, paddingBottom: 40 },
  block: {
    backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 0.5, borderColor: '#D3D1C7',
    borderLeftWidth: 3, borderLeftColor: '#D3D1C7', padding: 14, marginBottom: 10,
  },
  blockActive: { borderLeftColor: '#534AB7', backgroundColor: '#EEEDFE' },
  ts: { fontSize: 11, color: '#B4B2A9', marginBottom: 6 },
  orig: { fontSize: 16, fontWeight: '500', color: '#2C2C2A', lineHeight: 26, marginBottom: 6 },
  wordHi: { backgroundColor: '#C5C2F5', borderRadius: 3, paddingHorizontal: 2 },
  trans: { fontSize: 14, color: '#534AB7', lineHeight: 20 },
  hiddenVideo: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
