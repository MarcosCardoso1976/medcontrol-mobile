import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { fontes, radius } from '@/theme/tokens';
import { useTema } from '@/theme/theme-provider';
import { T } from './texto';

interface Props extends TextInputProps {
  rotulo?: string;
  erro?: string;
  dica?: string;
}

export function Campo({ rotulo, erro, dica, style, onFocus, onBlur, ...rest }: Props) {
  const { c } = useTema();
  const [foco, setFoco] = useState(false);
  return (
    <View style={styles.wrap}>
      {rotulo ? (
        <T peso="bold" tam={13} style={styles.rotulo}>
          {rotulo}
        </T>
      ) : null}
      <TextInput
        accessibilityLabel={rotulo}
        placeholderTextColor={c.mutedForeground}
        {...rest}
        onFocus={(e) => {
          setFoco(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFoco(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          {
            color: c.foreground,
            backgroundColor: c.dark ? 'rgba(255,255,255,0.04)' : c.card,
            borderColor: erro ? c.destructive : foco ? c.primary : c.input,
          },
          style,
        ]}
      />
      {erro ? (
        <T tam={12} tom="destrutivo" peso="medium">
          {erro}
        </T>
      ) : dica ? (
        <T tam={12} tom="suave">
          {dica}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  rotulo: { marginLeft: 2 },
  input: {
    height: 46,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: fontes.regular,
  },
});
