import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
} from 'react-native';
import { saveApiKeys, getSettings, loadAllSettings } from '../../src/store/settings';

export default function SettingsScreen() {
  const [mimoKey, setMimoKey] = useState('');
  const [funasrKey, setFunasrKey] = useState('');
  const [funasrAppKey, setFunasrAppKey] = useState('');
  const [hasKeys, setHasKeys] = useState(false);

  useEffect(() => {
    (async () => {
      await loadAllSettings();
      const settings = getSettings();
      if (settings.mimoApiKey) {
        setMimoKey(settings.mimoApiKey);
        setHasKeys(true);
      }
      if (settings.funasrApiKey) {
        setFunasrKey(settings.funasrApiKey);
      }
      if (settings.funasrAppKey) {
        setFunasrAppKey(settings.funasrAppKey);
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!mimoKey.trim()) {
      Alert.alert('Required', 'MiMo API Key is required for core features.');
      return;
    }
    await saveApiKeys(mimoKey.trim(), funasrKey.trim(), funasrAppKey.trim());
    setHasKeys(true);
    Alert.alert('Saved', 'API keys saved locally. Never uploaded to any server.');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>API Keys</Text>
          <Text style={styles.cardHint}>
            Your keys are stored locally on your device. They are never uploaded to
            any server.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>
              MiMo API Key <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="sk-..."
              placeholderTextColor="#B4B2A9"
              value={mimoKey}
              onChangeText={setMimoKey}
              secureTextEntry={hasKeys}
              autoCapitalize="none"
            />
            <Text style={styles.fieldHint}>
              From platform.xiaomimimo.com — required for translation & script generation
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Fun-ASR API Key</Text>
            <TextInput
              style={styles.input}
              placeholder="Alibaba Cloud AccessKey"
              placeholderTextColor="#B4B2A9"
              value={funasrKey}
              onChangeText={setFunasrKey}
              secureTextEntry={hasKeys && !!funasrKey}
              autoCapitalize="none"
            />
            <Text style={styles.fieldHint}>
              For Japanese speech recognition (optional, MiMo ASR used for EN/CN)
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Fun-ASR App Key</Text>
            <TextInput
              style={styles.input}
              placeholder="Alibaba Cloud App Key"
              placeholderTextColor="#B4B2A9"
              value={funasrAppKey}
              onChangeText={setFunasrAppKey}
              secureTextEntry={hasKeys && !!funasrAppKey}
              autoCapitalize="none"
            />
          </View>

          <Pressable style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>
              {hasKeys ? 'Update Keys' : 'Save Keys'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>About</Text>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Version</Text>
            <Text style={styles.aboutValue}>1.0.0</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Powered by</Text>
            <Text style={styles.aboutValue}>MiMo, Fun-ASR, Edge TTS</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Built with</Text>
            <Text style={styles.aboutValue}>React Native + Expo</Text>
          </View>
        </View>
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
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    padding: 18,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: '#2C2C2A',
    marginBottom: 6,
  },
  cardHint: {
    fontSize: 13,
    color: '#888780',
    lineHeight: 18,
    marginBottom: 20,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2C2C2A',
    marginBottom: 6,
  },
  required: {
    color: '#E24B4A',
  },
  input: {
    backgroundColor: '#F1EFE8',
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    padding: 12,
    fontSize: 14,
    color: '#2C2C2A',
  },
  fieldHint: {
    fontSize: 11,
    color: '#B4B2A9',
    marginTop: 4,
  },
  saveBtn: {
    backgroundColor: '#534AB7',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F1EFE8',
  },
  aboutLabel: {
    fontSize: 14,
    color: '#888780',
  },
  aboutValue: {
    fontSize: 14,
    color: '#2C2C2A',
  },
});
