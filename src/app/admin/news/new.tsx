import { showSaveSuccess } from '../../../lib/save-feedback';
import AdminSectionHeader from '../../../components/AdminSectionHeader';
import { Alert } from '../../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator,
    
    Image,
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

type NewsStatus = 'published' | 'draft';

export default function NewNewsScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] =
    useState<NewsStatus>('published');

  const [saving, setSaving] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);

  async function pickImage() {
  const permission =
    await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    Alert.alert(
      'Permisiune necesară',
      'Permite accesul la fotografii pentru a putea selecta o imagine.'
    );
    return;
  }

  const result =
    await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

  if (!result.canceled) {
    setImageUri(result.assets[0].uri);
  }
}

  async function saveNews() {
  if (!title.trim()) {
    Alert.alert(
      'Titlu necesar',
      'Introdu un titlu pentru noutate.'
    );
    return;
  }

  if (saving) return;

  setSaving(true);

  try {
    let imageUrl: string | null = null;

    // Dacă a fost selectată o fotografie,
    // o încărcăm în Supabase Storage.
    if (imageUri) {
      const response = await fetch(imageUri);
      const arrayBuffer = await response.arrayBuffer();

      const extension =
        imageUri.split('.').pop()?.toLowerCase() || 'jpg';

      const fileName =
        `${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 8)}.${extension}`;

      const filePath = `news/${fileName}`;

      const { error: uploadError } =
        await supabase.storage
          .from('news-images')
          .upload(filePath, arrayBuffer, {
            contentType:
              extension === 'png'
                ? 'image/png'
                : 'image/jpeg',
            upsert: false,
          });

      if (uploadError) {
        console.log(
          'Eroare upload fotografie:',
          uploadError
        );

        Alert.alert(
          'Eroare',
          'Fotografia nu a putut fi încărcată.'
        );

        setSaving(false);
        return;
      }

      const { data: publicUrlData } =
        supabase.storage
          .from('news-images')
          .getPublicUrl(filePath);

      imageUrl = publicUrlData.publicUrl;
    }

    // Salvăm noutatea în baza de date.
    const { error } = await supabase
      .from('news')
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        content: content.trim() || null,
        image_url: imageUrl,
        status,
      });

    if (error) {
      console.log(
        'Eroare creare noutate:',
        error
      );

      Alert.alert(
        'Eroare',
        'Noutatea nu a putut fi salvată.'
      );

      setSaving(false);
      return;
    }

    setSaving(false);

    showSaveSuccess();

    router.back();
  } catch (error) {
    console.log(
      'Eroare neașteptată:',
      error
    );

    setSaving(false);

    Alert.alert(
      'Eroare',
      'A apărut o problemă la salvarea noutății.'
    );
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
        <AdminSectionHeader title="Adaugă noutate" backTo="/admin/news" />

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >

            <Text style={styles.label}>
  FOTOGRAFIE
</Text>

<TouchableOpacity
  style={styles.imagePicker}
  activeOpacity={0.8}
  onPress={pickImage}
>
  {imageUri ? (
    <>
      <Image
        source={{ uri: imageUri }}
        style={styles.previewImage}
      />

      <View style={styles.changeImage}>
        <Ionicons
          name="camera-outline"
          size={17}
          color="#FFFFFF"
        />

        <Text style={styles.changeImageText}>
          Schimbă fotografia
        </Text>
      </View>
    </>
  ) : (
    <View style={styles.imagePlaceholder}>
      <View style={styles.cameraIcon}>
        <Ionicons
          name="camera-outline"
          size={27}
          color={RED}
        />
      </View>

      <Text style={styles.imageTitle}>
        Adaugă o fotografie
      </Text>

      <Text style={styles.imageSubtitle}>
        Alege o imagine din telefon
      </Text>
    </View>
  )}
</TouchableOpacity>

          <Text style={styles.label}>
            TITLU *
          </Text>

          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Titlul noutății"
            placeholderTextColor="#AAAAAA"
          />

          <Text style={styles.label}>
            DESCRIERE SCURTĂ
          </Text>

          <TextInput
            style={[
              styles.input,
              styles.descriptionInput,
            ]}
            value={description}
            onChangeText={setDescription}
            placeholder="O scurtă prezentare..."
            placeholderTextColor="#AAAAAA"
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>
            CONȚINUT
          </Text>

          <TextInput
            style={[
              styles.input,
              styles.contentInput,
            ]}
            value={content}
            onChangeText={setContent}
            placeholder="Scrie noutatea aici..."
            placeholderTextColor="#AAAAAA"
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>
            STATUS
          </Text>

          <View style={styles.statusRow}>
            <TouchableOpacity
              style={[
                styles.statusButton,
                status === 'published' &&
                  styles.statusButtonSelected,
              ]}
              onPress={() =>
                setStatus('published')
              }
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color={
                  status === 'published'
                    ? '#FFFFFF'
                    : '#777777'
                }
              />

              <Text
                style={[
                  styles.statusText,
                  status === 'published' &&
                    styles.statusTextSelected,
                ]}
              >
                Publicat
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.statusButton,
                status === 'draft' &&
                  styles.statusButtonSelected,
              ]}
              onPress={() =>
                setStatus('draft')
              }
            >
              <Ionicons
                name="document-outline"
                size={18}
                color={
                  status === 'draft'
                    ? '#FFFFFF'
                    : '#777777'
                }
              />

              <Text
                style={[
                  styles.statusText,
                  status === 'draft' &&
                    styles.statusTextSelected,
                ]}
              >
                Draft
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoCard}>
            <Ionicons
              name="information-circle-outline"
              size={21}
              color={RED}
            />

            <Text style={styles.infoText}>
              O noutate publicată va putea fi
              afișată utilizatorilor aplicației.
              Un draft va fi vizibil doar în
              zona Admin.
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.saveButton,
              saving && styles.disabledButton,
            ]}
            onPress={saveNews}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <>
                <Ionicons
                  name={
                    status === 'published'
                      ? 'cloud-upload-outline'
                      : 'save-outline'
                  }
                  size={20}
                  color="#FFFFFF"
                />

                <Text style={styles.saveText}>
                  {status === 'published'
                    ? 'Publică noutatea'
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
    minHeight: 68,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F4F4F4',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    flex: 1,
    color: DARK,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },

  headerSpace: {
    width: 42,
  },

  content: { ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
    padding: 15,
    paddingBottom: 40,
  },

  imagePicker: {
  width: '100%',
  height: 190,
  borderRadius: 18,
  backgroundColor: '#FFFFFF',
  overflow: 'hidden',
  borderWidth: 1,
  borderColor: '#EEEEEE',
},

