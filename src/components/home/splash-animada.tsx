import { useEffect, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { T } from '@/components/ui/texto';
import { useTema } from '@/theme/theme-provider';

const ICONE = require('../../../assets/images/splash-icon.png');

/** Splash animada (~3,5 s): coração pulsando, anéis, órbitas e barra de progresso. */
export function SplashAnimada({ onTerminar }: { onTerminar: () => void }) {
  const { c } = useTema();
  const [batida] = useState(() => new Animated.Value(0));
  const [anel1] = useState(() => new Animated.Value(0));
  const [anel2] = useState(() => new Animated.Value(0));
  const [giro1] = useState(() => new Animated.Value(0));
  const [giro2] = useState(() => new Animated.Value(0));
  const [texto] = useState(() => new Animated.Value(0));
  const [barra] = useState(() => new Animated.Value(0));
  const [saida] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(batida, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(batida, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ),
      Animated.loop(Animated.timing(anel1, { toValue: 1, duration: 2000, easing: Easing.out(Easing.quad), useNativeDriver: true })),
      Animated.loop(Animated.timing(anel2, { toValue: 1, duration: 2500, easing: Easing.out(Easing.quad), useNativeDriver: true })),
      Animated.loop(Animated.timing(giro1, { toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(Animated.timing(giro2, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true })),
    ];
    loops.forEach((l) => l.start());
    Animated.timing(texto, { toValue: 1, duration: 500, delay: 400, useNativeDriver: true }).start();
    Animated.timing(barra, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.quad), useNativeDriver: false }).start();
    const t1 = setTimeout(() => Animated.timing(saida, { toValue: 0, duration: 500, useNativeDriver: true }).start(), 3000);
    const t2 = setTimeout(onTerminar, 3500);
    return () => {
      loops.forEach((l) => l.stop());
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [anel1, anel2, barra, batida, giro1, giro2, onTerminar, saida, texto]);

  const escala = batida.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
  const anel = (v: Animated.Value, max: number) => ({
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, max] }) }],
  });
  const rot = (v: Animated.Value, inverso = false) => ({
    transform: [{ rotate: v.interpolate({ inputRange: [0, 1], outputRange: inverso ? ['360deg', '0deg'] : ['0deg', '360deg'] }) }],
  });
  const fundo = c.dark ? '#081F18' : c.primary;
  const marca = c.dark ? c.primary : '#FFFFFF';

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.raiz, { backgroundColor: fundo, opacity: saida }]} pointerEvents="auto">
      <View style={styles.palco}>
        <Animated.View style={[styles.anel, { borderColor: marca }, anel(anel1, 1.3)]} />
        <Animated.View style={[styles.anel, { borderColor: marca }, anel(anel2, 1.4)]} />
        <Animated.View style={[styles.orbita, { borderColor: c.dark ? 'rgba(93,232,208,0.35)' : 'rgba(255,255,255,0.45)', width: 190, height: 190 }, rot(giro1)]}>
          <View style={[styles.ponto, { backgroundColor: marca }]} />
        </Animated.View>
        <Animated.View style={[styles.orbita, { borderColor: c.dark ? 'rgba(93,232,208,0.2)' : 'rgba(255,255,255,0.3)', width: 230, height: 230 }, rot(giro2, true)]}>
          <View style={[styles.ponto, { backgroundColor: marca, width: 7, height: 7 }]} />
        </Animated.View>
        <Animated.View style={{ transform: [{ scale: escala }] }}>
          <Image source={ICONE} style={styles.icone} resizeMode="contain" accessibilityLabel="MedControl" />
        </Animated.View>
      </View>
      <Animated.View style={{ opacity: texto, alignItems: 'center', gap: 6 }}>
        <T peso="extra" tam={34} style={{ color: c.dark ? c.primaryLight : '#FFFFFF' }}>
          MedControl
        </T>
        <T tam={14} peso="medium" style={{ color: c.dark ? c.mutedForeground : 'rgba(255,255,255,0.85)' }}>
          Seus remédios, sempre na hora certa
        </T>
      </Animated.View>
      <View style={[styles.trilha, { backgroundColor: c.dark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.3)' }]}>
        <Animated.View
          style={[styles.preenchimento, { backgroundColor: c.dark ? c.primary : '#FFFFFF', width: barra.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  raiz: { alignItems: 'center', justifyContent: 'center', gap: 36, zIndex: 100 },
  palco: { width: 240, height: 240, alignItems: 'center', justifyContent: 'center' },
  icone: { width: 140, height: 140 },
  anel: { position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 2 },
  orbita: { position: 'absolute', borderRadius: 200, borderWidth: 1, alignItems: 'center' },
  ponto: { width: 9, height: 9, borderRadius: 5, marginTop: -4 },
  trilha: { width: 180, height: 4, borderRadius: 4, overflow: 'hidden' },
  preenchimento: { height: '100%', borderRadius: 4 },
});
