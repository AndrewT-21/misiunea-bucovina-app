
import { Ionicons } from '@expo/vector-icons';
import { Link, Tabs, usePathname } from 'expo-router';
import {
  Platform,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

const RED = '#A61E22';

const items = [
  { name: 'index', title: 'Acasă', icon: 'home', href: '/' },
  { name: 'cazuri', title: 'Cazuri', icon: 'heart', href: '/cazuri' },
  { name: 'proiecte', title: 'Proiecte', icon: 'people', href: '/proiecte' },
  {
    name: 'calendar',
    title: 'Calendar',
    icon: 'calendar-outline',
    href: '/calendar',
  },
  {
    name: 'implica-te',
    title: 'Implică-te',
    icon: 'hand-left',
    href: '/implica-te',
  },
  {
    name: 'mai-multe',
    title: 'Mai multe',
    icon: 'menu',
    href: '/mai-multe',
  },
] as const;

export default function TabLayout() {
  const pathname = usePathname();

  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 900;

  return (
    <View style={styles.container}>
      {desktop && (
        <View style={styles.webBar}>
          <View style={styles.webInner}>
            <Link href="/" asChild>
              <Pressable accessibilityRole="link" style={styles.brand}>
                <Image source={require('../../../assets/app-icon.png')} style={styles.brandLogo} resizeMode="contain" />
                <View style={styles.brandWords}>
                  <Text style={styles.brandTop}>MISIUNEA</Text>
                  <Text style={styles.brandBottom}>BUCOVINA</Text>
                </View>
              </Pressable>
            </Link>

            <View style={styles.webLinks}>
              {items.map((item) => {
                const selected =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname === item.href ||
                      pathname.startsWith(item.href + '/');

                return (
                  <Link key={item.name} href={item.href} asChild>
                    <Pressable
                      accessibilityRole="link"
                      accessibilityState={{ selected }}
                      style={StyleSheet.flatten([
                        styles.webLink,
                        selected && styles.webLinkActive,
                      ])}
                    >
                    <Ionicons name={item.icon} size={17} color={selected ? RED : '#52525B'} style={styles.webLinkIcon} />
                    <Text
                      style={[
                        styles.webLinkText,
                        selected && styles.webLinkTextActive,
                      ]}
                    >
                      {item.title}
                    </Text>
                    </Pressable>
                  </Link>
                );
              })}
            </View>
          </View>
        </View>
      )}

      <View style={styles.navigator}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: RED,
            tabBarInactiveTintColor: '#777777',
            tabBarStyle: desktop
              ? { display: 'none' }
              : {
                  height: 82,
                  paddingTop: 8,
                  paddingBottom: 10,
                  backgroundColor: '#FFFFFF',
                  borderTopColor: '#EEEEEE',
                },
            tabBarLabelStyle: {
              fontSize: 10,
              fontWeight: '600',
            },
          }}
        >
          {items.map((item) => (
            <Tabs.Screen
              key={item.name}
              name={item.name}
              options={{
                title: item.title,
                tabBarIcon: ({ color, size }) => (
                  <Ionicons
                    name={item.icon}
                    size={size}
                    color={typeof color === 'string' ? color : '#777777'}
                  />
                ),
              }}
            />
          ))}
        </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  navigator: {
    flex: 1,
    minHeight: 0,
  },
  webBar: {
    height: 84,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#DDE2E8',
    justifyContent: 'center',
  },
  webInner: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  brandLogo: { width: 49, height: 58 },
  brandWords: { justifyContent: 'center' },
  brandTop: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '900',
  },
  brandBottom: {
    fontSize: 23,
    color: RED,
    fontWeight: '900',
  },
  webLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  webLink: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  webLinkActive: {
    backgroundColor: '#FFF1F2',
  },
  webLinkIcon: { marginRight: 1 },
  webLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  webLinkTextActive: {
    color: RED,
    fontWeight: '800',
  },
});
