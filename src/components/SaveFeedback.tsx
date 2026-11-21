import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { clearSaveMessage, subscribeSaveMessage } from '../lib/save-feedback';
export default function SaveFeedback() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => subscribeSaveMessage(setMessage), []);
  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(clearSaveMessage, 2600);
    return () => clearTimeout(timeout);
  }, [message]);
  if (!message) return null;
  return <View pointerEvents="none" style={{ position: 'absolute', bottom: 86, left: 18, right: 18, zIndex: 9999, alignItems: 'center' }}>
    <View style={{ backgroundColor: '#A61E22', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 12 }}>
      <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700', textAlign: 'center' }}>{message}</Text>
    </View>
  </View>;
}
