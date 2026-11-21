import { supabase } from './supabase';

export type VolunteerPageContent = {
  hero_image: string; hero_title: string; hero_subtitle: string;
  intro_eyebrow: string; intro_title: string; intro_body: string;
  benefits: { icon: string; title: string; description: string }[];
  form_banner_title: string; form_banner_subtitle: string; form_eyebrow: string; form_title: string; form_description: string;
  form_about_title: string; form_about_subtitle: string;
  form_involvement_title: string; form_involvement_subtitle: string;
  involvement_options: string[];
  form_message_title: string; form_message_subtitle: string;
  consent_text: string; submit_label: string; privacy_text: string;
  story_sections: { eyebrow: string; title: string; description: string; bullets: string[]; button_text: string; button_link: string; image: string }[];
};

export const defaultVolunteerPage: VolunteerPageContent = {
  hero_image: '', hero_title: 'Voluntariat', hero_subtitle: 'Devino voluntar sau ambasador al binelui. Împreună facem ca binele să se audă până departe.',
  intro_eyebrow: 'IMPLICĂ-TE ÎN LUCRAREA NOASTRĂ', intro_title: 'Binele începe cu tine.', intro_body: 'Nu trebuie să faci lucruri extraordinare pentru a schimba o viață. Ai nevoie doar de dorința de a ajuta și de o inimă deschisă.',
  benefits: [
    { icon: 'heart-outline', title: 'Ajută familii', description: 'Implică-te în proiecte sociale și distribuirea de ajutoare.' },
    { icon: 'people-outline', title: 'Lucrează cu copiii', description: 'Contribuie la activități educative și comunitare.' },
    { icon: 'megaphone-outline', title: 'Folosește-ți talentele', description: 'Media, organizare, evenimente, transport și logistică.' },
    { icon: 'hand-left-outline', title: 'Fii parte din echipă', description: 'Construiește relații și oferă din timpul tău.' },
  ],
  form_banner_title: 'Devino voluntar sau ambasador al binelui', form_banner_subtitle: 'Împreună facem ca binele să se audă până departe.',
  form_eyebrow: 'ÎNSCRIERE VOLUNTARI', form_title: 'Alătură-te echipei Misiunea Bucovina', form_description: 'Completează datele de mai jos și spune-ne cum ai dori să te implici. Te vom contacta pentru următorii pași.',
  form_about_title: 'Despre tine', form_about_subtitle: 'Informații de contact',
  form_involvement_title: 'Cum vrei să te implici?', form_involvement_subtitle: 'Poți selecta mai multe opțiuni',
  involvement_options: ['Proiecte sociale','Activități cu copii','Distribuire alimente','Logistică','Evenimente','Foto / Video / Media','Șofer / Transport','Rugăciune','Altele'],
  form_message_title: 'Spune-ne mai multe', form_message_subtitle: 'Opțional',
  consent_text: 'Sunt de acord ca informațiile introduse în acest formular să fie folosite pentru contactarea mea în legătură cu activitățile de voluntariat.',
  submit_label: 'Trimite înscrierea', privacy_text: 'Datele tale vor fi tratate cu grijă și folosite pentru procesarea înscrierii.',
  story_sections: [
    { eyebrow: 'OAMENII DIN SPATELE MISIUNII', title: 'Voluntarii noștri', description: 'Oameni cu inimă mare care transformă credința în faptă, zi de zi.', bullets: [], button_text: 'Vezi aici voluntarii noștri', button_link: '/voluntarii-nostri', image: '' },
    { eyebrow: 'DE CE SĂ TE IMPLICI?', title: 'De ce să te alături și tu echipei?', description: '', bullets: ['Șansa de a face parte dintr-o echipă în care oamenii se sprijină unii pe alții, cu multă bunătate și dorința sinceră de a face bine.','Gesturi simple, dar care schimbă vieți: sprijinim oameni fără adăpost, bătrâni singuri și familii aflate în nevoie.','Păstrăm vii valorile credinței și ale tradițiilor noastre, prin evenimente și întâlniri pentru comunitate.'], button_text: 'Ziua anuală a Voluntarului', button_link: '/ziua-voluntarului', image: '' },
  ],
};
export async function loadVolunteerPage(): Promise<VolunteerPageContent> {
  const { data, error } = await supabase.from('volunteer_page_content').select('content').eq('id', 1).maybeSingle();
  if (error) throw error;
  if (!data?.content) return defaultVolunteerPage;
  const c = data.content as Partial<VolunteerPageContent>;
  return { ...defaultVolunteerPage, ...c, benefits: c.benefits ?? defaultVolunteerPage.benefits, story_sections: c.story_sections ?? defaultVolunteerPage.story_sections, involvement_options: c.involvement_options ?? defaultVolunteerPage.involvement_options };
}
export function volunteerImageUrl(value: string): string {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return supabase.storage.from('volunteer-page').getPublicUrl(value).data.publicUrl;
}
