import { showSaveSuccess } from '../../../lib/save-feedback';
import { Alert } from '../../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
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

type NewsItem = {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  image_url: string | null;
  status: NewsStatus;
};

export default function EditNewsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<NewsStatus>('published');

  const [currentImageUrl, setCurrentImageUrl] =
    useState<string | null>(null);

  const [newImageUri, setNewImageUri] =
    useState<string | null>(null);

  useEffect(() => {
    loadNews();
  }, [id]);

  async function loadNews() {
    if (!id) return;

    setLoading(true);

    const { data, error } = await supabase
      .from('news')
      .select(`
        id,
        title,
        description,
        content,
        image_url,
        status
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.log('Eroare încărcare noutate:', error);
      Alert.alert(
        'Eroare',
        'Noutatea nu a putut fi încărcată.'
      );
      setLoading(false);
      return;
    }

    if (!data) {
      Alert.alert(
        'Noutate inexistentă',
        'Această noutate nu mai există.'
      );

      setLoading(false);
      return;
    }

    const item = data as NewsItem;

    setTitle(item.title);
    setDescription(item.description ?? '');
    setContent(item.content ?? '');
    setStatus(item.status);
    setCurrentImageUrl(item.image_url);

    setLoading(false);
  }

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
      setNewImageUri(result.assets[0].uri);
    }
  }

  function getStoragePathFromUrl(url: string) {
    const marker =
      '/storage/v1/object/public/news-images/';

    const index = url.indexOf(marker);

    if (index === -1) {
      return null;
    }

    return decodeURIComponent(
      url.substring(index + marker.length)
    );
  }

  async function uploadNewImage() {
    if (!newImageUri) {
      return currentImageUrl;
    }

    const response = await fetch(newImageUri);
    const arrayBuffer = await response.arrayBuffer();

    const extension =
      newImageUri.split('.').pop()?.toLowerCase() || 'jpg';

    const fileName =
      `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)}.${extension}`;

    const filePath = `news/${fileName}`;

    const { error } = await supabase.storage
      .from('news-images')
      .upload(filePath, arrayBuffer, {
        contentType:
          extension === 'png'
            ? 'image/png'
            : 'image/jpeg',
        upsert: false,
      });

    if (error) {
      throw error;
    }

    const { data } = supabase.storage
      .from('news-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function deleteImageFromStorage(
    imageUrl: string | null
  ) {
    if (!imageUrl) return;

    const path = getStoragePathFromUrl(imageUrl);

    if (!path) return;

    const { error } = await supabase.storage
      .from('news-images')
      .remove([path]);

    if (error) {
      console.log(
        'Eroare ștergere fotografie:',
        error
      );
    }
  }

  async function saveChanges() {
    if (!title.trim()) {
      Alert.alert(
        'Titlu necesar',
        'Introdu un titlu pentru noutate.'
      );
      return;
    }

    if (!id || saving) return;

    setSaving(true);

    let uploadedImageUrl: string | null = null;

    try {
      uploadedImageUrl = await uploadNewImage();

      const { error } = await supabase
        .from('news')
        .update({
          title: title.trim(),
          description: description.trim() || null,
          content: content.trim() || null,
          image_url: uploadedImageUrl,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        throw error;
      }

      // Dacă fotografia a fost schimbată,
      // ștergem fotografia veche.
      if (
        newImageUri &&
        currentImageUrl &&
        uploadedImageUrl !== currentImageUrl
      ) {
        await deleteImageFromStorage(currentImageUrl);
      }

      setCurrentImageUrl(uploadedImageUrl);
      setNewImageUri(null);

      showSaveSuccess();
      router.back();
    } catch (error) {
      console.log(
        'Eroare salvare noutate:',
        error
      );

      Alert.alert(
        'Eroare',
        'Modificările nu au putut fi salvate.'
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Șterge noutatea',
      'Ești sigur că vrei să ștergi această noutate? Această acțiune nu poate fi anulată.',
      [
        {
          text: 'Anulează',
          style: 'cancel',
        },
        {
          text: 'Șterge',
          style: 'destructive',
          onPress: deleteNews,
        },
      ]
    );
  }

  async function deleteNews() {
    if (!id || deleting) return;

    setDeleting(true);

    const imageToDelete = currentImageUrl;

    try {
      const { error } = await supabase
        .from('news')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      await deleteImageFromStorage(imageToDelete);

      // Revenim la lista deja existenta, fara sa adaugam o alta pagina in istoric.
      router.back();
    } catch (error) {
      console.log(
        'Eroare ștergere noutate:',
        error
      );

      Alert.alert(
        'Eroare',
        'Noutatea nu a putut fi ștearsă.'
      );

      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={RED} />
        <Text style={styles.loadingText}>
          Se încarcă noutatea...
        </Text>
      </SafeAreaView>
    );
  }

  const displayedImage =
    newImageUri || currentImageUrl;

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
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Înapoi">
            <Ionicons name="arrow-back" size={22} color={DARK} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.eyebrow}>ADMINISTRARE NOUTĂȚI</Text>
            <Text style={styles.headerTitle}>Editează noutatea</Text>
          </View>
        </View>

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
            onPress={pickImage}
            activeOpacity={0.8}
          >
            {displayedImage ? (
              <>
                <Image
                  source={{ uri: displayedImage }}
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

          <Text style={styles.sectionLabel}>DETALII NOUTATE</Text>
          <View style={styles.formCard}>
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

          </View>
          <Text style={styles.sectionLabel}>VIZIBILITATE</Text>

          <View style={styles.statusCard}><View style={styles.statusRow}>
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

          </View>
          <TouchableOpacity
            style={[
              styles.saveButton,
              saving && styles.disabledButton,
            ]}
            onPress={saveChanges}
            disabled={saving || deleting}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name="save-outline"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.saveText}>
                  Salvează modificările
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={confirmDelete}
            disabled={saving || deleting}
          >
            {deleting ? (
              <ActivityIndicator color={RED} />
            ) : (
              <>
                <Ionicons
                  name="trash-outline"
                  size={19}
                  color={RED}
                />
                <Text style={styles.deleteText}>
                  Șterge noutatea
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

  center: {
    flex: 1,
    backgroundColor: BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: 10,
    color: '#777777',
    fontSize: 11,
  },

  header: {
    ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
    paddingHorizontal: 15, paddingTop: 12, paddingBottom: 15,
    flexDirection: 'row', alignItems: 'center',
  },
  backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  headerContent: { flex: 1, marginLeft: 13 },
  eyebrow: { color: RED, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  headerTitle: { color: DARK, fontSize: 24, fontWeight: '900', marginTop: 1 },
  sectionLabel: { color: '#999999', fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginTop: 18, marginBottom: 9, marginLeft: 5 },
  formCard: { backgroundColor: '#FFFFFF', borderRadius: 19, padding: 15 },
  statusCard: { backgroundColor: '#FFFFFF', borderRadius: 19, padding: 8 },

  content: { ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
    padding: 15,
    paddingBottom: 50,
  },

  label: {
    color: DARK,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 9,
    marginBottom: 7,
    marginLeft: 3,
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

  input: {
    minHeight: 50,
    backgroundColor: '#F7F7F7',
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: DARK,
    fontSize: 12,
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

  saveButton: {
    minHeight: 55,
    borderRadius: 16,
    backgroundColor: RED,
    marginTop: 25,
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

  deleteButton: {
    minHeight: 52,
    borderRadius: 16,
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1CCCC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },

  deleteText: {
    color: RED,
    fontSize: 12,
    fontWeight: '900',
  },
});