imagePlaceholder: {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
},

cameraIcon: {
  width: 52,
  height: 52,
  borderRadius: 16,
  backgroundColor: '#FFF0F0',
  alignItems: 'center',
  justifyContent: 'center',
},

imageTitle: {
  color: DARK,
  fontSize: 12,
  fontWeight: '900',
  marginTop: 10,
},

imageSubtitle: {
  color: '#999999',
  fontSize: 9,
  marginTop: 4,
},

previewImage: {
  width: '100%',
  height: '100%',
},

changeImage: {
  position: 'absolute',
  right: 10,
  bottom: 10,
  backgroundColor: 'rgba(0,0,0,0.7)',
  borderRadius: 12,
  paddingHorizontal: 10,
  paddingVertical: 7,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 5,
},

changeImageText: {
  color: '#FFFFFF',
  fontSize: 9,
  fontWeight: '800',
},

  label: {
    color: '#777777',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 7,
    marginLeft: 3,
  },

  input: {
    minHeight: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: DARK,
    fontSize: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },

  descriptionInput: {
    minHeight: 90,
  },

  contentInput: {
    minHeight: 190,
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

  infoCard: {
    marginTop: 20,
    padding: 14,
    borderRadius: 15,
    backgroundColor: '#FFF0F0',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },

  infoText: {
    flex: 1,
    color: '#666666',
    fontSize: 10,
    lineHeight: 16,
  },

  saveButton: {
    minHeight: 55,
    borderRadius: 16,
    backgroundColor: RED,
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  disabledButton: {
    opacity: 0.6,
  },

  saveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
});