import MisiBiPageHeader from '../components/MisiBiPageHeader';
import { Alert } from '../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
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

import { supabase } from '../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
const BACKGROUND = '#F6F6F6';

export default function ContactScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [contactInfo, setContactInfo] = useState({
  email: '',
  phone: '',
  address: '',
  website: '',
});

useEffect(() => {
  loadContactInfo();
}, []);

async function loadContactInfo() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('email, phone, address, website')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.log(
      'Eroare încărcare date contact:',
      error
    );
    return;
  }

  if (data) {
    setContactInfo({
      email: data.email ?? '',
      phone: data.phone ?? '',
      address: data.address ?? '',
      website: data.website ?? '',
    });
  }
}

  async function sendMessage() {
    if (
      !name.trim() ||
      !email.trim() ||
      !subject.trim() ||
      !message.trim()
    ) {
      Alert.alert(
        'Câmpuri incomplete',
        'Completează numele, emailul, subiectul și mesajul.'
      );
      return;
    }

    if (!email.includes('@')) {
      Alert.alert(
        'Email invalid',
        'Introdu o adresă de email validă.'
      );
      return;
    }

    try {
      setSending(true);

      const { error } = await supabase
        .from('messages')
        .insert({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          subject: subject.trim(),
          message: message.trim(),
          status: 'new',
        });

      if (error) {
        console.log('Eroare trimitere mesaj:', error);

        Alert.alert(
          'Eroare',
          'Mesajul nu a putut fi trimis. Încearcă din nou.'
        );
        return;
      }

      Alert.alert(
        'Mesaj trimis',
        'Îți mulțumim! Mesajul tău a fost trimis cu succes.',
        [
          {
            text: 'OK',
            onPress: () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/mai-multe')),
          },
        ]
      );
    } catch (error) {
      console.log('Eroare neașteptată:', error);

      Alert.alert(
        'Eroare',
        'A apărut o problemă neașteptată.'
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <MisiBiPageHeader title="Contact" eyebrow="MISIUNEA BUCOVINA" />

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { maxWidth: 1120, width: '100%', alignSelf: 'center' as const }]}
        >
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons
                name="mail-outline"
                size={28}
                color={RED}
              />
            </View>

            <Text style={styles.heroTitle}>
              Scrie-ne un mesaj
            </Text>

            <Text style={styles.heroText}>
              Ai o întrebare sau dorești să iei legătura cu
              echipa Misiunea Bucovina? Trimite-ne un mesaj.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>
            DATE DE CONTACT
          </Text>

          <View style={styles.contactCard}>
  {contactInfo.email ? (
    <ContactRow
      icon="mail-outline"
      label="Email"
      value={contactInfo.email}
    />
  ) : null}

  {contactInfo.phone ? (
    <ContactRow
      icon="call-outline"
      label="Telefon"
      value={contactInfo.phone}
    />
  ) : null}

  {contactInfo.address ? (
    <ContactRow
      icon="location-outline"
      label="Adresă"
      value={contactInfo.address}
    />
  ) : null}

  {contactInfo.website ? (
    <ContactRow
      icon="globe-outline"
      label="Website"
      value={contactInfo.website}
    />
  ) : null}
</View>

<Text style={styles.sectionLabel}>
  TRIMITE UN MESAJ
</Text>

          <View style={styles.formCard}>
            <FormField
              label="Nume și prenume"
              placeholder="Numele tău"
              value={name}
              onChangeText={setName}
              icon="person-outline"
            />

            <FormField
              label="Email"
              placeholder="exemplu@email.com"
              value={email}
              onChangeText={setEmail}
              icon="mail-outline"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <FormField
              label="Telefon"
              optional
              placeholder="Număr de telefon"
              value={phone}
              onChangeText={setPhone}
              icon="call-outline"
              keyboardType="phone-pad"
            />

            <FormField
              label="Subiect"
              placeholder="Despre ce dorești să ne scrii?"
              value={subject}
              onChangeText={setSubject}
              icon="chatbubble-outline"
            />

            <View style={styles.field}>
              <Text style={styles.label}>
                Mesaj
              </Text>

              <TextInput
                style={[styles.input, styles.messageInput]}
                placeholder="Scrie mesajul tău aici..."
                placeholderTextColor="#AAAAAA"
                value={message}
                onChangeText={setMessage}
                multiline
                textAlignVertical="top"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.sendButton,
              sending && styles.disabledButton,
            ]}
            onPress={sendMessage}
            disabled={sending}
            activeOpacity={0.85}
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name="send-outline"
                  size={19}
                  color="#FFFFFF"
                />

                <Text style={styles.sendButtonText}>
                  Trimite mesajul
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.noteCard}>
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color={RED}
            />

            <Text style={styles.noteText}>
              Datele tale vor fi folosite doar pentru a putea
              răspunde solicitării tale.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type ContactRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
};

