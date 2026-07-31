# PodText

> AI 驱动的**双语字幕**与**英文播客**生成，全部在手机上完成。
> AI-powered bilingual subtitles and English podcast generation, on your phone.

PodText is a cross-platform mobile app (Expo / React Native) that turns local audio & video into:

- **Bilingual subtitles** with word-level highlighting and SRT export, and
- **English dual-host podcasts** (with Chinese translations) for karaoke-style, highlight-as-you-listen playback.

## ✨ Features

### 🎬 Video Subtitle
- Import local video / audio from the document picker.
- AI transcription via **FunASR** (Alibaba DashScope) or **MiMo ASR**.
- Bilingual subtitles (e.g. Chinese ↔ English) with **word-level highlighting** synced to playback.
- Export subtitles as **SRT**.
- Large-file support: chunked sync transcription via `ffmpeg-kit` (preserves word timings), or async OSS upload for very large files (sentence-level).

### 🎙 Text to Podcast
- Paste any text → generate an engaging English **dual-host dialogue** (Chloe + Dean) with Chinese translations via the **MiMo** LLM.
- Synthesized speech with **word-level boundaries** for highlight-as-you-listen playback.
- Built-in player with synced word highlighting.

### 📚 History & Settings
- Transcription / podcast history persisted locally with **SQLite** (`expo-sqlite`); recent items shown on the home screen.
- API keys and preferences stored on-device.

## 🧱 Tech Stack
- Expo SDK 57 · React Native 0.86 · React 19
- `expo-router`, `expo-video`, `expo-sqlite`, `expo-document-picker`, `expo-file-system`
- `ffmpeg-kit-react-native` (audio chunking)
- TypeScript

## 🔑 Services / API Keys
PodText calls external AI services. Configure the keys in **Settings** (stored on-device, never uploaded):
- **FunASR** — Alibaba DashScope API key (transcription)
- **MiMo** — xiaomimimo.com API key (translation, podcast script, ASR)

## 🚀 Getting Started
```bash
npm install
# open the app and enter your API keys in Settings
npx expo start
# run on a device / simulator
npm run android
npm run ios
```
> Large-file **chunked** transcription requires a dev build (`expo-dev-client`) with `ffmpeg-kit`.
> On Expo Go it falls back to sentence-level async transcription.

## 📂 Project Structure
```
app/(tabs)/            Home, Video subtitle, Podcast, Settings
app/player/[id]        Video player with synced subtitles
app/podcast-player/[id] Podcast player with word-level highlight
src/services/          funasr, mimo, edge-tts, audio-chunker
src/store/             settings (SQLite)
src/utils/             srt, uuid, debug
```

## 📄 License
See [LICENSE](./LICENSE).
