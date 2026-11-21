import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { checkNicknameAvailability } from '../lib/nicknameAvailability';

type Props = { nickname: string; original: string; onAvailabilityChange: (available: boolean) => void };
export default function NicknameAvailability({ nickname, original, onAvailabilityChange }: Props) {
  const [status, setStatus] = useState<'idle'|'checking'|'available'|'taken'|'error'>('idle');
  useEffect(() => {
    let active = true;
    const name = nickname.trim().replace(/^@/, '').toLowerCase();
    const old = original.trim().replace(/^@/, '').toLowerCase();
    if (!name || name === old) { setStatus('idle'); onAvailabilityChange(true); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(name)) { setStatus('idle'); onAvailabilityChange(false); return; }
    setStatus('checking'); onAvailabilityChange(false);
    const timer = setTimeout(async () => {
      try {
        const available = await checkNicknameAvailability(name);
        if (active) { setStatus(available ? 'available' : 'taken'); onAvailabilityChange(available); }
      } catch {
        if (active) { setStatus('error'); onAvailabilityChange(false); }
      }
    }, 450);
    return () => { active = false; clearTimeout(timer); };
  }, [nickname, original, onAvailabilityChange]);
  const messages = { idle: '', checking: 'Se verifică disponibilitatea…', available: '✓ Nickname disponibil', taken: '✕ Acest nickname este deja folosit.', error: 'Nu s-a putut verifica nickname-ul. Încearcă din nou.' };
  if (status === 'idle') return null;
  return <Text style={{ marginTop: 7, fontSize: 12, color: status === 'available' ? '#247447' : status === 'taken' || status === 'error' ? '#A61E22' : '#777' }}>{messages[status]}</Text>;
}
