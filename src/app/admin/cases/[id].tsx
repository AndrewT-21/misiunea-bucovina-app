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

type Case = {
  id: string;
  title: string;
  story: string | null;
  location: string | null;
  urgent_need: string | null;
  video_url: string | null;
  status: 'active' | 'completed' | 'draft' | 'archived';
  image_url: string | null;
  report_year: number | null;
};

type CaseImage = { id: string; case_id: string; image_url: string; display_order: number; };

export default function EditCaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [caseData, setCaseData] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
const [location, setLocation] = useState('');
const [story, setStory] = useState('');
const [urgentNeed, setUrgentNeed] = useState('');
const [videoUrl, setVideoUrl] = useState('');
const [caseYear, setCaseYear] = useState('');
const [status, setStatus] =
  useState<'active' | 'completed' | 'draft' | 'archived'>('active');
  const [newImageUri, setNewImageUri] =
  useState<string | null>(null);
  const [galleryImages, setGalleryImages] = useState<CaseImage[]>([]);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  useEffect(() => {
    loadCase();
    loadGallery();
  }, [id]);

  async function loadCase() {
    if (!id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('cases')
      .select(
        'id, title, story, location, urgent_need, video_url, status, image_url, report_year'
      )
      .eq('id', id)
      .single();

    if (error) {
      console.log('Eroare încărcare caz:', error);
      setCaseData(null);
    } else {
  const loadedCase = data as Case;

  setCaseData(loadedCase);

  setTitle(loadedCase.title);
  setLocation(loadedCase.location || '');
  setStory(loadedCase.story || '');

  setUrgentNeed(loadedCase.urgent_need || '');
  setVideoUrl(loadedCase.video_url || '');
  setCaseYear(loadedCase.report_year ? String(loadedCase.report_year) : '');

  setStatus(loadedCase.status);
}

    setLoading(false);
  }

  async function loadGallery() {
    if (!id) return;
    const { data, error } = await supabase.from('case_images').select('id, case_id, image_url, display_order').eq('case_id', id).order('display_order', { ascending: true }).order('created_at', { ascending: true });
    if (error) console.log('Eroare încărcare galerie:', error); else setGalleryImages((data ?? []) as CaseImage[]);
  }

  async function addGalleryImages() {
    if (!id || uploadingGallery) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Permisiune necesară', 'Permite accesul la fotografii.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 1, selectionLimit: 0 });
    if (result.canceled || !result.assets.length) return;
    try { setUploadingGallery(true); let order = galleryImages.length ? Math.max(...galleryImages.map(x => x.display_order)) + 1 : 0;
      for (const asset of result.assets) {
        const optimized = await ImageManipulator.manipulateAsync(asset.uri, [{ resize: asset.width >= asset.height ? { width: 1600 } : { height: 1600 } }], { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG });
        const r = await fetch(optimized.uri); const bytes = await r.arrayBuffer(); const path = `cases/${id}/gallery/${Date.now()}-${Math.random().toString(36).substring(2)}.jpg`;
        const { error: ue } = await supabase.storage.from('case-images').upload(path, bytes, { contentType: 'image/jpeg', upsert: false }); if (ue) throw ue;
        const { data: u } = supabase.storage.from('case-images').getPublicUrl(path); const { error: ie } = await supabase.from('case_images').insert({ case_id: id, image_url: u.publicUrl, display_order: order++ });
        if (ie) { await supabase.storage.from('case-images').remove([path]); throw ie; }
      } await loadGallery();
    } catch (e) { console.log(e); Alert.alert('Eroare', 'Fotografiile nu au putut fi adăugate.'); } finally { setUploadingGallery(false); }
  }

  async function deleteGalleryImage(image: CaseImage) {
    const { error } = await supabase.from('case_images').delete().eq('id', image.id); if (error) { Alert.alert('Eroare', 'Fotografia nu a putut fi ștearsă.'); return; }
    await deleteImageFromStorage(image.image_url); setGalleryImages(v => v.filter(x => x.id !== image.id));
  }
  function confirmDeleteGalleryImage(image: CaseImage) { Alert.alert('Șterge fotografia', 'Sigur vrei să ștergi această fotografie?', [{ text: 'Anulează', style: 'cancel' }, { text: 'Șterge', style: 'destructive', onPress: () => deleteGalleryImage(image) }]); }

  async function pickImage() {
  const permission =
    await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    Alert.alert(
      'Permisiune necesară',
      'Permite accesul la fotografii pentru a putea selecta imaginea cazului.'
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
    return caseData?.image_url || null;
  }

  const response = await fetch(newImageUri);
  const arrayBuffer = await response.arrayBuffer();

  const fileExtension =
    newImageUri.split('.').pop()?.toLowerCase() || 'jpg';

  const fileName =
    `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}.${fileExtension}`;

  const filePath = `cases/${fileName}`;

  const { error } = await supabase.storage
    .from('case-images')
    .upload(filePath, arrayBuffer, {
      contentType:
        fileExtension === 'png'
          ? 'image/png'
          : 'image/jpeg',
      upsert: false,
    });

  if (error) {
    console.log('Eroare upload imagine:', error);
    throw error;
  }

  const { data } = supabase.storage
    .from('case-images')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

async function deleteImageFromStorage(
  imageUrl: string | null
) {
  if (!imageUrl) return;

  try {
    const imagePath =
      imageUrl.split('/case-images/')[1];

    if (!imagePath) {
      console.log(
        'Nu am putut identifica fotografia veche.'
      );
      return;
    }

    const decodedPath =
      decodeURIComponent(imagePath);
      console.log(
  'ÎNCERC SĂ ȘTERG POZA VECHE:',
  decodedPath
);

    const { error } = await supabase.storage
      .from('case-images')
      .remove([decodedPath]);

    if (error) {
  console.log(
    'EROARE DELETE STORAGE:',
    error
  );
} else {
  console.log(
    'POZA VECHE A FOST ȘTEARSĂ:',
    decodedPath
  );
}
  } catch (error) {
    console.log(
      'Eroare procesare fotografie veche:',
      error
    );
  }
}

  async function handleSave() {
 if (!id) return;

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
    const imageUrl = await uploadNewImage();
    const { error } = await supabase
      .from('cases')
      .update({
  title: title.trim(),
  location: location.trim() || null,
  story: story.trim(),
  urgent_need: urgentNeed.trim() || null,
  video_url: videoUrl.trim() || null,
  report_year: cleanCaseYear ? Number(cleanCaseYear) : null,
  status,
  image_url: imageUrl,
  updated_at: new Date().toISOString(),
})
      .eq('id', id);

   if (error) {
  console.log('Eroare actualizare caz:', error);
  Alert.alert('Eroare', 'Cazul nu a putut fi actualizat.');
  return;
}

// Trimitem notificare doar la prima publicare a unui draft ca activ.
if (caseData?.status === 'draft' && status === 'active') {
  try {
    const { data: existingNotification, error: lookupError } = await supabase
      .from('notifications')
      .select('id')
      .eq('target_type', 'case')
      .eq('target_id', id)
      .eq('status', 'published')
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      console.log('Eroare verificare notificare caz:', lookupError);
    } else if (!existingNotification) {
      const { data: notification, error: notificationError } = await supabase
        .from('notifications')
        .insert({
          title: 'Caz nou: ' + title.trim(),
          message: 'Descoperă noul caz publicat de Misiunea Bucovina.',
          status: 'published',
          target_type: 'case',
          target_id: id,
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (notificationError) {
        console.log('Eroare creare notificare caz:', notificationError);
      } else if (notification?.id) {
        const { error: pushError } = await supabase.functions.invoke(
          'send-push-notification',
          { body: { notification_id: notification.id } }
        );
        if (pushError) console.log('Eroare push pentru caz:', pushError);
      }
    }
  } catch (notificationError) {
    console.log('Eroare neașteptată notificare caz:', notificationError);
  }
}

// AICI ștergem fotografia veche
if (
  newImageUri &&
  caseData?.image_url &&
  caseData.image_url !== imageUrl
) {
  await deleteImageFromStorage(
    caseData.image_url
  );
}

showSaveSuccess();
router.back();

  } catch (error) {
    console.log(error);

    Alert.alert(
      'Eroare',
      'A apărut o problemă neașteptată.'
    );
  } finally {
    setLoading(false);
  }
}

function confirmDelete() {
  Alert.alert(
    'Șterge cazul',
    `Sigur vrei să ștergi „${title}”?`,
    [
      {
        text: 'Anulează',
        style: 'cancel',
      },
      {
        text: 'Șterge',
        style: 'destructive',
        onPress: handleDelete,
      },
    ]
  );
}

async function handleDelete() {
  if (!id) return;

  try {
    setLoading(true);

    // 1. Ștergem fotografia din Storage, dacă există
    if (caseData?.image_url) {
  try {
    const imagePath =
      caseData.image_url.split(
        '/case-images/'
      )[1];

    if (imagePath) {
      const decodedPath =
        decodeURIComponent(imagePath);

      console.log(
        'Ștergem fotografia:',
        decodedPath
      );

      const { error: imageDeleteError } =
        await supabase.storage
          .from('case-images')
          .remove([decodedPath]);

      if (imageDeleteError) {
        console.log(
          'Eroare ștergere fotografie:',
          imageDeleteError
        );
      } else {
        console.log(
          'Fotografia a fost ștearsă din Storage.'
        );
      }
    }
  } catch (error) {
    console.log(
      'Eroare procesare fotografie:',
      error
    );
  }
}

    // 2. Ștergem cazul din baza de date
    const { error } = await supabase
      .from('cases')
      .delete()
      .eq('id', id);

    if (error) {
      console.log(
        'Eroare ștergere caz:',
        error
      );

      Alert.alert(
        'Eroare',
        'Cazul nu a putut fi șters.'
      );

      return;
    }

    Alert.alert(
      'Caz șters',
      'Cazul și fotografia asociată au fost șterse cu succes.',
      [
        {
          text: 'OK',
          onPress: () =>
            router.back(),
        },
      ]
    );
  } catch (error) {
    console.log(error);

    Alert.alert(
      'Eroare',
      'A apărut o problemă la ștergerea cazului.'
    );
  } finally {
    setLoading(false);
  }
}
  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color={RED}
          />

          <Text style={styles.loadingText}>
            Se încarcă cazul...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!caseData) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Ionicons
            name="alert-circle-outline"
            size={45}
            color={RED}
          />

          <Text style={styles.errorTitle}>
            Cazul nu a fost găsit
          </Text>

          <TouchableOpacity
  style={styles.backButton}
  onPress={() => router.back()}
