// Postinstall hook: ffmpeg-kit-react-native (lufinkey fork) needs an
// expo-module.config.json for Expo's autolinker to discover its native
// Android package. This runs after every npm install / npm ci, so EAS
// builds pick it up automatically.
const fs = require('fs');
const path = require('path');

const config = {
  platforms: ['android'],
  android: {
    modules: ['expo.modules.ffmpegkit.FFmpegKitReactNativeModule'],
    package: 'com.arthenica.ffmpegkit.reactnative',
  },
};

const target = path.join(
  __dirname,
  'node_modules',
  'ffmpeg-kit-react-native',
  'expo-module.config.json'
);

if (fs.existsSync(path.dirname(target))) {
  fs.writeFileSync(target, JSON.stringify(config, null, 2));
  console.log('[postinstall] Created expo-module.config.json for ffmpeg-kit-react-native');
}
