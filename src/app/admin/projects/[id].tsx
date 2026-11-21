import { showSaveSuccess } from '../../../lib/save-feedback';
import { Alert } from '../../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

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

type ProjectStatus =
  | 'active'
  | 'seasonal'
  | 'permanent'
  | 'planned'
  | 'draft';

type ProjectImage = {
  id: string;
  project_id: string;
  image_url: string;
  display_order: number;
};

type Project = {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  impact: string | null;
  urgent_needs: string | null;
  how_to_help: string | null;
  video_url: string | null;
  image_url: string | null;
  status: ProjectStatus;
};

export default function EditProjectScreen() {
  const { id } = useLocalSearchParams<{
    id: string;
  }>();

  const [projectData, setProjectData] =
    useState<Project | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] =
    useState('');
  const [content, setContent] = useState('');
  const [impact, setImpact] = useState('');
  const [urgentNeeds, setUrgentNeeds] = useState('');
  const [howToHelp, setHowToHelp] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  const [status, setStatus] =
    useState<ProjectStatus>('active');

  const [imageUrl, setImageUrl] =
    useState<string | null>(null);

  const [newImageUri, setNewImageUri] =
    useState<string | null>(null);

  const [galleryImages, setGalleryImages] =
    useState<ProjectImage[]>([]);
  const [uploadingGallery, setUploadingGallery] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  useEffect(() => {
    loadProject();
  }, [id]);

  async function loadProject() {
    if (!id) return;

    setLoading(true);

    const { data, error } = await supabase
      .from('projects')
      .select(
        'id, title, description, content, impact, urgent_needs, how_to_help, video_url, image_url, status'
      )
      .eq('id', id)
      .single();

    if (error || !data) {
      console.log(
        'Eroare încărcare proiect:',
        error
      );

      Alert.alert(
        'Eroare',
        'Proiectul nu a putut fi încărcat.',
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

    const project = data as Project;

    setProjectData(project);
    setTitle(project.title);
    setDescription(project.description ?? '');
    setContent(project.content ?? '');
    setImpact(project.impact ?? '');
    setUrgentNeeds(project.urgent_needs ?? '');
    setHowToHelp(project.how_to_help ?? '');
    setVideoUrl(project.video_url ?? '');
    setStatus(project.status);
    setImageUrl(project.image_url);
    await loadGalleryImages();

    setLoading(false);
  }

  async function pickImage() {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Permisiune necesară',
        'Permite accesul la fotografii pentru a putea selecta imaginea proiectului.'
      );

      return;
    }

    const result =
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

    if (!result.canceled) {
      setNewImageUri(result.assets[0].uri);
    }
  }

  async function uploadNewImage() {
    if (!newImageUri) {
      return imageUrl;
    }

    const response = await fetch(newImageUri);
    const arrayBuffer =
      await response.arrayBuffer();

    const fileExtension =
      newImageUri
        .split('.')
        .pop()
        ?.toLowerCase() || 'jpg';

    const fileName =
      `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${fileExtension}`;

    const filePath = `projects/${fileName}`;

    const { error } = await supabase.storage
      .from('project-images')
      .upload(filePath, arrayBuffer, {
        contentType:
          fileExtension === 'png'
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
      .from('project-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function deleteImageFromStorage(
    url: string | null
  ) {
    if (!url) return;

    try {
      const pathPart =
        url.split('/project-images/')[1];

      if (!pathPart) return;

      const decodedPath =
        decodeURIComponent(pathPart);

      const { error } = await supabase.storage
        .from('project-images')
        .remove([decodedPath]);

      if (error) {
        console.log(
          'Eroare ștergere fotografie:',
          error
        );
      }
    } catch (error) {
      console.log(
        'Eroare procesare fotografie:',
        error
      );
    }
  }


  async function loadGalleryImages() {
    if (!id) return;
    const { data, error } = await supabase
      .from('project_images')
      .select('id, project_id, image_url, display_order')
      .eq('project_id', id)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.log('Eroare încărcare galerie:', error);
      return;
    }
    setGalleryImages((data ?? []) as ProjectImage[]);
  }

  async function addGalleryImages() {
    if (!id || uploadingGallery) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permisiune necesară', 'Permite accesul la fotografii pentru a putea adăuga imagini în galerie.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 0,
      quality: 0.8,
    });

    if (result.canceled || result.assets.length === 0) return;

    try {
      setUploadingGallery(true);
      let nextOrder = galleryImages.length
        ? Math.max(...galleryImages.map((image) => image.display_order)) + 1
        : 0;

      for (const asset of result.assets) {
        const optimizedImage =
          await ImageManipulator.manipulateAsync(
            asset.uri,
            [
              {
                resize:
                  asset.width >= asset.height
                    ? { width: 1600 }
                    : { height: 1600 },
              },
            ],
            {
              compress: 0.72,
              format: ImageManipulator.SaveFormat.JPEG,
            }
          );

        const response = await fetch(optimizedImage.uri);
        const arrayBuffer = await response.arrayBuffer();
        const ext = 'jpg';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
        const filePath = `projects/${id}/gallery/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('project-images')
          .upload(filePath, arrayBuffer, {
            contentType: 'image/jpeg',
            upsert: false,
          });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('project-images')
          .getPublicUrl(filePath);

        const { error: insertError } = await supabase
          .from('project_images')
          .insert({
            project_id: id,
            image_url: urlData.publicUrl,
            display_order: nextOrder,
          });

        if (insertError) {
          await supabase.storage.from('project-images').remove([filePath]);
          throw insertError;
        }
        nextOrder += 1;
      }

      await loadGalleryImages();
      Alert.alert('Fotografii adăugate', 'Fotografiile au fost adăugate în galeria proiectului.');
    } catch (error) {
      console.log('Eroare adăugare galerie:', error);
      Alert.alert('Eroare', 'Fotografiile nu au putut fi adăugate în galerie.');
    } finally {
      setUploadingGallery(false);
    }
  }

  function confirmDeleteGalleryImage(image: ProjectImage) {
    Alert.alert('Șterge fotografia', 'Sigur vrei să ștergi această fotografie din galerie?', [
      { text: 'Anulează', style: 'cancel' },
      { text: 'Șterge', style: 'destructive', onPress: () => deleteGalleryImage(image) },
    ]);
  }

  async function deleteGalleryImage(image: ProjectImage) {
    try {
      const { error } = await supabase
        .from('project_images')
        .delete()
        .eq('id', image.id);
      if (error) throw error;

      await deleteImageFromStorage(image.image_url);
      setGalleryImages((current) => current.filter((item) => item.id !== image.id));
    } catch (error) {
      console.log('Eroare ștergere imagine galerie:', error);
      Alert.alert('Eroare', 'Fotografia nu a putut fi ștearsă.');
    }
  }

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert(
        'Titlu obligatoriu',
        'Introdu titlul proiectului.'
      );

      return;
    }

    if (!description.trim()) {
      Alert.alert(
        'Descriere obligatorie',
        'Introdu descrierea proiectului.'
      );

      return;
    }

    if (!content.trim()) {
      Alert.alert(
        'Conținut obligatoriu',
        'Introdu informațiile despre proiect.'
      );

      return;
    }

    try {
      setSaving(true);

      const finalImageUrl =
        await uploadNewImage();

      const { error } = await supabase
        .from('projects')
        .update({
          title: title.trim(),
          description: description.trim(),
          content: content.trim(),
          impact: impact.trim() || null,
          urgent_needs: urgentNeeds.trim() || null,
          how_to_help: howToHelp.trim() || null,
          video_url: videoUrl.trim() || null,
          image_url: finalImageUrl,
          status,
          updated_at:
            new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        console.log(
          'Eroare actualizare proiect:',
          error
        );

        Alert.alert(
          'Eroare',
          'Proiectul nu a putut fi actualizat.'
        );

        return;
      }

      // Trimitem notificarea numai la prima publicare din Draft.
      // Statusurile active, seasonal, permanent și planned sunt publice.
      if (projectData?.status === 'draft' && status !== 'draft' && id) {
        try {
          const { data: existingNotification, error: lookupError } =
            await supabase
              .from('notifications')
              .select('id')
              .eq('target_type', 'project')
              .eq('target_id', id)
              .eq('status', 'published')
              .limit(1)
              .maybeSingle();

          if (lookupError) {
            console.log('Eroare verificare notificare proiect:', lookupError);
          } else if (!existingNotification) {
            const { data: notification, error: notificationError } =
              await supabase
                .from('notifications')
                .insert({
                  title: 'Proiect nou: ' + title.trim(),
                  message: 'Descoperă noul proiect al Misiunii Bucovina.',
                  status: 'published',
                  target_type: 'project',
                  target_id: id,
                  updated_at: new Date().toISOString(),
                })
                .select('id')
                .single();

            if (notificationError) {
              console.log('Eroare notificare proiect:', notificationError);
            } else if (notification?.id) {
              const { error: pushError } =
                await supabase.functions.invoke('send-push-notification', {
                  body: { notification_id: notification.id },
                });
              if (pushError) {
                console.log('Eroare push proiect:', pushError);
              }
            }
          }
        } catch (notificationError) {
          // O eroare la notificări nu anulează proiectul deja salvat.
          console.log('Eroare neașteptată notificare proiect:', notificationError);
        }
      }

      setProjectData((previous) =>
        previous ? { ...previous, status, title: title.trim(), image_url: finalImageUrl } : previous
      );
      setImageUrl(finalImageUrl);
      setNewImageUri(null);

      if (
        newImageUri &&
        projectData?.image_url &&
        projectData.image_url !==
          finalImageUrl
      ) {
        await deleteImageFromStorage(
          projectData.image_url
        );
      }

     showSaveSuccess();
router.back();
    } catch (error) {
      console.log(error);

      Alert.alert(
        'Eroare',
        'A apărut o problemă la salvarea proiectului.'
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Șterge proiectul',
      'Sigur vrei să ștergi acest proiect? Această acțiune nu poate fi anulată.',
      [
        {
          text: 'Anulează',
          style: 'cancel',
        },
        {
          text: 'Șterge',
          style: 'destructive',
          onPress: deleteProject,
        },
      ]
    );
  }

  async function deleteProject() {
    try {
      setSaving(true);

      const oldImage =
        projectData?.image_url ?? null;

      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) {
        console.log(
          'Eroare ștergere proiect:',
          error
        );

        Alert.alert(
          'Eroare',
          'Proiectul nu a putut fi șters.'
        );

        return;
      }

      if (oldImage) {
        await deleteImageFromStorage(
          oldImage
        );
      }

      Alert.alert(
  'Proiect șters',
  'Proiectul a fost șters.',
  [
    {
      text: 'OK',
      onPress: () => router.back(),
    },
  ]
);
    } catch (error) {
      console.log(error);

      Alert.alert(
        'Eroare',
        'A apărut o problemă la ștergerea proiectului.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView
        style={styles.loadingScreen}
      >
        <ActivityIndicator
          size="large"
          color={RED}
        />

        <Text style={styles.loadingText}>
          Se încarcă proiectul...
        </Text>
      </SafeAreaView>
    );
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

          <Text style={styles.headerTitle}>
            Editează proiect
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          styles.contentContainer
        }
      >
        <Text style={styles.sectionLabel}>
          FOTOGRAFIE
        </Text>

        <TouchableOpacity
          style={styles.imagePicker}
          onPress={pickImage}
          activeOpacity={0.85}
        >
          {newImageUri || imageUrl ? (
            <Image
              source={{
                uri:
                  newImageUri ??
                  imageUrl ??
                  '',
              }}
              style={styles.projectImage}
              resizeMode="cover"
            />
          ) : (
            <>
              <Ionicons
                name="image-outline"
                size={38}
                color={RED}
              />

              <Text style={styles.imageTitle}>
                Adaugă fotografie
              </Text>
            </>
          )}

          <View style={styles.changeImage}>
            <Ionicons
              name="camera-outline"
              size={17}
              color="#FFFFFF"
            />

            <Text
              style={
                styles.changeImageText
              }
            >
              Schimbă
            </Text>
          </View>
        </TouchableOpacity>


        <Text style={styles.sectionLabel}>
          GALERIE FOTO
        </Text>

        <View style={styles.galleryCard}>
          <Text style={styles.galleryHelp}>
            Adaugă fotografiile care vor apărea în caruselul proiectului.
          </Text>

          <TouchableOpacity
            style={styles.addGalleryButton}
            onPress={addGalleryImages}
            disabled={uploadingGallery}
          >
            {uploadingGallery ? (
              <ActivityIndicator color={RED} />
            ) : (
              <>
                <Ionicons name="images-outline" size={20} color={RED} />
                <Text style={styles.addGalleryButtonText}>Adaugă fotografii</Text>
              </>
            )}
          </TouchableOpacity>

          {galleryImages.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.galleryRow}
            >
              {galleryImages.map((image) => (
                <View key={image.id} style={styles.galleryImageWrapper}>
                  <Image source={{ uri: image.image_url }} style={styles.galleryImage} resizeMode="cover" />
                  <TouchableOpacity
                    style={styles.removeGalleryImage}
                    onPress={() => confirmDeleteGalleryImage(image)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
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
            placeholder="Titlul proiectului"
          />

          <Text style={styles.label}>
            Descriere scurtă
          </Text>

          <TextInput
            style={[
              styles.input,
              styles.descriptionInput,
            ]}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>
            Despre proiect
          </Text>

          <TextInput
            style={[
              styles.input,
              styles.contentInput,
            ]}
            value={content}
            onChangeText={setContent}
            placeholder="Scrie informațiile complete despre proiect..."
            placeholderTextColor="#AAAAAA"
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>
            Impactul proiectului
          </Text>

          <TextInput
            style={[styles.input, styles.sectionInput]}
            value={impact}
            onChangeText={setImpact}
            placeholder="Descrie impactul proiectului..."
            placeholderTextColor="#AAAAAA"
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>
            Urgențele proiectului
          </Text>

          <TextInput
            style={[styles.input, styles.sectionInput]}
            value={urgentNeeds}
            onChangeText={setUrgentNeeds}
            placeholder="Scrie nevoile sau urgențele proiectului..."
            placeholderTextColor="#AAAAAA"
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>
            Cum te poți implica
          </Text>

          <TextInput
            style={[styles.input, styles.sectionInput]}
            value={howToHelp}
            onChangeText={setHowToHelp}
            placeholder="Descrie modalitățile prin care oamenii se pot implica..."
            placeholderTextColor="#AAAAAA"
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>Link video YouTube / Shorts</Text>
          <TextInput
            style={styles.input}
            value={videoUrl}
            onChangeText={setVideoUrl}
            placeholder="https://www.youtube.com/watch?v=..."
            placeholderTextColor="#AAAAAA"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
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
            title="Sezonier"
            icon="calendar-outline"
            selected={status === 'seasonal'}
            onPress={() =>
              setStatus('seasonal')
            }
          />

          <StatusButton
            title="Permanent"
            icon="infinite-outline"
            selected={status === 'permanent'}
            onPress={() =>
              setStatus('permanent')
            }
          />

          <StatusButton
            title="În perspectivă"
            icon="time-outline"
            selected={status === 'planned'}
            onPress={() =>
              setStatus('planned')
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
          style={styles.saveButton}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator
              color="#FFFFFF"
            />
          ) : (
            <>
              <Ionicons
                name="save-outline"
                size={20}
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.saveButtonText
                }
              >
                Salvează modificările
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={confirmDelete}
          disabled={saving}
        >
          <Ionicons
            name="trash-outline"
            size={19}
            color={RED}
          />

          <Text style={styles.deleteText}>
            Șterge proiectul
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

type StatusButtonProps = {
  title: string;
  icon:
    | 'checkmark-circle-outline'
    | 'calendar-outline'
    | 'infinite-outline'
    | 'time-outline'
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

  headerText: {
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

  contentContainer: { ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
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

  imagePicker: {
    height: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },

  projectImage: {
    width: '100%',
    height: '100%',
  },

  imageTitle: {
    color: DARK,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 10,
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

  descriptionInput: {
    minHeight: 90,
    paddingTop: 13,
    paddingBottom: 13,
  },

  contentInput: {
    minHeight: 180,
    paddingTop: 13,
    paddingBottom: 13,
  },

  sectionInput: {
    minHeight: 130,
    paddingTop: 13,
    paddingBottom: 13,
  },

  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  statusButton: {
    width: '31%',
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

  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  deleteButton: {
    minHeight: 53,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginTop: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: '#F1D6D6',
  },

  deleteText: {
    color: RED,
    fontSize: 11,
    fontWeight: '900',
  },
});