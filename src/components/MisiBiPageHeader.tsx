import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = { title: string; eyebrow?: string };
export function goBackToMore() {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)/mai-multe');
}
export default function MisiBiPageHeader({ title, eyebrow = 'MISIUNEA BUCOVINA' }: Props) {
  return <View style={styles.outer}>
    <View style={styles.header}>
      <TouchableOpacity onPress={goBackToMore} style={styles.back} accessibilityRole="button" accessibilityLabel="Înapoi">
        <Ionicons name="chevron-back" size={24} color="#22252B" />
      </TouchableOpacity>
      <View style={styles.text}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  outer: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 3 },
  eyebrow: { color: '#A61E22', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#22252B', fontSize: 26, fontWeight: '900' },
});
