import { Lora_600SemiBold } from '@expo-google-fonts/lora/600SemiBold';
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SplashAnimada } from '@/components/home/splash-animada';
import { ToastHost } from '@/components/ui/toast-host';
import { useRespostasNotificacao } from '@/hooks/use-respostas-notificacao';
// importar o módulo já define a tarefa de segundo plano (TaskManager.defineTask) no escopo global
import { registrarTarefaReabastecimento } from '@/lib/alarmes/tarefa';
import { iniciar, observarPrimeiroPlano, useApp } from '@/lib/store';
import { fontes } from '@/theme/tokens';
import { ThemeProvider, useTema } from '@/theme/theme-provider';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Raiz />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Raiz() {
  const { c, carregado } = useTema();
  const [fontesOk, erroFontes] = useFonts({ Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, Lora_600SemiBold });
  const pronto = useApp((s) => s.pronto);
  const [splashTerminou, setSplashTerminou] = useState(false);

  useEffect(() => {
    void iniciar();
    return observarPrimeiroPlano();
  }, []);

  useEffect(() => {
    if (pronto) void registrarTarefaReabastecimento();
  }, [pronto]);

  useRespostasNotificacao();

  const podeMostrar = (fontesOk || !!erroFontes) && carregado;
  useEffect(() => {
    if (podeMostrar) void SplashScreen.hideAsync();
  }, [podeMostrar]);

  if (!podeMostrar) return null;

  return (
    <>
      <StatusBar style={c.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="alarme" options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
        <Stack.Screen
          name="configuracoes"
          options={{
            headerShown: true,
            title: 'Configurações',
            headerStyle: { backgroundColor: c.background },
            headerTintColor: c.foreground,
            headerTitleStyle: { fontFamily: fontes.extra },
            headerShadowVisible: false,
          }}
        />
      </Stack>
      <ToastHost />
      {!(splashTerminou && pronto) ? <SplashAnimada onTerminar={() => setSplashTerminou(true)} /> : null}
    </>
  );
}
