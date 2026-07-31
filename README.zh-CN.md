# PodText

> AI 驱动的**双语字幕**与**英文播客**生成，全部在手机上完成。
> AI-powered bilingual subtitles and English podcast generation, on your phone.

PodText 是一款跨平台移动应用（Expo / React Native），可将本地的音频与视频转换成：

- 带**字级高亮**的**双语字幕**，支持导出 **SRT**；以及
- 带中文翻译的**英文双人播客**，支持「跟读式」随播放逐词高亮的播放体验。

## ✨ 功能特性

### 🎬 视频字幕
- 通过系统文件选择器导入本地视频 / 音频。
- 通过 **FunASR**（阿里云 DashScope）或 **MiMo ASR** 进行 AI 转写。
- 生成双语字幕（如中文 ↔ 英文），并与播放进度同步实现**字级高亮**。
- 支持将字幕导出为 **SRT** 文件。
- 大文件支持：使用 `ffmpeg-kit` 进行分块同步转写（保留字级时间轴）；超大文件可走 OSS 异步上传（句级时间轴）。

### 🎙 文本转播客
- 粘贴任意文本 → 通过 **MiMo** 大语言模型生成引人入胜的英文**双人对话剧本**（Chloe + Dean），并附带中文翻译。
- 合成的语音带有**字级边界信息**，支持随播放逐词高亮的播放体验。
- 内置播放器，字幕与音频同步高亮。

### 📚 历史记录与设置
- 转写记录 / 播客历史通过 **SQLite**（`expo-sqlite`）持久化保存在本机；首页展示最近的项目。
- API Key 与偏好设置均存储在设备本地。

## 🧱 技术栈
- Expo SDK 57 · React Native 0.86 · React 19
- `expo-router`、`expo-video`、`expo-sqlite`、`expo-document-picker`、`expo-file-system`
- `ffmpeg-kit-react-native`（音频分块）
- TypeScript

## 🔑 服务 / API Key
PodText 会调用外部 AI 服务。请在**设置**中配置相关密钥（仅保存在本机，不会上传）：
- **FunASR** — 阿里云 DashScope API Key（用于转写）
- **MiMo** — xiaomimimo.com API Key（用于翻译、播客剧本生成、ASR 转写）

## 🚀 快速开始
```bash
npm install
# 打开应用，在「设置」中填入你的 API Key
npx expo start
# 在真机 / 模拟器上运行
npm run android
npm run ios
```
> 大文件**分块**转写需要带 `ffmpeg-kit` 的开发构建（`expo-dev-client`）。
> 在 Expo Go 中会回退为句级异步转写。

## 📂 项目结构
```
app/(tabs)/             首页、视频字幕、播客、设置
app/player/[id]         带同步字幕的视频播放器
app/podcast-player/[id] 带字级高亮的播客播放器
src/services/          funasr、mimo、edge-tts、audio-chunker
src/store/             设置（SQLite）
src/utils/             srt、uuid、debug
```

## 📄 许可证
详见 [LICENSE](./LICENSE)。
