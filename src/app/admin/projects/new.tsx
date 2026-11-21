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

export default function NewProjectScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [impact, setImpact] = useState('');
  const [urgentNeeds, setUrgentNeeds] = useState('');
  const [howToHelp, setHowToHelp] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  const [status, setStatus] =
    useState<'active' | 'seasonal' | 'permanent' | 'planned' | 'draft'>(
      'active'
    );

  const [imageUri, setImageUri] =
    useState<string | null>(null);

  const [galleryImageUris, setGalleryImageUris] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

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
      setImageUri(result.assets[0].uri);
    }
  }

  async function pickGalleryImages() {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Permisiune necesară',
        'Permite accesul la fotografii pentru a putea selecta imaginile galeriei.'
      );
      return;
    }

    const result =
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 0,
        quality: 0.8,
      });

    if (!result.canceled) {
      const selected =
        result.assets.map((asset) => asset.uri);

      setGalleryImageUris((current) =>
        Array.from(new Set([...current, ...selected]))
      );
    }
  }

  function removeGalleryImage(index: number) {
    setGalleryImageUris((current) =>
      current.filter((_, i) => i !== index)
    );
  }

  async function uploadGalleryImage(
    uri: string,
    projectId: string,
    order: number
  ) {
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const extension =
      uri.toLowerCase().includes('.png') ? 'png' : 'jpg';

    const filePath =
      `projects/${projectId}/gallery/${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${extension}`;

    const { error: uploadError } =
      await supabase.storage
        .from('project-images')
        .upload(filePath, arrayBuffer, {
          contentType:
            extension === 'png'
              ? 'image/png'
              : 'image/jpeg',
          upsert: false,
        });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('project-images')
      .getPublicUrl(filePath);

    const { error: insertError } =
      await supabase
        .from('project_images')
        .insert({
          project_id: projectId,
          image_url: data.publicUrl,
          display_order: order,
        });

    if (insertError) {
      await supabase.storage
        .from('project-images')
        .remove([filePath]);
      throw insertError;
    }
  }

  async function uploadProjectImage() {
    if (!imageUri) return null;

    const response = await fetch(imageUri);
    const arrayBuffer = await response.arrayBuffer();

    const fileExtension =
      imageUri.split('.').pop()?.toLowerCase() ||
      'jpg';

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
        'Eroare upload imagine proiect:',
        error
      );

      throw error;
    }

    const { data } = supabase.storage
      .from('project-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
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
        'Introdu o descriere scurtă a proiectului.'
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
      setLoading(true);

      const imageUrl =
        await uploadProjectImage();

      const { data: createdProject, error } =
        await supabase
          .from('projects')
          .insert({
            title: title.trim(),
            description: description.trim(),
            content: content.trim(),
            impact: impact.trim() || null,
            urgent_needs: urgentNeeds.trim() || null,
            how_to_help: howToHelp.trim() || null,
          video_url: videoUrl.trim() || null,
            image_url: imageUrl,
            status,
          })
          .select('id')
          .single();

      if (error || !createdProject) {
        console.log(
          'Eroare creare proiect:',
          error
        );

        Alert.alert(
          'Eroare',
          'Proiectul nu a putut fi creat.'
        );

        return;
      }

      for (let i = 0; i < galleryImageUris.length; i += 1) {
        await uploadGalleryImage(
          galleryImageUris[i],
          createdProject.id,
          i
        );
      }

      // Creează o notificare doar pentru proiectele publice.
      if (status !== 'draft') {
        const { data: notification, error: notificationError } =
          await supabase
            .from('notifications')
            .insert({
              title: 'Proiect nou: ' + title.trim(),
              message: 'Descoperă noul proiect al Misiunii Bucovina.',
              status: 'published',
              target_type: 'project',
              target_id: createdProject.id,
              updated_at: new Date().toISOString(),
            })
            .select('id')
            .single();

        if (notificationError) {
          console.log('Eroare creare notificare proiect:', notificationError);
        } else if (notification?.id) {
          const { data: pushResult, error: pushError } =
            await supabase.functions.invoke('send-push-notification', {
              body: { notification_id: notification.id },
            });

          if (pushError || pushResult?.success === false) {
            console.log('Eroare push proiect:', pushError ?? pushResult);
          }
        }
      }

      showSaveSuccess();

router.back();

    } catch (error) {
      console.log(error);

      Alert.alert(
        'Eroare',
        'A apărut o problemă la crearea proiectului.'
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
            Proiect nou
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.sectionLabel}>
          FOTOGRAFIE
        </Text>

        <TouchableOpacity
          style={styles.imagePicker}
          activeOpacity={0.85}
          onPress={pickImage}
        >
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
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
                Alege imaginea principală
              </Text>

              <Text style={styles.imageText}>
                Aceasta va fi coperta proiectului
              </Text>
            </>
          )}

          {imageUri ? (
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
          ) : null}
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
            onPress={pickGalleryImages}
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

          {galleryImageUris.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.galleryRow}
            >
              {galleryImageUris.map((uri, index) => (
                <View
                  key={`${uri}-${index}`}
                  style={styles.galleryImageWrapper}
                >
                  <Image
                    source={{ uri }}
                    style={styles.galleryImage}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.removeGalleryImage}
                    onPress={() => removeGalleryImage(index)}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color="#FFFFFF"
                    />
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
            placeholderTextColor="#AAAAAA"
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
            placeholder="O scurtă descriere..."
            placeholderTextColor="#AAAAAA"
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
            style={[
              styles.input,
              styles.sectionInput,
            ]}
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
            style={[
              styles.input,
              styles.sectionInput,
            ]}
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
            style={[
              styles.input,
              styles.sectionInput,
            ]}
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
            onPress={() => setStatus('active')}
          />

          <StatusButton
            title="Sezonier"
            icon="calendar-outline"
            selected={status === 'seasonal'}
            onPress={() => setStatus('seasonal')}
          />

          <StatusButton
            title="Permanent"
            icon="infinite-outline"
            selected={status === 'permanent'}
            onPress={() => setStatus('permanent')}
          />

          <StatusButton
            title="În perspectivă"
            icon="time-outline"
            selected={status === 'planned'}
            onPress={() => setStatus('planned')}
          />

          <StatusButton
            title="Draft"
            icon="document-outline"
            selected={status === 'draft'}
            onPress={() => setStatus('draft')}
          />
        </View>

        <TouchableOpacity
          style={styles.saveButton}
          activeOpacity={0.85}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons
                name="add-circle-outline"
                size={20}
                color="#FFFFFF"
              />

              <Text style={styles.saveButtonText}>
                Creează proiectul
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
        selected && styles.statusButtonSelected,
      ]}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={22}
        color={selected ? RED : '#777777'}
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

  imageText: {
    color: '#888888',
    fontSize: 10,
    marginTop: 4,
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
});