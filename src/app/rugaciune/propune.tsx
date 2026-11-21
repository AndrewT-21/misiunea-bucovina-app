
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PrayerEditor from '../../components/PrayerEditor';

export default function PrayerProposalScreen() {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Înapoi la calendar"
          activeOpacity={0.7}
        >
          <Ionicons
            name="arrow-back"
            size={26}
            color="#A61E22"
          />
        </TouchableOpacity>

        <Text style={styles.title}>
          Propune o zi de rugăciune
        </Text>
      </View>

      <PrayerEditor mode="proposal" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAF6F2',
  },
  header: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#FCE8E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '900',
    color: '#1D1D1F',
  },
});