>
            <Text style={styles.backToCasesText}>
              Înapoi la cazuri
            </Text>
          </TouchableOpacity>
        </View>
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

          <Text style={styles.title}>
            Editează cazul
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
  onPress={pickImage}
  activeOpacity={0.85}
>
  {newImageUri || caseData.image_url ? (
    <>
      <Image
        source={{
          uri: newImageUri || caseData.image_url!,
        }}
        style={styles.caseImage}
        resizeMode="cover"
      />

      <View style={styles.changeImageButton}>
        <Ionicons
          name="camera-outline"
          size={18}
          color="#FFFFFF"
        />

        <Text style={styles.changeImageText}>
          Schimbă fotografia
        </Text>
      </View>
    </>
  ) : (
    <>
      <Ionicons
        name="image-outline"
        size={35}
        color={RED}
      />

      <Text style={styles.noImageTitle}>
        Adaugă fotografie
      </Text>

      <Text style={styles.noImageText}>
        Alege o imagine din galeria telefonului
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
      onPress={addGalleryImages}
      disabled={uploadingGallery}
    >
      {uploadingGallery ? (
        <ActivityIndicator color={RED} />
      ) : (
        <>
          <Ionicons name="images-outline" size={20} color={RED} />
          <Text style={styles.addGalleryButtonText}>
            Adaugă fotografii
          </Text>
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
            <Image
              source={{ uri: image.image_url }}
              style={styles.galleryImage}
              resizeMode="cover"
            />
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
    INFORMAȚII PRINCIPALE
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
      Poveste
    </Text>

    <TextInput
      style={[styles.input, styles.textArea]}
      value={story}
      onChangeText={setStory}
      placeholder="Povestea cazului..."
      placeholderTextColor="#AAAAAA"
      multiline
      textAlignVertical="top"
    />
  </View>

  <Text style={styles.sectionLabel}>
    NEVOIA CAZULUI
  </Text>

  <View style={styles.card}>
    <Text style={styles.label}>
      Nevoia urgentă
    </Text>

    <TextInput
      style={[styles.input, styles.urgentArea]}
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
      style={styles.input}
      value={videoUrl}
      onChangeText={setVideoUrl}
      placeholder="Ex: https://www.youtube.com/watch?v=..."
      placeholderTextColor="#AAAAAA"
      keyboardType="url"
      autoCapitalize="none"
      autoCorrect={false}
    />

    <Text style={styles.videoHint}>
      Dacă nu adaugi un link, secțiunea video nu va apărea în cazul public.
    </Text>
  </View>

  <Text style={styles.sectionLabel}>
    STATUS
  </Text>

  <View style={styles.statusRow}>
    <TouchableOpacity
      style={[
        styles.statusButton,
        status === 'active' &&
          styles.statusButtonSelected,
      ]}
      onPress={() => setStatus('active')}
    >
      <Ionicons
        name="checkmark-circle-outline"
        size={22}
        color={
          status === 'active' ? RED : '#777777'
        }
      />

      <Text
        style={[
          styles.statusButtonText,
          status === 'active' &&
            styles.statusButtonTextSelected,
        ]}
      >
        Activ
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={[
        styles.statusButton,
        status === 'completed' &&
          styles.statusButtonSelected,
      ]}
      onPress={() => setStatus('completed')}
    >
      <Ionicons
        name="checkmark-done-outline"
        size={22}
        color={
          status === 'completed'
            ? RED
            : '#777777'
        }
      />

      <Text
        style={[
          styles.statusButtonText,
          status === 'completed' &&
            styles.statusButtonTextSelected,
        ]}
      >
        Finalizat
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={[
        styles.statusButton,
        status === 'draft' &&
          styles.statusButtonSelected,
      ]}
      onPress={() => setStatus('draft')}
    >
      <Ionicons
        name="document-outline"
        size={22}
        color={
          status === 'draft' ? RED : '#777777'
        }
      />

      <Text
        style={[
          styles.statusButtonText,
          status === 'draft' &&
            styles.statusButtonTextSelected,
        ]}
      >
        Draft
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={[
        styles.statusButton,
        status === 'archived' &&
          styles.statusButtonSelected,
      ]}
      onPress={() => setStatus('archived')}
    >
      <Ionicons
        name="archive-outline"
        size={22}
        color={
          status === 'archived' ? RED : '#777777'
        }
      />

      <Text
        style={[
          styles.statusButtonText,
          status === 'archived' &&
            styles.statusButtonTextSelected,
        ]}
      >
        Arhivat
      </Text>
    </TouchableOpacity>
  </View>

  <TouchableOpacity
    style={styles.saveButton}
    activeOpacity={0.85}
    onPress={handleSave}
  >
    <Ionicons
      name="save-outline"
      size={20}
      color="#FFFFFF"
    />

    <Text style={styles.saveButtonText}>
      Salvează modificările
    </Text>
    </TouchableOpacity>

  <TouchableOpacity
    style={styles.deleteButton}
    activeOpacity={0.8}
    onPress={confirmDelete}
  >
    <Ionicons
      name="trash-outline"
      size={19}
      color={RED}
    />

    <Text style={styles.deleteButtonText}>
      Șterge cazul
    </Text>
  </TouchableOpacity>

</ScrollView>
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
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
  },

  icon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  caseTitle: {
    color: DARK,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 16,
  },

  location: {
    color: '#888888',
    fontSize: 11,
    marginTop: 5,
  },

  amount: {
    color: DARK,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 15,
  },

  successText: {
    color: RED,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 18,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  loadingText: {
    color: '#888888',
    fontSize: 11,
    marginTop: 10,
  },

  errorTitle: {
    color: DARK,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 12,
  },

  backToCases: {
    backgroundColor: RED,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 13,
    marginTop: 20,
  },

  backToCasesText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
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

textArea: {
  minHeight: 145,
  paddingTop: 13,
  paddingBottom: 13,
},

urgentArea: {
  minHeight: 115,
  paddingTop: 13,
  paddingBottom: 13,
},

videoHint: {
  color: '#888888',
  fontSize: 9,
  lineHeight: 14,
  marginTop: -5,
},

statusRow: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 8,
},

statusButton: {
  width: '48.5%',
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
  marginBottom: 30,
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

caseImage: {
  width: '100%',
  height: '100%',
},

changeImageButton: {
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

noImageTitle: {
  color: DARK,
  fontSize: 14,
  fontWeight: '900',
  marginTop: 10,
},

noImageText: {
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

deleteButton: {
  minHeight: 52,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: '#F0CCCC',
  backgroundColor: '#FFF8F8',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  marginBottom: 35,
},

deleteButtonText: {
  color: RED,
  fontSize: 11,
  fontWeight: '900',
},


});