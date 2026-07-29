import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="player/[id]"
          options={{
            title: 'Video Player',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="podcast-player/[id]"
          options={{
            title: 'Podcast',
            headerBackTitle: 'Back',
          }}
        />
      </Stack>
    </>
  );
}