function ContactRow({
  icon,
  label,
  value,
}: ContactRowProps) {
  return (
    <View style={styles.contactRow}>
      <View style={styles.contactIcon}>
        <Ionicons
          name={icon}
          size={19}
          color={RED}
        />
      </View>

      <View style={styles.contactTextContainer}>
        <Text style={styles.contactLabel}>
          {label}
        </Text>

        <Text style={styles.contactValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

type FormFieldProps = {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  icon: keyof typeof Ionicons.glyphMap;
  optional?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};

function FormField({
  label,
  placeholder,
  value,
  onChangeText,
  icon,
  optional = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
}: FormFieldProps) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label}
        </Text>

        {optional ? (
          <Text style={styles.optional}>
            OPȚIONAL
          </Text>
        ) : null}
      </View>

      <View style={styles.inputContainer}>
        <Ionicons
          name={icon}
          size={18}
          color="#999999"
        />

        <TextInput
          style={styles.textInput}
          placeholder={placeholder}
          placeholderTextColor="#AAAAAA"
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },

  header: {
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: 10,
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

  headerText: {
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

  content: { maxWidth: 1120, width: '100%', alignSelf: 'center',
    padding: 15,
    paddingBottom: 40,
  },

  hero: {
    backgroundColor: '#FFFFFF',
    borderRadius: 21,
    padding: 20,
  },

  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroTitle: {
    color: DARK,
    fontSize: 21,
    fontWeight: '900',
    marginTop: 15,
  },

  heroText: {
    color: '#777777',
    fontSize: 11,
    lineHeight: 18,
    marginTop: 6,
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

  contactCard: {
  backgroundColor: '#FFFFFF',
  borderRadius: 20,
  padding: 16,
  gap: 15,
},

contactRow: {
  flexDirection: 'row',
  alignItems: 'center',
},

contactIcon: {
  width: 42,
  height: 42,
  borderRadius: 13,
  backgroundColor: '#FFF0F0',
  alignItems: 'center',
  justifyContent: 'center',
},

contactTextContainer: {
  flex: 1,
  marginLeft: 12,
},

contactLabel: {
  color: '#999999',
  fontSize: 8,
  fontWeight: '900',
  letterSpacing: 0.6,
  textTransform: 'uppercase',
},

contactValue: {
  color: DARK,
  fontSize: 11,
  fontWeight: '700',
  marginTop: 3,
  lineHeight: 17,
},

  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    gap: 18,
  },

  field: {
    gap: 7,
  },

  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  label: {
    color: DARK,
    fontSize: 11,
    fontWeight: '800',
  },

  optional: {
    color: '#AAAAAA',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  inputContainer: {
    minHeight: 51,
    borderRadius: 14,
    backgroundColor: '#F7F7F7',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },

  textInput: {
    flex: 1,
    color: DARK,
    fontSize: 12,
    minHeight: 49,
  },

  input: {
    backgroundColor: '#F7F7F7',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    padding: 13,
    color: DARK,
    fontSize: 12,
  },

  messageInput: {
    minHeight: 135,
  },

  sendButton: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: RED,
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  disabledButton: {
    opacity: 0.6,
  },

  noteCard: {
    marginTop: 12,
    backgroundColor: '#FFF0F0',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  noteText: {
    flex: 1,
    color: '#777777',
    fontSize: 9,
    lineHeight: 14,
  },
});