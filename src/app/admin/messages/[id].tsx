import { Alert } from '../../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ActivityIndicator,
  
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
const BACKGROUND = '#F6F6F6';

type MessageStatus = 'new' | 'read' | 'replied' | 'closed';

type Message = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: MessageStatus;
  created_at: string;
};

export default function AdminMessageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [message, setMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadMessage();
  }, [id]);

  async function loadMessage() {
    if (!id) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('messages')
      .select(`
        id,
        name,
        email,
        phone,
        subject,
        message,
        status,
        created_at
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.log('Eroare încărcare mesaj:', error);
      setLoading(false);
      return;
    }

    if (!data) {
      setLoading(false);
      return;
    }

    setMessage(data as Message);
    setLoading(false);

    // Când administratorul deschide un mesaj nou,
    // îl marcăm automat ca citit.
    if (data.status === 'new') {
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          status: 'read',
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.id);

      if (!updateError) {
        setMessage({
          ...(data as Message),
          status: 'read',
        });
      }
    }
  }

  async function updateStatus(status: MessageStatus) {
    if (!message || updating) {
      return;
    }

    try {
      setUpdating(true);

      const { error } = await supabase
        .from('messages')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', message.id);

      if (error) {
        console.log('Eroare actualizare mesaj:', error);

        Alert.alert(
          'Eroare',
          'Statusul mesajului nu a putut fi actualizat.'
        );
        return;
      }

      setMessage({
        ...message,
        status,
      });
    } finally {
      setUpdating(false);
    }
  }

  function confirmDelete() {
  if (!message) {
    return;
  }

  Alert.alert(
    'Șterge mesajul',
    'Sigur vrei să ștergi acest mesaj? Această acțiune nu poate fi anulată.',
    [
      {
        text: 'Anulează',
        style: 'cancel',
      },
      {
        text: 'Șterge',
        style: 'destructive',
        onPress: deleteMessage,
      },
    ]
  );
}

async function deleteMessage() {
  if (!message) {
    return;
  }

  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', message.id);

  if (error) {
    console.log('Eroare ștergere mesaj:', error);

    Alert.alert(
      'Eroare',
      'Mesajul nu a putut fi șters.'
    );

    return;
  }

  router.back();
}

  function statusLabel(status: MessageStatus) {
    switch (status) {
      case 'new':
        return 'NOU';
      case 'read':
        return 'CITIT';
      case 'replied':
        return 'RĂSPUNS';
      case 'closed':
        return 'ÎNCHIS';
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={RED} />

        <Text style={styles.loadingText}>
          Se încarcă mesajul...
        </Text>
      </SafeAreaView>
    );
  }

  if (!message) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons
          name="mail-open-outline"
          size={38}
          color={RED}
        />

        <Text style={styles.notFoundTitle}>
          Mesajul nu a fost găsit
        </Text>

        <TouchableOpacity
          style={styles.backToMessages}
          onPress={() => router.back()}
        >
          <Text style={styles.backToMessagesText}>
            Înapoi la mesaje
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
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

          <Text style={styles.title}>
            Detalii mesaj
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.senderCard}>
          <View style={styles.avatar}>
            <Ionicons
              name="person-outline"
              size={24}
              color={RED}
            />
          </View>

          <View style={styles.senderContent}>
            <Text style={styles.senderName}>
              {message.name}
            </Text>

            <Text style={styles.date}>
              {new Intl.DateTimeFormat('ro-RO', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }).format(new Date(message.created_at))}
            </Text>
          </View>

          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>
              {statusLabel(message.status)}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>
          DATE DE CONTACT
        </Text>

        <View style={styles.card}>
          <InfoRow
            icon="mail-outline"
            label="Email"
            value={message.email}
          />

          {message.phone ? (
            <InfoRow
              icon="call-outline"
              label="Telefon"
              value={message.phone}
            />
          ) : null}
        </View>

        <Text style={styles.sectionLabel}>
          SUBIECT
        </Text>

        <View style={styles.card}>
          <Text style={styles.subject}>
            {message.subject}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>
          MESAJ
        </Text>

        <View style={styles.messageCard}>
          <Text style={styles.messageText}>
            {message.message}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>
          STATUS
        </Text>

        <View style={styles.statusOptions}>
          <StatusButton
            label="Citit"
            icon="mail-open-outline"
            active={message.status === 'read'}
            disabled={updating}
            onPress={() => updateStatus('read')}
          />

          <StatusButton
            label="Răspuns"
            icon="checkmark-circle-outline"
            active={message.status === 'replied'}
            disabled={updating}
            onPress={() => updateStatus('replied')}
          />

          <StatusButton
            label="Închis"
            icon="archive-outline"
            active={message.status === 'closed'}
            disabled={updating}
            onPress={() => updateStatus('closed')}
          />
        </View>
        <TouchableOpacity
  style={styles.deleteButton}
  onPress={confirmDelete}
  activeOpacity={0.8}
>
  <Ionicons
    name="trash-outline"
    size={19}
    color={RED}
  />

  <Text style={styles.deleteButtonText}>
    Șterge mesajul
  </Text>
</TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

type InfoRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
};

function InfoRow({
  icon,
  label,
  value,
}: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons
          name={icon}
          size={19}
          color={RED}
        />
      </View>

      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>
          {label}
        </Text>

        <Text style={styles.infoValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

type StatusButtonProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
};

function StatusButton({
  label,
  icon,
  active,
  disabled,
  onPress,
}: StatusButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.statusButton,
        active && styles.statusButtonActive,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Ionicons
        name={icon}
        size={19}
        color={active ? '#FFFFFF' : RED}
      />

      <Text
        style={[
          styles.statusButtonText,
          active && styles.statusButtonTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },

  center: {
    flex: 1,
    backgroundColor: BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 25,
  },

  loadingText: {
    color: '#777777',
    fontSize: 11,
    marginTop: 10,
  },

  notFoundTitle: {
    color: DARK,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 12,
  },

  backToMessages: {
    backgroundColor: RED,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: 16,
  },

  backToMessagesText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
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

  title: {
    color: DARK,
    fontSize: 27,
    fontWeight: '900',
    marginTop: 1,
  },

  content: { ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
    padding: 15,
    paddingBottom: 40,
  },

  senderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  senderContent: {
    flex: 1,
    marginLeft: 11,
  },

  senderName: {
    color: DARK,
    fontSize: 14,
    fontWeight: '900',
  },

  date: {
    color: '#999999',
    fontSize: 8,
    marginTop: 4,
  },

  statusBadge: {
    backgroundColor: '#FFF0F0',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  statusBadgeText: {
    color: RED,
    fontSize: 7,
    fontWeight: '900',
  },

  sectionLabel: {
    color: '#999999',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginTop: 23,
    marginBottom: 9,
    marginLeft: 5,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    padding: 15,
    gap: 15,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  infoContent: {
    flex: 1,
    marginLeft: 10,
  },

  infoLabel: {
    color: '#999999',
    fontSize: 8,
    fontWeight: '800',
  },

  infoValue: {
    color: DARK,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },

  subject: {
    color: DARK,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 20,
  },

  messageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    padding: 17,
  },

  messageText: {
    color: '#555555',
    fontSize: 12,
    lineHeight: 20,
  },

  statusOptions: {
    gap: 9,
  },

  statusButton: {
    minHeight: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },

  statusButtonActive: {
    backgroundColor: RED,
    borderColor: RED,
  },

  statusButtonText: {
    color: RED,
    fontSize: 11,
    fontWeight: '900',
  },

  statusButtonTextActive: {
    color: '#FFFFFF',
  },
  deleteButton: {
  minHeight: 54,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: '#F1D6D6',
  backgroundColor: '#FFFFFF',
  marginTop: 25,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
},

deleteButtonText: {
  color: RED,
  fontSize: 12,
  fontWeight: '900',
},
});