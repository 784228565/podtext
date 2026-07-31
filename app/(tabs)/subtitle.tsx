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
import { transcribe } from '../../src/services/funasr';
import { translateText } from '../../src/services/mimo';
import { generateBilingualSubtitles, SubtitleEntry } from '../../src/utils/srt';
import { addHistory, getSettings, loadAllSettings } from '../../src/store/settings';
import { debug, truncate } from '../../src/utils/debug';

type JobStatus = 'queued' | 'transcribing' | 'translating' | 'done' | 'error';
interface Job {
  id: string;
  title: string;
  status: JobStatus;
  statusText: string;
  playerId?: string;
  sentenceCount?: number;
}

export default function SubtitleScreen() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedLang, setSelectedLang] = useState<'ja' | 'en'>('ja');

  const updateJob = (jobId: string, patch: Partial<Job>) => {
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, ...patch } : j)));
  };

  const handlePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['video/*', 'audio/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      const sizeMB = (file.size || 0) / (1024 * 1024);
      debug('SUBTITLE', `picked: "${file.name}" size=${sizeMB.toFixed(1)}MB mime=${file.mimeType} uri=${truncate(file.uri, 80)}`);
      if (sizeMB > 300) {
        Alert.alert('File too large', 'Max 300MB. Larger clips need to be trimmed.');
        return;
      }
      const jobId = uuidv4();
      // 立即建立任务卡片，处理在后台进行，不阻塞 UI、不自动跳转
      setJobs((prev) => [
        { id: jobId, title: file.name || '未命名', status: 'queued', statusText: '排队中...' },
        ...prev,
      ]);
      processVideo(jobId, file, selectedLang);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed');
    }
  };

  // 后台处理：不 await，通过 updateJob 实时回写进度到标签页
  const processVideo = async (jobId: string, file: any, lang: string) => {
    try {
      await loadAllSettings();
      const settings = getSettings();
      if (!settings.mimoApiKey) {
        updateJob(jobId, { status: 'error', statusText: '请先在设置里填写 MiMo API key' });
        return;
      }
      updateJob(jobId, {
        status: 'transcribing',
        statusText: `转录中（${lang === 'ja' ? '日语' : '英语'}）...`,
      });
      const result = await transcribe(
        file.uri,
        file.name,
        file.mimeType || 'video/mp4',
        file.size || 0,
        lang,
        (msg) => updateJob(jobId, { statusText: msg })
      );

      let sentences: any[];
      if (result.preSegmented) {
        sentences = result.sentences
          .map((s: any) => ({
            text: s.text,
            begin_time: s.begin_time || 0,
            end_time: s.end_time || 0,
            words: (s.words || []).map((w: any) => ({ text: w.text, begin_time: w.begin_time, end_time: w.end_time })),
          }))
          .filter((s: any) => s.text && s.text.trim());
      } else {
        const rawWords = (result.sentences[0]?.words || []).map((w: any) => ({
          text: (w.text || '') + (w.punctuation || ''),
          begin_time: w.begin_time || 0,
          end_time: w.end_time || 0,
          punct: w.punctuation || '',
        }));
        const fullText = result.sentences[0]?.text || result.text;

        const parts = fullText.split(/(?<=。)/g);
        const rawSentences = parts.filter((s: string) => s.trim());
        sentences = [];
        let wordPos = 0;

        for (const st of rawSentences) {
          const clean = st.replace(/\s+/g, '');
          const sentWords: any[] = [];
          let charUsed = 0;

          while (wordPos < rawWords.length && charUsed < clean.length) {
            const w = rawWords[wordPos];
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
      }

      updateJob(jobId, { status: 'translating', statusText: '翻译中...' });
      const translations = await Promise.all(
        sentences.map((s: any) =>
          translateText(s.text, lang === 'ja' ? 'Japanese' : 'English', 'Chinese')
        )
      );

      const entries: SubtitleEntry[] = generateBilingualSubtitles(sentences, translations);
      debug('SUBTITLE', `done: ${entries.length} subtitle entries, ${entries.filter(e => e.words && e.words.length > 0).length} with word timings`);
      const id = uuidv4();
      await addHistory({
        id,
        type: 'video',
        title: (file.uri || '').split('/').pop() || 'Untitled',
        data: JSON.stringify({ videoUri: file.uri, subtitles: entries }),
      });

      updateJob(jobId, {
        status: 'done',
        statusText: `完成 · ${entries.length} 句`,
        playerId: id,
        sentenceCount: entries.length,
      });
    } catch (err: any) {
      updateJob(jobId, { status: 'error', statusText: err.message || '处理失败' });
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Video Subtitle Generator</Text>
        <Text style={styles.desc}>
          导入视频/音频生成双语字幕（日/英 → 中）。处理在后台进行，进度显示在下方的「处理进度」列表中。
        </Text>
        <View style={styles.langRow}>
          <Pressable style={[styles.langBtn, selectedLang === 'ja' && styles.langOn]} onPress={() => setSelectedLang('ja')}>
            <Text style={[styles.langText, selectedLang === 'ja' && styles.langOnText]}>Japanese</Text>
          </Pressable>
          <Pressable style={[styles.langBtn, selectedLang === 'en' && styles.langOn]} onPress={() => setSelectedLang('en')}>
            <Text style={[styles.langText, selectedLang === 'en' && styles.langOnText]}>English</Text>
          </Pressable>
        </View>
        <Pressable style={styles.importBtn} onPress={handlePick}>
          <Text style={styles.importText}>Import File</Text>
        </Pressable>

        {jobs.length > 0 && (
          <View style={styles.jobsWrap}>
            <Text style={styles.jobsHeader}>处理进度</Text>
            {jobs.map((job) => (
              <View
                key={job.id}
                style={[styles.jobCard, job.status === 'error' && styles.jobCardErr]}
              >
                <Text style={styles.jobTitle} numberOfLines={1}>
                  {job.title}
                </Text>
                <View style={styles.jobRow}>
                  {job.status !== 'done' && job.status !== 'error' && (
                    <ActivityIndicator size="small" color="#534AB7" />
                  )}
                  {job.status === 'done' && <Text style={styles.jobDot}>✓</Text>}
                  {job.status === 'error' && <Text style={styles.jobDotErr}>✕</Text>}
                  <Text style={[styles.jobStatus, job.status === 'error' && styles.jobStatusErr]}>
                    {job.statusText}
                  </Text>
                </View>
                {job.status === 'done' && (
                  <Pressable
                    style={styles.viewBtn}
                    onPress={() => job.playerId && router.push(`/player/${job.playerId}`)}
                  >
                    <Text style={styles.viewBtnText}>查看字幕 ▶</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
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
  jobsWrap: { marginTop: 28 },
  jobsHeader: { fontSize: 15, fontWeight: '500', color: '#2C2C2A', marginBottom: 12 },
  jobCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#E3E1D8' },
  jobCardErr: { borderColor: '#F0C2C2', backgroundColor: '#FDF3F3' },
  jobTitle: { fontSize: 14, fontWeight: '500', color: '#2C2C2A', marginBottom: 8 },
  jobRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  jobStatus: { fontSize: 13, color: '#888780' },
  jobStatusErr: { color: '#C0392B' },
  jobDot: { color: '#085041', fontWeight: '700', fontSize: 14 },
  jobDotErr: { color: '#C0392B', fontWeight: '700', fontSize: 14 },
  viewBtn: { marginTop: 12, backgroundColor: '#534AB7', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  viewBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '500' },
});
