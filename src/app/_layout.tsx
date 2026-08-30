import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect } from 'react';
import { View } from 'react-native';

import { ErrorBoundary } from '@/components/error-boundary';
import { migrateDb } from '@/data/migrations';
import { colors } from '@/theme/theme';

const DATABASE_NAME = 'reviewer.db';

async function onDatabaseInit(db: SQLiteDatabase): Promise<void> {
  await migrateDb(db);
}

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="light" />
      <ErrorBoundary>
        <Suspense fallback={<View style={{ flex: 1, backgroundColor: colors.background }} />}>
          <SQLiteProvider databaseName={DATABASE_NAME} onInit={onDatabaseInit} useSuspense>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="title/[type]/[id]" options={{ animation: 'slide_from_right' }} />
            </Stack>
          </SQLiteProvider>
        </Suspense>
      </ErrorBoundary>
    </View>
  );
}
