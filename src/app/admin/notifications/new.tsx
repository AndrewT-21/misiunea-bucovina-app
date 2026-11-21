import { showSaveSuccess } from '../../../lib/save-feedback';
import { Alert } from '../../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
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

export default function NewNotificationScreen() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] =
    useState<NotificationStatus>('draft');

  const [saving, setSaving] = useState(false);

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

      const { data, error } = await supabase
  .from('notifications')
  .insert({
    title: title.trim(),
    message: message.trim(),
    status,
    updated_at: new Date().toISOString(),
  })
  .select('id')
  .single();

      if (error) {
        console.log(
          'Eroare creare notificare:',
          error
        );

        Alert.alert(
          'Eroare',
          'Notificarea nu a putut fi salvată.'
        );

        return;
      }

      if (status === 'published' && data?.id) {
  const { error: pushError } =
    await supabase.functions.invoke(
      'send-push-notification',
      {
        body: {
          notification_id: data.id,
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
              name="chevron-back"
              size={24}
              color={DARK}
            />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Text style={styles.eyebrow}>
              ADMINISTRARE
            </Text>

            <Text style={styles.headerTitle}>
              Notificare nouă
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          {/* INFO */}
          <View style={styles.infoCard}>
            <Ionicons
              name="notifications-outline"
              size={23}
              color={RED}
            />

            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>
                Creează o notificare
              </Text>

              <Text style={styles.infoText}>
                Notificările publicate vor apărea în
                centrul de notificări al aplicației.
              </Text>
            </View>
          </View>

          {/* CONTENT */}
          <Text style={styles.sectionLabel}>
            CONȚINUT
          </Text>

          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>
              Titlu
            </Text>

            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Ex: Un nou caz are nevoie de ajutor"
              placeholderTextColor="#AAAAAA"
              maxLength={100}
            />

            <Text style={styles.fieldLabel}>
              Mesaj
            </Text>

            <TextInput
              style={[
                styles.input,
                styles.messageInput,
              ]}
              value={message}
              onChangeText={setMessage}
              placeholder="Scrie mesajul notificării..."
              placeholderTextColor="#AAAAAA"
              multiline
              textAlignVertical="top"
              maxLength={500}
            />

            <Text style={styles.counter}>
              {message.length}/500
            </Text>
          </View>

          {/* STATUS */}
          <Text style={styles.sectionLabel}>
            STATUS
          </Text>

          <View style={styles.statusContainer}>
            <TouchableOpacity
              style={[
                styles.statusOption,
                status === 'draft' &&
                  styles.statusOptionSelected,
              ]}
              onPress={() => setStatus('draft')}
            >
              <View
                style={[
                  styles.radio,
                  status === 'draft' &&
                    styles.radioSelected,
                ]}
              >
                {status === 'draft' && (
                  <View style={styles.radioInner} />
                )}
              </View>

              <View style={styles.statusContent}>
                <Text style={styles.statusTitle}>
                  Draft
                </Text>

                <Text style={styles.statusDescription}>
                  Salvează fără să fie vizibilă public.
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.statusOption,
                status === 'published' &&
                  styles.statusOptionSelected,
              ]}
              onPress={() =>
                setStatus('published')
              }
            >
              <View
                style={[
                  styles.radio,
                  status === 'published' &&
                    styles.radioSelected,
                ]}
              >
                {status === 'published' && (
                  <View style={styles.radioInner} />
                )}
              </View>

              <View style={styles.statusContent}>
                <Text style={styles.statusTitle}>
                  Publicată
                </Text>

                <Text style={styles.statusDescription}>
                  Devine vizibilă imediat în aplicație.
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* SAVE */}
          <TouchableOpacity
            style={[
              styles.saveButton,
              saving && styles.saveButtonDisabled,
            ]}
            onPress={saveNotification}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
              />
            ) : (
              <>
                <Ionicons
                  name={
                    status === 'published'
                      ? 'send-outline'
                      : 'save-outline'
                  }
                  size={19}
                  color="#FFFFFF"
                />

                <Text style={styles.saveButtonText}>
                  {status === 'published'
                    ? 'Publică notificarea'
                    : 'Salvează draft'}
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
    fontSize: 27,
    fontWeight: '900',
    marginTop: 1,
  },

  content: { ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
    padding: 15,
    paddingBottom: 45,
  },

  infoCard: {
    backgroundColor: '#FFF0F0',
    borderRadius: 18,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },

  infoContent: {
    flex: 1,
    marginLeft: 11,
  },

  infoTitle: {
    color: DARK,
    fontSize: 12,
    fontWeight: '900',
  },

  infoText: {
    color: '#777777',
    fontSize: 9,
    lineHeight: 14,
    marginTop: 3,
  },

  sectionLabel: {
    color: '#999999',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginTop: 24,
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
    marginBottom: 7,
    marginTop: 4,
  },

  input: {
    minHeight: 48,
    backgroundColor: '#F7F7F7',
    borderRadius: 13,
    paddingHorizontal: 13,
    color: DARK,
    fontSize: 11,
    marginBottom: 16,
  },

  messageInput: {
    minHeight: 125,
    paddingTop: 13,
    paddingBottom: 13,
    marginBottom: 5,
  },

  counter: {
    color: '#AAAAAA',
    fontSize: 9,
    textAlign: 'right',
  },

  statusContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    padding: 8,
    gap: 6,
  },

  statusOption: {
    minHeight: 68,
    borderRadius: 14,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },

  statusOptionSelected: {
    backgroundColor: '#FFF0F0',
  },

  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#BBBBBB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  radioSelected: {
    borderColor: RED,
  },

  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: RED,
  },

  statusContent: {
    flex: 1,
    marginLeft: 11,
  },

  statusTitle: {
    color: DARK,
    fontSize: 12,
    fontWeight: '900',
  },

  statusDescription: {
    color: '#888888',
    fontSize: 9,
    marginTop: 3,
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

  saveButtonDisabled: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
});