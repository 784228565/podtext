import * as FileSystem from 'expo-file-system/legacy';

// Persisted to JSON files under documentDirectory so API keys and history
// survive app restarts / recompiles (the previous in-memory store lost
// everything on every reload). expo-file-system is bundled in Expo Go, so
// this works without a dev build — unlike expo-sqlite/expo-av.
const SETTINGS_FILE = `${FileSystem.documentDirectory}settings.json`;
const HISTORY_FILE = `${FileSystem.documentDirectory}history.json`;

export interface HistoryItem {
  id: string;
  type: 'video' | 'podcast';
  title: string;
  data: string;
  createdAt: number;
}

let memoryStore: Record<string, string> = {};
let historyStore: HistoryItem[] = [];
let loaded = false;
let loadPromise: Promise<void> | null = null;

async function readJsonFile<T>(uri: string, fallback: T): Promise<T> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return fallback;
    const raw = await FileSystem.readAsStringAsync(uri);
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(uri: string, value: unknown): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(value));
  } catch {
    // Disk full / permission issues must never crash the app.
  }
}

// Loads both files into memory exactly once; concurrent callers share one
// in-flight promise. Safe to call from anywhere before reading.
export async function loadAllSettings(): Promise<void> {
  if (loaded) return;
  if (!loadPromise) {
    loadPromise = (async () => {
      const [settings, history] = await Promise.all([
        readJsonFile<Record<string, string>>(SETTINGS_FILE, {}),
        readJsonFile<HistoryItem[]>(HISTORY_FILE, []),
      ]);
      memoryStore = settings && typeof settings === 'object' ? settings : {};
      historyStore = Array.isArray(history) ? history : [];
      loaded = true;
    })().finally(() => {
      loadPromise = null;
    });
  }
  return loadPromise;
}

// Synchronous read of the in-memory cache. Call loadAllSettings() first
// (settings/podcast/subtitle screens already do); if not loaded yet this
// returns whatever is cached (possibly empty).
export function getSettings(): Record<string, string> {
  return { ...memoryStore };
}

export async function saveApiKeys(mimoApiKey: string, funasrApiKey: string, funasrAppKey: string): Promise<void> {
  memoryStore.mimoApiKey = mimoApiKey;
  memoryStore.funasrApiKey = funasrApiKey;
  memoryStore.funasrAppKey = funasrAppKey;
  await writeJsonFile(SETTINGS_FILE, memoryStore);
}

export async function addHistory(item: Omit<HistoryItem, 'createdAt'>): Promise<void> {
  await loadAllSettings();
  historyStore.unshift({
    ...item,
    createdAt: Date.now(),
  });
  if (historyStore.length > 50) historyStore.pop();
  await writeJsonFile(HISTORY_FILE, historyStore);
}

export async function getHistory(): Promise<HistoryItem[]> {
  await loadAllSettings();
  return [...historyStore];
}

export async function deleteHistory(id: string): Promise<void> {
  await loadAllSettings();
  historyStore = historyStore.filter((h) => h.id !== id);
  await writeJsonFile(HISTORY_FILE, historyStore);
}
