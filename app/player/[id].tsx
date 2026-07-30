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

// Detect whether the native audio module (ExponentAV) is present in this binary.
// On the GitHub-built Expo Go 57 it is NOT, so we silently fall back to a timer.
// After installing an EAS dev build (which bundles expo-av), this becomes available
// and the player produces real sound.
let AVVideo: any = null;
try {
  const av = require('expo-av');
  const RN = require('react-native');
  if (av && av.Video && RN && RN.NativeModules && RN.NativeModules.ExponentAV) {
    AVVideo = av.Video;
  }
} catch (e) {
  AVVideo = null;
}

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

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);
  const pausedRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const videoRef = useRef<any>(null);

  const useNative = !!AVVideo && !!videoUri;

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
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [id]);

  // Drive highlighting from a given playback position (shared by both paths).
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

  // ---- Native (expo-av) path ----
  const onPlaybackStatus = useCallback((status: any) => {
    if (!status.isLoaded) return;
    if (typeof status.durationMillis === 'number' && status.durationMillis > 0) {
      setDurationMs(status.durationMillis);
    }
    setIsPlaying(!!status.isPlaying);
    applyPosition(status.positionMillis || 0);
    if (status.didJustFinish) {
      setIsPlaying(false);
      setPositionMs(0);
      pausedRef.current = 0;
    }
  }, [applyPosition]);

  // ---- Timer fallback path (no native audio module) ----
  const tick = useCallback(() => {
    const elapsed = Date.now() - startRef.current + pausedRef.current;
    applyPosition(elapsed);
    if (elapsed >= durationMs && durationMs > 0) {
      setIsPlaying(false);
      pausedRef.current = 0;
      setPositionMs(0);
    }
  }, [applyPosition, durationMs]);

  useEffect(() => {
    if (isPlaying && !useNative) {
      startRef.current = Date.now();
      timerRef.current = setInterval(tick, 80);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, useNative, tick]);

  useEffect(() => {
    if (activeIdx >= 0 && scrollRef.current) {
      scrollRef.current.scrollTo({ y: activeIdx * 100, animated: true });
    }
  }, [activeIdx]);

  const toggle = () => {
    if (useNative && videoRef.current) {
      if (isPlaying) videoRef.current.pauseAsync();
      else videoRef.current.playAsync();
    } else {
      if (isPlaying) { pausedRef.current = positionMs; setIsPlaying(false); }
      else { startRef.current = Date.now(); setIsPlaying(true); }
    }
  };

  const seek = (ms: number) => {
    if (useNative && videoRef.current) {
      videoRef.current.setPositionAsync(ms);
      setPositionMs(ms);
    } else {
      pausedRef.current = ms;
      setPositionMs(ms);
      if (isPlaying) startRef.current = Date.now();
    }
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
          <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
        </Pressable>
        {!useNative && (
          <Text style={styles.note}>No audio module in this Expo Go — subtitles only. Build a dev client for sound.</Text>
        )}
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

      {useNative && videoUri && (
        <AVVideo
          ref={videoRef}
          style={{ width: 0, height: 0, opacity: 0 }}
          source={{ uri: videoUri }}
          resizeMode="cover"
          onPlaybackStatusUpdate={onPlaybackStatus}
          useNativeControls={false}
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
  note: { fontSize: 10, color: '#B4B2A9', marginTop: 6, textAlign: 'center' },
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
});
