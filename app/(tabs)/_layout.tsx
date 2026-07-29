import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#534AB7',
        tabBarInactiveTintColor: '#888780',
        tabBarStyle: {
          borderTopWidth: 0.5,
          borderTopColor: '#D3D1C7',
          backgroundColor: '#FFFFFF',
        },
        headerStyle: {
          backgroundColor: '#FFFFFF',
        },
        headerTitleStyle: {
          fontWeight: '500',
          fontSize: 17,
          color: '#2C2C2A',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
        }}
      />
      <Tabs.Screen
        name="subtitle"
        options={{
          title: 'Video Subtitle',
          tabBarLabel: 'Subtitle',
        }}
      />
      <Tabs.Screen
        name="podcast"
        options={{
          title: 'Text to Podcast',
          tabBarLabel: 'Podcast',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
        }}
      />
    </Tabs>
  );
}
