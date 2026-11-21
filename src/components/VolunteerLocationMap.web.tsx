import React from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';

// Web fallback: avoids importing react-native-maps, which is native-only.
// The search results above the map can still be selected on the web.
export function Marker(_props: any) { return null; }
export default function VolunteerLocationMap(props: any) {
  const region = props.region ?? props.initialRegion;
  const latitude = region?.latitude ?? 47.65;
  const longitude = region?.longitude ?? 26.25;
  const url = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=14/${latitude}/${longitude}`;
  return (
    <View style={[{ flex: 1, backgroundColor: '#F5F4F1', alignItems: 'center', justifyContent: 'center', padding: 20 }, props.style]}>
      <Text style={{ textAlign: 'center', color: '#444', marginBottom: 12 }}>
        Pe web, caută adresa în câmpul de mai sus și selectează un rezultat. Harta interactivă cu selectare prin atingere este disponibilă în aplicația mobilă.
      </Text>
      <TouchableOpacity accessibilityRole="link" onPress={() => Linking.openURL(url)} style={{ padding: 12, borderRadius: 10, backgroundColor: '#FCEEEE' }}>
        <Text style={{ color: '#A61E22', fontWeight: '700' }}>Deschide locația pe hartă</Text>
      </TouchableOpacity>
    </View>
  );
}
