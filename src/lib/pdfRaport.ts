import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

type Locality = { id: string; name: string };
type Child = { child_id: string; name: string; status: 'present' | 'absent' | 'uncertain'; reason: string | null };
type Staff = { user_id: string; name: string; is_present: boolean | null };
type Meeting = { id: string; locality_id: string; locality_name: string; meeting_date: string; title: string | null; closed_at: string | null; children: Child[]; staff: Staff[] };
type StaffSummary = { user_id: string; full_name: string; present: number; absent: number; unmarked: number };
type Totals = { meetings: number; closed_meetings: number; registered_children: number; children_present: number; children_absent: number; children_uncertain: number; staff_present: number; staff_absent: number; unique_staff_participants: number };
export type SchoolAnnualPdfReport = { start_year: number; localities: Locality[]; totals: Totals; staff: StaffSummary[]; meetings: Meeting[] };
const esc = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const dateRO = (s: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? `${m[3]}.${m[2]}.${m[1]}` : s; };
const label = (s: Child['status']) => s === 'present' ? 'Prezent' : s === 'absent' ? 'Absent' : 'De clarificat';
const table = (head: string[], rows: string[][]) => `<table><thead><tr>${head.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${head.length}">Nu există înregistrări.</td></tr>`}</tbody></table>`;

export async function exportSchoolAnnualPdf(report: SchoolAnnualPdfReport, year: number, localityName: string, approved: boolean) {
  const t = report.totals;
  const meetings = [...(report.meetings ?? [])].sort((a,b) => a.meeting_date.localeCompare(b.meeting_date));
  const attendanceTotal = t.children_present + t.children_absent + t.children_uncertain;
  const rate = attendanceTotal ? Math.round(100*t.children_present/attendanceTotal) : 0;
  const sections = meetings.map(m => `<section class="meeting"><h3>${esc(m.title || 'Întâlnire')} <small>${esc(dateRO(m.meeting_date))} · ${esc(m.locality_name)} · ${m.closed_at ? 'Încheiată' : 'Neîncheiată'}</small></h3><p><strong>Copii:</strong> ${m.children.filter(c=>c.status==='present').length} prezenți · ${m.children.filter(c=>c.status==='absent').length} absenți · ${m.children.filter(c=>c.status==='uncertain').length} de clarificat</p>${table(['Copil','Prezență','Motiv'],m.children.map(c=>[c.name,label(c.status),c.reason || '—']))}<h4>Echipă</h4>${table(['Membru','Prezență'],m.staff.map(s=>[s.name,s.is_present===true?'Prezent':s.is_present===false?'Absent':'Nemarcat']))}</section>`).join('');
  const html = `<!DOCTYPE html><html lang="ro"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>
  @page { size: A4; margin: 18mm 14mm; } body { font-family: -apple-system, Arial, sans-serif; color:#202020; font-size:11px; line-height:1.5; } h1 {color:#A61E22;font-size:24px;margin:0;} h2{font-size:16px;color:#A61E22;margin:22px 0 8px;} h3{font-size:13px;margin:0 0 8px;} h4{margin:12px 0 5px;} small{display:block;font-size:10px;color:#666;font-weight:400;} .sub{color:#666;margin:4px 0 18px;} .status{padding:9px 12px;border:1px solid #ddd;border-radius:7px;background:#fafafa;margin:12px 0;} .stats{display:flex;flex-wrap:wrap;gap:8px;} .stat{border:1px solid #eee;border-radius:7px;padding:9px;min-width:120px;flex:1;} .num{font-size:19px;font-weight:800;color:#A61E22;} .lbl{font-size:10px;color:#666;} table{width:100%;border-collapse:collapse;margin:8px 0 14px;table-layout:fixed;} th,td{padding:6px 7px;text-align:left;border-bottom:1px solid #e5e5e5;word-wrap:break-word;} th{background:#f4f4f4;} .meeting{page-break-inside:avoid;margin-top:18px;padding-top:10px;border-top:1px solid #ddd;} .foot{font-size:9px;color:#777;margin-top:24px;} </style></head><body>
  <h1>Școala Creștină</h1><p class="sub">Raport anual ${year}–${year+1} · ${esc(localityName)}<br/>Perioada: 01.10.${year} – 30.06.${year+1}</p>
  <div class="status"><strong>Statut:</strong> ${approved?'Raport final aprobat':'Raport provizoriu / neaprobat'}<br/>Întâlnirile sunt numărate după activitatea efectivă; vacanțele nu sunt considerate întâlniri lipsă.</div>
  <h2>Rezumat</h2><div class="stats">${[['Întâlniri înregistrate',t.meetings],['Întâlniri încheiate',t.closed_meetings],['Copii înregistrați',t.registered_children],['Prezențe copii',t.children_present],['Absențe copii',t.children_absent],['De clarificat',t.children_uncertain],['Rata prezenței',`${rate}%`],['Participări echipă',t.staff_present],['Absențe echipă',t.staff_absent],['Membri unici prezenți',t.unique_staff_participants]].map(([l,v])=>`<div class="stat"><div class="num">${esc(v)}</div><div class="lbl">${esc(l)}</div></div>`).join('')}</div>
  <h2>Participarea echipei</h2>${table(['Membru','Prezențe','Absențe','Nemarcate'],(report.staff??[]).map(s=>[s.full_name,String(s.present),String(s.absent),String(s.unmarked)]))}
  <h2>Întâlniri și prezență</h2>${sections || '<p>Nu există întâlniri în perioada selectată.</p>'}
  <p class="foot">Generat din datele Școlii Creștine din aplicația Misiunea Bucovina. Rata prezenței este calculată din marcajele Prezent / Absent / De clarificat. PDF-ul reprezintă situația datelor la momentul exportului.</p>
  </body></html>`;
  const result = await Print.printToFileAsync({ html });
  if (!(await Sharing.isAvailableAsync())) throw new Error('Partajarea fișierelor nu este disponibilă pe acest dispozitiv.');
  await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf', dialogTitle: `Raport Școala Creștină ${year}-${year+1}`, UTI: 'com.adobe.pdf' });
}
