import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { registerConfirmDialog, type ConfirmationDialogRequest } from '../lib/platform-alert';

export default function ConfirmDialog() {
  const [queue, setQueue] = useState<ConfirmationDialogRequest[]>([]);
  const current = queue[0];
  useEffect(() => {
    registerConfirmDialog((request) => setQueue((items) => [...items, request]));
    return () => registerConfirmDialog(null);
  }, []);
  const choose = (index: number | null) => {
    if (!current) return;
    const button = index === null ? undefined : current.buttons[index];
    setQueue((items) => items.slice(1));
    button?.onPress?.();
    if (index === null) current.options?.onDismiss?.();
  };
  const cancelIndex = current?.buttons.findIndex((b) => b.style === 'cancel') ?? -1;
  return (
    <Modal transparent visible={!!current} animationType="fade" onRequestClose={() => choose(cancelIndex >= 0 ? cancelIndex : null)} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.panel} accessibilityViewIsModal>
          <View style={styles.iconCircle}><Text style={styles.icon}>!</Text></View>
          <Text style={styles.title}>{current?.title}</Text>
          {!!current?.message && <Text style={styles.message}>{current.message}</Text>}
          <View style={styles.actions}>
            {current?.buttons.map((button, index) => (
              <Pressable key={`${index}-${button.text}`} accessibilityRole="button" onPress={() => choose(index)} style={[styles.button, button.style === 'destructive' ? styles.danger : button.style === 'cancel' ? styles.cancel : styles.primary]}>
                <Text style={[styles.buttonText, button.style === 'cancel' ? styles.cancelText : styles.whiteText]}>{button.text || 'OK'}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,18,30,0.62)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  panel: { width: '100%', maxWidth: 440, borderRadius: 20, backgroundColor: '#fff', padding: 24, alignItems: 'center', elevation: 12, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20 },
  iconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FCE8E8', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  icon: { color: '#A61E22', fontSize: 28, fontWeight: '800' },
  title: { fontSize: 19, fontWeight: '800', color: '#202936', textAlign: 'center', marginBottom: 12 },
  message: { fontSize: 14, lineHeight: 21, color: '#566171', textAlign: 'center', marginBottom: 22 },
  actions: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  button: { minWidth: 120, flexGrow: 1, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 11, alignItems: 'center' },
  cancel: { backgroundColor: '#F1F3F6' },
  primary: { backgroundColor: '#273142' },
  danger: { backgroundColor: '#A61E22' },
  buttonText: { fontWeight: '700', fontSize: 14 },
  cancelText: { color: '#273142' },
  whiteText: { color: '#fff' },
});
