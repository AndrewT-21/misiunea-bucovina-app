import { Alert } from '../lib/platform-alert';
import MisiBiPageHeader from '../components/MisiBiPageHeader';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { POLICY_SOURCE, POLICY_TITLES } from '../lib/legal-policy';
import { normalizeLegalBody } from '../lib/normalize-legal-text';

type Section = { title: string; body: string };
const RED = '#A61E22';
const CONTACT_EMAIL = 'contact@misiuneabucovina.org';
const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export default function PolicyPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [date, setDate] = useState('6 iulie 2026');
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const { width } = useWindowDimensions();
  const compact = width < 700;

  useEffect(() => {
    let alive = true;
    supabase.from('legal_documents').select('sections,updated_label').eq('slug', 'privacy-terms').maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) console.warn('Politica:', error.message);
        if (Array.isArray(data?.sections)) setSections(data.sections as Section[]);
        if (data?.updated_label) setDate(data.updated_label);
        setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  const entries = sections.length ? sections : POLICY_TITLES.map(title => ({ title, body: '' }));

  const printPolicy = async () => {
    if (loading || exporting) return;
    if (!sections.length || sections.some(item => !item.body?.trim())) {
      Alert.alert('Document incomplet', 'Nu se poate genera PDF-ul până când toate secțiunile sunt disponibile în aplicație.');
      return;
    }

    const htmlSections = sections.map((item, index) =>
      `<section><h2>${index + 1}. ${escapeHtml(item.title)}</h2><p>${escapeHtml(normalizeLegalBody(item.body)).replace(/\n/g, '<br>')}</p></section>`
    ).join('');
    const html = `<!doctype html><html lang="ro"><head><meta charset="utf-8"><title>Politica de confidențialitate – Misiunea Bucovina</title><style>@page{size:A4;margin:18mm 16mm}body{font-family:Arial,sans-serif;color:#172033;line-height:1.6;font-size:11pt}h1{font-size:23pt;line-height:1.25}h2{font-size:14pt;margin-top:22px;break-after:avoid;page-break-after:avoid}section{break-inside:auto}p{white-space:normal;margin:10px 0}small{color:#666}.meta{border-bottom:2px solid #A61E22;padding-bottom:15px;margin-bottom:20px}</style></head><body><div class="meta"><h1>Politica de confidențialitate, Termeni și condiții</h1><small>Asociația Misiunea Bucovina MB · CIF 48215616 · ${escapeHtml(CONTACT_EMAIL)} · Ultima actualizare: ${escapeHtml(date)}</small></div>${htmlSections}</body></html>`;

    setExporting(true);
    try {
      if (Platform.OS === 'web') {
        const popup = window.open('', '_blank');
        if (!popup) {
          window.alert('Permite ferestrele pop-up pentru a tipări sau salva documentul PDF.');
          return;
        }
        popup.document.open();
        popup.document.write(html);
        popup.document.close();
        popup.focus();
        popup.print();
      } else {
        const Print = await import('expo-print');
        const Sharing = await import('expo-sharing');
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            UTI: 'com.adobe.pdf',
            dialogTitle: 'Salvează sau tipărește politica MisiBi',
          });
        } else {
          await Print.printAsync({ uri });
        }
      }
    } catch (error) {
      console.warn('Export PDF:', error);
      Alert.alert('Eroare PDF', 'Nu am putut genera sau partaja documentul. Încearcă din nou.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <MisiBiPageHeader title="Politica de confidențialitate" eyebrow="MISIUNEA BUCOVINA" />
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={[s.title, !compact && s.titleWide]}>Politica de Confidențialitate, Termeni și Condiții</Text>
        <Text style={s.intro}>Acest document stabilește regulile de utilizare a site-ului, modul de prelucrare a datelor personale, condițiile privind donațiile, donațiile recurente, cazurile sociale, beneficiarii, voluntarii, materialele foto-video, comunicările publice, serviciile terțe, baza statutară, buna administrare a resurselor, transparența internă și limitele răspunderii Asociației Misiunea Bucovina MB.</Text>

        <View style={s.infoGrid}>
          {[
            ['ORGANIZAȚIE', 'Asociația Misiunea Bucovina MB'],
            ['CIF', '48215616'],
            ['EMAIL', CONTACT_EMAIL],
            ['ULTIMA ACTUALIZARE', date],
          ].map(([label, value]) => (
            <View key={label} style={[s.infoCard, { width: compact ? '100%' : '23.8%' }]}>
              <Text style={s.infoLabel}>{label}</Text>
              <Text style={s.infoValue} selectable>{value}</Text>
            </View>
          ))}
        </View>

        <View style={s.notice}>
          <Text style={s.noticeText}>Prin accesarea site-ului, completarea formularelor, efectuarea unei donații, transmiterea unei solicitări, înscrierea unui caz social, înscrierea ca voluntar, trimiterea de materiale sau folosirea oricărei secțiuni a site-ului, confirmați că ați citit, ați înțeles și acceptați prezentul document.</Text>
        </View>

        <View style={s.actions}>
          <TouchableOpacity accessibilityRole="button" style={[s.printButton, (loading || exporting) && { opacity: 0.6 }]} onPress={printPolicy} disabled={loading || exporting}>
            <Ionicons name="print-outline" size={18} color="#FFF" />
            <Text style={s.printText}>{exporting ? 'Se pregătește PDF-ul...' : 'Tipărește / Salvează PDF'}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" style={s.contactButton} onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}>
            <Ionicons name="mail-outline" size={18} color="#172033" />
            <Text style={s.contactText}>Contactează Asociația</Text>
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator color={RED} style={{ marginTop: 25 }} />}
        <Text style={s.subtitle}>Cuprins și secțiuni</Text>
        {entries.map((item, i) => (
          <View key={i} style={s.card}>
            <TouchableOpacity accessibilityRole="button" onPress={() => setOpen(p => ({ ...p, [i]: !p[i] }))} style={s.row}>
              <Text style={s.cardTitle}>{i + 1}. {item.title}</Text>
              <Ionicons name={open[i] ? 'chevron-up' : 'chevron-down'} size={19} color={RED} />
            </TouchableOpacity>
            {open[i] && <View style={s.content}>
              {item.body.trim() ? <Text style={s.text}>{normalizeLegalBody(item.body)}</Text> : <>
                <Text style={s.muted}>Textul acestei secțiuni este disponibil în documentul oficial.</Text>
                <TouchableOpacity onPress={() => Linking.openURL(POLICY_SOURCE)}><Text style={s.link}>Deschide versiunea oficială</Text></TouchableOpacity>
              </>}
            </View>}
          </View>
        ))}
        <TouchableOpacity onPress={() => Linking.openURL(POLICY_SOURCE)} style={s.sourceLink}>
          <Text style={s.link}>Consultă sursa oficială pe site</Text>
          <Ionicons name="open-outline" size={16} color={RED} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FB' },
  scroll: { padding: 17, paddingBottom: 90, maxWidth: 1200, width: '100%', alignSelf: 'center' },
  title: { fontSize: 28, fontWeight: '900', color: '#111827', marginBottom: 14 },
  titleWide: { fontSize: 42 },
  intro: { fontSize: 15, lineHeight: 27, color: '#27344A', marginBottom: 23 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginBottom: 17 },
  infoCard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DFE3EA', borderRadius: 13, padding: 13, minHeight: 70 },
  infoLabel: { fontSize: 10, fontWeight: '900', color: '#64748B', marginBottom: 5 },
  infoValue: { fontSize: 12, fontWeight: '800', color: '#111827' },
  notice: { backgroundColor: '#FFFBEA', borderWidth: 1, borderColor: '#F3D36A', borderRadius: 13, padding: 17 },
  noticeText: { fontSize: 14, lineHeight: 25, color: '#87400B', fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18, marginBottom: 9 },
  printButton: { backgroundColor: RED, borderRadius: 25, paddingVertical: 12, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', gap: 8 },
  printText: { color: '#FFF', fontWeight: '900', fontSize: 13 },
  contactButton: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DFE3EA', borderRadius: 25, paddingVertical: 12, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', gap: 8 },
  contactText: { color: '#172033', fontWeight: '800', fontSize: 13 },
  subtitle: { fontSize: 20, fontWeight: '900', color: '#171717', marginTop: 25, marginBottom: 15 },
  muted: { color: '#687078', fontSize: 14, lineHeight: 22 },
  text: { color: '#30343B', fontSize: 15, lineHeight: 25, marginTop: 13, textAlign: 'left' },
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E8E1DF', borderRadius: 14, marginBottom: 9 },
  row: { padding: 17, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: '#222' },
  content: { paddingHorizontal: 17, paddingBottom: 18, borderTopWidth: 1, borderTopColor: '#EEE' },
  link: { color: RED, fontWeight: '800', marginTop: 12 },
  sourceLink: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 16, paddingVertical: 12 },
});
