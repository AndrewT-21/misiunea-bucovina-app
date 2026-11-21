import { showSaveSuccess } from '../../../lib/save-feedback';
import { Alert } from '../../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';

import { Platform, ActivityIndicator,
  
  Image,
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

type CaseStatus = 'active' | 'draft';

export default function NewCaseScreen() {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [story, setStory] = useState('');
  const [urgentNeed, setUrgentNeed] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [caseYear, setCaseYear] = useState('');
  const [status, setStatus] = useState<CaseStatus>('active');
  const [coverImageUri, setCoverImageUri] = useState<string | null>(null);
  const [carouselImageUris, setCarouselImageUris] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function requestPhotoPermission() {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Permisiune necesară',
        'Permite accesul la fotografii pentru a putea selecta imaginile cazului.'
      );
      return false;
    }

    return true;
  }

  async function pickCoverImage() {
    const allowed =
      await requestPhotoPermission();

    if (!allowed) return;

    const result =
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

    if (!result.canceled) {
      setCoverImageUri(
        result.assets[0].uri
      );
    }
  }

  async function pickCarouselImages() {
    const allowed =
      await requestPhotoPermission();

    if (!allowed) return;

    const result =
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 0,
        quality: 0.8,
      });

    if (!result.canceled) {
      const selected =
        result.assets.map(
          (asset) => asset.uri
        );

      setCarouselImageUris(
        (current) =>
          Array.from(
            new Set([
              ...current,
              ...selected,
            ])
          )
      );
    }
  }

  function removeCarouselImage(
    index: number
  ) {
    setCarouselImageUris(
      (current) =>
        current.filter(
          (_, i) => i !== index
        )
    );
  }

  async function uploadImage(
    uri: string,
    folder: string
  ) {
    const response = await fetch(uri);
    const arrayBuffer =
      await response.arrayBuffer();

    const extension =
      uri.toLowerCase().includes('.png')
        ? 'png'
        : 'jpg';

    const filePath =
      `${folder}/${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${extension}`;

    const { error } = await supabase.storage
      .from('case-images')
      .upload(filePath, arrayBuffer, {
        contentType:
          extension === 'png'
            ? 'image/png'
            : 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.log(
        'Eroare upload imagine:',
        error
      );
      throw error;
    }

    const { data } = supabase.storage
      .from('case-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert(
        'Titlu obligatoriu',
        'Introdu titlul cazului.'
      );
      return;
    }

    if (!story.trim()) {
      Alert.alert(
        'Poveste obligatorie',
        'Introdu povestea cazului.'
      );
      return;
    }

    const cleanCaseYear = caseYear.trim();

    if (cleanCaseYear) {
      const caseYearNumber = Number(cleanCaseYear);

      if (
        !Number.isInteger(caseYearNumber) ||
        caseYearNumber < 2000 ||
        caseYearNumber > 2100
      ) {
        Alert.alert(
          'An caz invalid',
          'Introdu un an valid între 2000 și 2100.'
        );
        return;
      }
    }

    try {
      setLoading(true);

      let coverUrl: string | null = null;

      if (coverImageUri) {
        coverUrl = await uploadImage(
          coverImageUri,
          'cases'
        );
      }

      const {
        data: createdCase,
        error,
      } = await supabase
        .from('cases')
        .insert({
          title: title.trim(),
          location:
            location.trim() || null,
          story: story.trim(),
          urgent_need:
            urgentNeed.trim() || null,
          video_url:
            videoUrl.trim() || null,
          report_year:
            cleanCaseYear ? Number(cleanCaseYear) : null,
          status,
          image_url: coverUrl,
        })
        .select('id')
        .single();

      if (error || !createdCase) {
        console.log(error);
        Alert.alert(
          'Eroare',
          'Cazul nu a putut fi salvat.'
        );
        return;
      }

      if (carouselImageUris.length > 0) {
        const galleryRows = [];

        for (
          let i = 0;
          i < carouselImageUris.length;
          i += 1
        ) {
          const url = await uploadImage(
            carouselImageUris[i],
            `cases/${createdCase.id}/gallery`
          );

          galleryRows.push({
            case_id: createdCase.id,
            image_url: url,
            display_order: i,
          });
        }

        const { error: galleryError } =
          await supabase
            .from('case_images')
            .insert(galleryRows);

        if (galleryError) {
          console.log(
            'Eroare galerie:',
            galleryError
          );

          Alert.alert(
            'Caz salvat',
            'Cazul a fost salvat, dar galeria nu a putut fi salvată complet.'
          );

          router.back();
          return;
        }
      }

      if (status === 'active') {
  const { data: notification, error: notificationError } =
    await supabase
      .from('notifications')
      .insert({
        title: 'Caz nou: ' + title.trim(),
        message: 'Descoperă noul caz publicat de Misiunea Bucovina.',
        status: 'published',
        target_type: 'case',
        target_id: createdCase.id,
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

  if (notificationError) {
    console.log(
      'Eroare creare notificare pentru caz:',
      notificationError
    );
  } else if (notification?.id) {
    const { error: pushError } =
      await supabase.functions.invoke(
        'send-push-notification',
        {
          body: {
            notification_id: notification.id,
          },
        }
      );

    if (pushError) {
      console.log(
        'Eroare push pentru caz:',
        pushError
      );
    }
  }
}

      showSaveSuccess();

      router.back();
    } catch (error) {
      console.log(error);

      Alert.alert(
        'Eroare',
        'A apărut o problemă la crearea cazului.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView
      style={styles.screen}
      edges={['top']}
    >
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

        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>
            ADMINISTRARE
          </Text>

          <Text style={styles.title}>
            Caz nou
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Text style={styles.sectionLabel}>
          FOTOGRAFIE
        </Text>

        <TouchableOpacity
          style={styles.singleImagePicker}
          activeOpacity={0.85}
          onPress={pickCoverImage}
        >
          {coverImageUri ? (
            <>
              <Image
                source={{ uri: coverImageUri }}
                style={styles.coverImage}
                resizeMode="cover"
              />

              <View style={styles.changeImage}>
                <Ionicons
                  name="camera-outline"
                  size={17}
                  color="#FFFFFF"
                />
                <Text style={styles.changeImageText}>
                  Schimbă
                </Text>
              </View>
            </>
          ) : (
            <>
              <Ionicons
                name="image-outline"
                size={38}
                color={RED}
              />
              <Text style={styles.imageTitle}>
                Alege imaginea principală
              </Text>
              <Text style={styles.imageText}>
                Aceasta va fi coperta cazului
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>
          GALERIE FOTO
        </Text>

        <View style={styles.galleryCard}>
          <Text style={styles.galleryHelp}>
            Adaugă fotografiile care vor apărea în caruselul cazului.
          </Text>

          <TouchableOpacity
            style={styles.addGalleryButton}
            onPress={pickCarouselImages}
            activeOpacity={0.85}
          >
            <Ionicons
              name="images-outline"
              size={20}
              color={RED}
            />
            <Text style={styles.addGalleryButtonText}>
              Adaugă fotografii
            </Text>
          </TouchableOpacity>

          {carouselImageUris.length > 0 ? (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={
                  styles.galleryRow
                }
              >
                {carouselImageUris.map(
                  (uri, index) => (
                    <View
                      key={`${uri}-${index}`}
                      style={styles.galleryImageWrapper}
                    >
                      <Image
                        source={{ uri }}
                        style={styles.galleryImage}
                      />

                      <TouchableOpacity
                        style={
                          styles.removeGalleryImage
                        }
                        onPress={() =>
                          removeCarouselImage(
                            index
                          )
                        }
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color="#FFFFFF"
                        />
                      </TouchableOpacity>
                    </View>
                  )
                )}
              </ScrollView>

            </>
          ) : null}
        </View>

        <Text style={styles.sectionLabel}>
          INFORMAȚII
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>
            Titlu
          </Text>

          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Titlul cazului"
            placeholderTextColor="#AAAAAA"
          />

          <Text style={styles.label}>
            Locație
          </Text>

          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="Ex: Suceava, România"
            placeholderTextColor="#AAAAAA"
          />

          <Text style={styles.label}>
            An caz
          </Text>

          <TextInput
            style={styles.input}
            value={caseYear}
            onChangeText={setCaseYear}
            placeholder="Ex: 2026"
            placeholderTextColor="#AAAAAA"
            keyboardType="number-pad"
            maxLength={4}
          />

          <Text style={styles.adminHint}>
            Folosit doar în administrare pentru rapoartele anuale. Nu este afișat public.
          </Text>

          <Text style={styles.label}>
            Povestea cazului
          </Text>

          <TextInput
            style={[
              styles.input,
              styles.storyInput,
            ]}
            value={story}
            onChangeText={setStory}
            placeholder="Scrie povestea completă a cazului..."
            placeholderTextColor="#AAAAAA"
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>
            Nevoia urgentă
          </Text>

          <TextInput
            style={[
              styles.input,
              styles.urgentInput,
            ]}
            value={urgentNeed}
            onChangeText={setUrgentNeed}
            placeholder="Ex: Alimente, lemne de foc, renovarea locuinței..."
            placeholderTextColor="#AAAAAA"
            multiline
            textAlignVertical="top"
          />
        </View>

        <Text style={styles.sectionLabel}>
          VIDEO
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>
            Link videoclip (opțional)
          </Text>

          <TextInput
            style={[
              styles.input,
              styles.videoInput,
            ]}
            value={videoUrl}
            onChangeText={setVideoUrl}
            placeholder="Ex: https://www.youtube.com/watch?v=..."
            placeholderTextColor="#AAAAAA"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.videoInfo}>
            <Ionicons
              name="videocam-outline"
              size={18}
              color={RED}
            />

            <Text style={styles.videoInfoText}>
              Videoclipul este opțional. Dacă
              nu adaugi un link, secțiunea
              video nu va apărea în cazul
              public.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>
          STATUS
        </Text>

        <View style={styles.statusRow}>
          <StatusButton
            title="Activ"
            icon="checkmark-circle-outline"
            selected={status === 'active'}
            onPress={() =>
              setStatus('active')
            }
          />

          <StatusButton
            title="Draft"
            icon="document-outline"
            selected={status === 'draft'}
            onPress={() =>
              setStatus('draft')
            }
          />
        </View>

        <TouchableOpacity
          style={[
            styles.saveButton,
            loading &&
              styles.saveButtonDisabled,
          ]}
          activeOpacity={0.85}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator
              color="#FFFFFF"
            />
          ) : (
            <>
              <Ionicons
                name="add-circle-outline"
                size={20}
                color="#FFFFFF"
              />

              <Text
                style={styles.saveButtonText}
              >
                Creează cazul
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

type StatusButtonProps = {
  title: string;
  icon:
    | 'checkmark-circle-outline'
    | 'document-outline';
  selected: boolean;
  onPress: () => void;
};

function StatusButton({
  title,
  icon,
  selected,
  onPress,
}: StatusButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.statusButton,
        selected &&
          styles.statusButtonSelected,
      ]}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={22}
        color={
          selected ? RED : '#777777'
        }
      />

      <Text
        style={[
          styles.statusButtonText,
          selected &&
            styles.statusButtonTextSelected,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
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

  content: { ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
    padding: 15,
    paddingBottom: 45,
  },

  sectionLabel: {
    color: '#999999',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginLeft: 5,
    marginTop: 12,
    marginBottom: 9,
  },

  singleImagePicker: {
    height: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },

  coverImage: {
    width: '100%',
    height: '100%',
  },

  changeImage: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: RED,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  changeImageText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },

  imageTitle: {
    color: DARK,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 10,
  },

  imageText: {
    color: '#888888',
    fontSize: 10,
    marginTop: 4,
  },

  galleryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 15,
  },

  galleryHelp: {
    color: '#777777',
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 12,
  },

  addGalleryButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1D6D6',
    backgroundColor: '#FFF8F8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },

  addGalleryButtonText: {
    color: RED,
    fontSize: 11,
    fontWeight: '900',
  },

  galleryRow: {
    gap: 10,
    paddingTop: 14,
    paddingRight: 5,
  },

  galleryImageWrapper: {
    width: 125,
    height: 100,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F1F1F1',
  },

  galleryImage: {
    width: '100%',
    height: '100%',
  },

  removeGalleryImage: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(166,30,34,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },

  label: {
    color: DARK,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 7,
  },

  input: {
    minHeight: 49,
    backgroundColor: '#F7F7F7',
    borderRadius: 13,
    paddingHorizontal: 13,
    color: DARK,
    fontSize: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    marginBottom: 15,
  },

  adminHint: {
    color: '#999999',
    fontSize: 9,
    lineHeight: 14,
    marginTop: -8,
    marginBottom: 15,
  },

  storyInput: {
    minHeight: 180,
    paddingTop: 13,
    paddingBottom: 13,
  },

  urgentInput: {
    minHeight: 130,
    paddingTop: 13,
    paddingBottom: 13,
    marginBottom: 0,
  },

  videoInput: {
    marginBottom: 10,
  },

  videoInfo: {
    backgroundColor: '#FFF7F7',
    borderRadius: 13,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },

  videoInfoText: {
    flex: 1,
    color: '#777777',
    fontSize: 9,
    lineHeight: 14,
  },

  statusRow: {
    flexDirection: 'row',
    gap: 8,
  },

  statusButton: {
    flex: 1,
    minHeight: 75,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },

  statusButtonSelected: {
    borderColor: RED,
    backgroundColor: '#FFF8F8',
  },

  statusButtonText: {
    color: '#777777',
    fontSize: 9,
    fontWeight: '900',
    marginTop: 5,
  },

  statusButtonTextSelected: {
    color: RED,
  },

  saveButton: {
    minHeight: 55,
    backgroundColor: RED,
    borderRadius: 16,
    marginTop: 22,
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
