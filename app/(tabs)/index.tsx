import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { loadAllSettings, getHistory, HistoryItem } from '../../src/store/settings';

export default function HomeScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    loadAllSettings();
    getHistory().then(setHistory);
  }, []);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>PodText</Text>
        <Text style={styles.heroSubtitle}>
          AI-powered bilingual subtitles{'\n'}and English podcast generation
        </Text>
      </View>

      <Pressable
        style={[styles.card, styles.cardVideo]}
        onPress={() => router.push('/subtitle')}
      >
        <View style={styles.cardContent}>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Video Subtitle</Text>
            <Text style={styles.cardDesc}>
              Import local video, generate bilingual subtitles with AI
            </Text>
          </View>
          <View style={[styles.cardIcon, styles.cardIconVideo]}>
            <Text style={styles.cardIconText}>▶</Text>
          </View>
        </View>
      </Pressable>

      <Pressable
        style={[styles.card, styles.cardPodcast]}
        onPress={() => router.push('/podcast')}
      >
        <View style={styles.cardContent}>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Text to Podcast</Text>
            <Text style={styles.cardDesc}>
              Turn text into English dual-host podcast with word highlighting
            </Text>
          </View>
          <View style={[styles.cardIcon, styles.cardIconPodcast]}>
            <Text style={styles.cardIconText}>♪</Text>
          </View>
        </View>
      </Pressable>

      {history.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent</Text>
          {history.map((item) => (
            <Pressable
              key={item.id}
              style={styles.historyItem}
              onPress={() => {
                if (item.type === 'video') {
                  router.push(`/player/${item.id}`);
                } else {
                  router.push(`/podcast-player/${item.id}`);
                }
              }}
            >
              <View style={styles.historyLeft}>
                <Text style={styles.historyTitle}>{item.title}</Text>
                <Text style={styles.historyMeta}>
                  {item.type === 'video' ? 'Video' : 'Podcast'} ·{' '}
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <View
                style={[
                  styles.historyBadge,
                  item.type === 'video'
                    ? styles.badgeVideo
                    : styles.badgePodcast,
                ]}
              >
                <Text style={styles.historyBadgeText}>
                  {item.type === 'video' ? 'Video' : 'Podcast'}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1EFE8',
  },
  hero: {
    padding: 24,
    paddingTop: 40,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '500',
    color: '#534AB7',
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#888780',
    marginTop: 8,
    lineHeight: 22,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 0.5,
    backgroundColor: '#FFFFFF',
  },
  cardVideo: {
    borderLeftWidth: 4,
    borderLeftColor: '#534AB7',
    borderColor: '#D3D1C7',
  },
  cardPodcast: {
    borderLeftWidth: 4,
    borderLeftColor: '#D85A30',
    borderColor: '#D3D1C7',
  },
  cardContent: {
    flexDirection: 'row',
    padding: 18,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardText: {
    flex: 1,
    marginRight: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: '#2C2C2A',
  },
  cardDesc: {
    fontSize: 13,
    color: '#888780',
    marginTop: 4,
    lineHeight: 18,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconVideo: {
    backgroundColor: '#EEEDFE',
  },
  cardIconPodcast: {
    backgroundColor: '#FAECE7',
  },
  cardIconText: {
    fontSize: 20,
    color: '#534AB7',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#2C2C2A',
    marginBottom: 12,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    padding: 14,
    marginBottom: 8,
  },
  historyLeft: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2C2C2A',
  },
  historyMeta: {
    fontSize: 12,
    color: '#888780',
    marginTop: 2,
  },
  historyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeVideo: {
    backgroundColor: '#EEEDFE',
  },
  badgePodcast: {
    backgroundColor: '#E1F5EE',
  },
  historyBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
