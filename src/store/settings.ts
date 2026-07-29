let memoryStore: Record<string, string> = {};
let historyStore: Array<{ id: string; type: string; title: string; data: string; createdAt: number }> = [];

export function getSettings(): Record<string, string> {
  return { ...memoryStore };
}

export async function saveApiKeys(mimoApiKey: string, funasrApiKey: string, funasrAppKey: string): Promise<void> {
  memoryStore.mimoApiKey = mimoApiKey;
  memoryStore.funasrApiKey = funasrApiKey;
  memoryStore.funasrAppKey = funasrAppKey;
}

export async function loadAllSettings(): Promise<void> {
  // in-memory store, always loaded
}

export interface HistoryItem {
  id: string;
  type: 'video' | 'podcast';
  title: string;
  data: string;
  createdAt: number;
}

export async function addHistory(item: Omit<HistoryItem, 'createdAt'>): Promise<void> {
  historyStore.unshift({
    ...item,
    createdAt: Date.now(),
  });
  if (historyStore.length > 50) historyStore.pop();
}

export async function getHistory(): Promise<HistoryItem[]> {
  return [...historyStore];
}

export async function deleteHistory(id: string): Promise<void> {
  historyStore = historyStore.filter((h) => h.id !== id);
}
