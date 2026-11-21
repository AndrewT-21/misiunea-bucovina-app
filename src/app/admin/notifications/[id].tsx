import { showSaveSuccess } from '../../../lib/save-feedback';
import { Alert } from '../../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator,
  
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
const BACKGROUND = '#F6F6F6';

type NotificationStatus = 'draft' | 'published';

export default function EditNotificationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] =
    useState<NotificationStatus>('draft');
    const [originalStatus, setOriginalStatus] =
  useState<NotificationStatus>('draft');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      loadNotification();
    }
  }, [id]);

  async function loadNotification() {
    setLoading(true);

    const { data, error } = await supabase
      .from('notifications')
      .select('id, title, message, status')
      .eq('id', id)
      .single();

    if (error || !data) {
      console.log(
        'Eroare încărcare notificare:',
        error
      );

      Alert.alert(
        'Eroare',
        'Notificarea nu a putut fi încărcată.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );

      setLoading(false);
      return;
    }

    setTitle(data.title ?? '');
    setMessage(data.message ?? '');
    setStatus(
      data.status === 'published'
        ? 'published'
        : 'draft'
    );
    setOriginalStatus(
  data.status === 'published'
    ? 'published'
    : 'draft'
);

    setLoading(false);
  }

  async function saveNotification() {
    if (!title.trim()) {
      Alert.alert(
        'Titlu obligatoriu',
        'Introdu un titlu pentru notificare.'
      );
      return;
    }

    if (!message.trim()) {
      Alert.alert(
        'Mesaj obligatoriu',
        'Introdu mesajul notificării.'
      );
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('notifications')
        .update({
          title: title.trim(),
          message: message.trim(),
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        console.log(
          'Eroare actualizare notificare:',
          error
        );

        Alert.alert(
          'Eroare',
          'Modificările nu au putut fi salvate.'
        );

        return;
      }

      if (
  originalStatus === 'draft' &&
  status === 'published' &&
  id
) {
  const { error: pushError } =
    await supabase.functions.invoke(
      'send-push-notification',
      {
        body: {
          notification_id: id,
        },
      }
    );

  if (pushError) {
    console.log(
      'Eroare trimitere push:',
      pushError
    );
  }
}

      showSaveSuccess();
      router.back();
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Șterge notificarea',
      'Sigur vrei să ștergi această notificare? Această acțiune nu poate fi anulată.',
      [
        {
          text: 'Anulează',
          style: 'cancel',
        },
        {
          text: 'Șterge',
          style: 'destructive',
          onPress: deleteNotification,
        },
      ]
    );
  }

  async function deleteNotification() {
    try {
      setDeleting(true);

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) {
        console.log(
          'Eroare ștergere notificare:',
          error
        );

        Alert.alert(
          'Eroare',
          'Notificarea nu a putut fi ștearsă.'
        );

        return;
      }

      // Revenim imediat la listă. Ecranul de notificări reîncarcă
      // datele prin useFocusEffect când primește din nou focus.
      router.back();
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator
          size="large"
          color={RED}
        />

        <Text style={styles.loadingText}>
          Se încarcă notificarea...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.screen}
      edges={['top']}
    >
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={DARK}
            />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Text style={styles.eyebrow}>ADMINISTRARE NOTIFICĂRI</Text>

            <Text style={styles.headerTitle}>
              Editează notificarea
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <Text style={styles.sectionLabel}>DETALII NOTIFICARE</Text>
          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>TITLU *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Titlul notificării"
              placeholderTextColor="#AAAAAA"
              maxLength={100}
            />
            <Text style={styles.fieldLabel}>MESAJ *</Text>
            <TextInput
              style={[styles.input, styles.messageInput]}
              value={message}
              onChangeText={setMessage}
              placeholder="Mesajul notificării..."
              placeholderTextColor="#AAAAAA"
              multiline
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={styles.counter}>{message.length}/500</Text>
          </View>

          <Text style={styles.sectionLabel}>VIZIBILITATE</Text>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <TouchableOpacity
                style={[styles.statusButton, status === 'published' && styles.statusButtonSelected]}
                onPress={() => setStatus('published')}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color={status === 'published' ? '#FFFFFF' : '#777777'} />
                <Text style={[styles.statusText, status === 'published' && styles.statusTextSelected]}>Publicată</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.statusButton, status === 'draft' && styles.statusButtonSelected]}
                onPress={() => setStatus('draft')}
              >
                <Ionicons name="document-outline" size={18} color={status === 'draft' ? '#FFFFFF' : '#777777'} />
                <Text style={[styles.statusText, status === 'draft' && styles.statusTextSelected]}>Ciornă</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* SAVE */}
          <TouchableOpacity
            style={[
              styles.saveButton,
              saving && styles.disabledButton,
            ]}
            onPress={saveNotification}
            disabled={saving || deleting}
          >
            {saving ? (
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
              />
            ) : (
              <>
                <Ionicons
                  name="save-outline"
                  size={19}
                  color="#FFFFFF"
                />

                <Text style={styles.saveText}>
                  Salvează modificările
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* DELETE */}
          <TouchableOpacity
            style={[
              styles.deleteButton,
              deleting && styles.disabledButton,
            ]}
            onPress={confirmDelete}
            disabled={saving || deleting}
          >
            {deleting ? (
              <ActivityIndicator
                size="small"
                color={RED}
              />
            ) : (
              <>
                <Ionicons
                  name="trash-outline"
                  size={19}
                  color={RED}
                />

                <Text style={styles.deleteText}>
                  Șterge notificarea
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: '#777777',
    fontSize: 11,
    marginTop: 10,
  },

  header: {
    ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerContent: {
    flex: 1,
    marginLeft: 13,
  },

  eyebrow: {
    color: RED,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },

  headerTitle: {
    color: DARK,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 1,
  },

  content: { ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
    padding: 15,
    paddingBottom: 50,
  },

  sectionLabel: {
    color: '#999999',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginTop: 18,
    marginBottom: 9,
    marginLeft: 5,
  },

  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    padding: 15,
  },

  fieldLabel: {
    color: DARK,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 9,
    marginBottom: 7,
    marginLeft: 3,
  },

  input: {
    minHeight: 50,
    backgroundColor: '#F7F7F7',
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: DARK,
    fontSize: 12,
  },

  messageInput: {
    minHeight: 125,
    marginTop: 0,
  },

  counter: {
    color: '#AAAAAA',
    fontSize: 9,
    textAlign: 'right',
    marginTop: 8,
  },

  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    padding: 8,
  },

  statusRow: {
    flexDirection: 'row',
    gap: 9,
  },

  statusButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  statusButtonSelected: {
    backgroundColor: RED,
    borderColor: RED,
  },

  statusText: {
    color: '#777777',
    fontSize: 11,
    fontWeight: '800',
  },

  statusTextSelected: {
    color: '#FFFFFF',
  },

  saveButton: {
    minHeight: 55,
    backgroundColor: RED,
    borderRadius: 16,
    marginTop: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  saveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  deleteButton: {
    minHeight: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#F1CCCC',
  },

  deleteText: {
    color: RED,
    fontSize: 12,
    fontWeight: '900',
  },

  disabledButton: {
    opacity: 0.6,
  },
});