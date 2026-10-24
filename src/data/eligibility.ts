// Eligibility Checker data (पात्रता जाँच) — added by Tab for Aarav, Oct 2026.
// Every exam records the notification it was taken from (`source`, `year`, `sourceUrl`).
// Birth-date windows (dobFrom/dobTo) are copied from the notification wherever it states them;
// they are the ground truth. Ages are shown for information.
// Anything that could not be confirmed is listed in `unverified` and shown as "अपुष्ट" in the UI.

export type Qual = '10' | 'iti' | '12' | 'grad';
export type Category = 'GEN' | 'OBC' | 'EWS' | 'SC' | 'ST';
export type Gender = 'M' | 'F';

export interface AgeBand {
  label: string;      // post group, e.g. "MTS"
  ageText: string;    // "18–25"
  dobFrom: string;    // earliest DOB allowed (UR) — YYYY-MM-DD
  dobTo: string;      // latest DOB allowed — YYYY-MM-DD
}

export interface Physical {
  maleH?: number;
  femaleH?: number;
  maleHST?: number;
  femaleHST?: number;
  lines: string[];    // full physical standard lines shown on the card
}

export interface ExamRule {
  id: string;
  nameHi: string;
  nameEn: string;
  icon: string;
  group: 'SSC' | 'डिफेंस' | 'रेलवे' | 'राज्य पुलिस' | 'UPSC';
  /** Age reckoning (cut-off) date. null = the notification gives only a birth-date window. */
  cutoff: string | null;
  ageText: string;               // as written in the notification (UR)
  dobFrom: string;               // UR male: born on or after
  dobTo: string;                 // born on or before
  dobFromF?: string;             // UR female, when different
  bands?: AgeBand[];             // post-wise age limits (CGL, MTS)
  relax: Partial<Record<Category, number>>;   // upper-age relaxation in years (male / all)
  relaxF?: Partial<Record<Category, number>>; // female, when different
  relaxText: string[];
  esm?: string;                  // ex-serviceman rule text (null = not applicable)
  genders: Gender[];
  genderNote?: string;
  minQual: '10' | '12' | 'grad';
  diplomaAs12?: boolean;         // 3-yr diploma accepted in place of 12th
  itiOk?: boolean;               // ITI accepted
  appearingOk?: boolean;         // final-year / appearing candidates may apply
  qualText: string[];
  keyCondition?: string;         // one-line condition shown on the result row (marks %, subjects, licence)
  conditions?: string[];         // extra conditions (marks %, subjects, licence, domicile…)
  physical?: Physical;
  source: string;
  year: number;
  sourceUrl: string;
  official: boolean;             // true = read from the official PDF/site
  unverified?: string[];         // 'dob' | 'relax' | 'physical' | 'qual' — shown as अपुष्ट
}

export const QUAL_LABEL: Record<Qual, string> = {
  '10': '10वीं पास',
  iti: 'ITI / डिप्लोमा',
  '12': '12वीं पास',
  grad: 'ग्रेजुएट',
};

export const CATEGORY_LABEL: Record<Category, string> = {
  GEN: 'सामान्य (Gen)',
  OBC: 'OBC',
  EWS: 'EWS',
  SC: 'SC',
  ST: 'ST',
};

const SSC_RELAX = { OBC: 3, SC: 5, ST: 5 };
const SSC_RELAX_TEXT = ['OBC: +3 साल', 'SC/ST: +5 साल', 'EWS / Gen: कोई छूट नहीं'];
const SSC_ESM = 'पूर्व सैनिक: सैन्य सेवा घटाने के बाद +3 साल';
const NO_RELAX_TEXT = ['किसी भी वर्ग को आयु में छूट नहीं (अग्निपथ योजना)'];

export const EXAMS: ExamRule[] = [
  // ───────────── SSC ─────────────
  {
    id: 'ssc_gd', nameHi: 'एसएससी जीडी कांस्टेबल', nameEn: 'SSC GD Constable (BSF, CRPF, CISF, ITBP, SSB, AR)', icon: '🪖', group: 'SSC',
    cutoff: '2026-01-01', ageText: '18–23 वर्ष', dobFrom: '2003-01-02', dobTo: '2008-01-01',
    relax: SSC_RELAX, relaxText: SSC_RELAX_TEXT, esm: SSC_ESM,
    genders: ['M', 'F'], minQual: '10',
    qualText: ['10वीं (मैट्रिक) पास — 01.01.2026 तक'],
    conditions: ['डोमिसाइल (निवास) प्रमाणपत्र ज़रूरी'],
    physical: {
      maleH: 170, femaleH: 157, maleHST: 162.5, femaleHST: 150,
      lines: ['लंबाई: पुरुष 170 सेमी, महिला 157 सेमी', 'ST: पुरुष 162.5, महिला 150 सेमी (पहाड़ी/NE क्षेत्रों को और छूट)', 'सीना (पुरुष): 80 सेमी + 5 सेमी फुलाव (ST 76+5)', 'दौड़: पुरुष 5 किमी 24 मिनट, महिला 1.6 किमी 8½ मिनट'],
    },
    source: 'SSC GD कांस्टेबल अधिसूचना 2026 (01.12.2025 को जारी)', year: 2026,
    sourceUrl: 'https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/notice_01122025.pdf', official: true,
  },
  {
    id: 'ssc_mts', nameHi: 'एसएससी एमटीएस / हवलदार', nameEn: 'SSC MTS & Havaldar (CBIC, CBN)', icon: '🗂️', group: 'SSC',
    cutoff: '2025-08-01', ageText: 'MTS 18–25, हवलदार 18–27 वर्ष', dobFrom: '1998-08-02', dobTo: '2007-08-01',
    bands: [
      { label: 'MTS', ageText: '18–25', dobFrom: '2000-08-02', dobTo: '2007-08-01' },
      { label: 'हवलदार (CBIC/CBN)', ageText: '18–27', dobFrom: '1998-08-02', dobTo: '2007-08-01' },
    ],
    relax: SSC_RELAX, relaxText: SSC_RELAX_TEXT, esm: SSC_ESM,
    genders: ['M', 'F'], minQual: '10',
    qualText: ['10वीं (मैट्रिक) पास'],
    physical: {
      maleH: 157.5, femaleH: 152,
      lines: ['सिर्फ़ हवलदार के लिए: लंबाई पुरुष 157.5 सेमी, महिला 152 सेमी', 'हवलदार: पुरुष 1600 मी. 15 मिनट पैदल, महिला 1 किमी 20 मिनट', 'MTS के लिए कोई शारीरिक मानक नहीं'],
    },
    source: 'SSC MTS व हवलदार परीक्षा अधिसूचना 2025', year: 2025,
    sourceUrl: 'https://sathee.iitk.ac.in/sathee-ssc/ssc-exams/ssc-mts/ssc-details/eligibility-criteria/', official: false,
    unverified: ['physical'],
  },
  {
    id: 'ssc_chsl', nameHi: 'एसएससी सीएचएसएल (10+2)', nameEn: 'SSC CHSL (LDC/JSA, DEO)', icon: '⌨️', group: 'SSC',
    cutoff: '2026-08-01', ageText: '18–27 वर्ष', dobFrom: '1999-08-02', dobTo: '2008-08-01',
    relax: SSC_RELAX, relaxText: SSC_RELAX_TEXT, esm: SSC_ESM,
    genders: ['M', 'F'], minQual: '12', appearingOk: true,
    qualText: ['12वीं पास (07.10.2026 तक)', 'कुछ विभागों के DEO पद: 12वीं साइंस में गणित के साथ'],
    source: 'SSC CHSL (10+2) परीक्षा अधिसूचना 2026 (07.09.2026)', year: 2026,
    sourceUrl: 'https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_chsl_2026.pdf', official: true,
  },
  {
    id: 'ssc_cgl', nameHi: 'एसएससी सीजीएल', nameEn: 'SSC CGL (Graduate Level)', icon: '🎓', group: 'SSC',
    cutoff: '2026-08-01', ageText: 'पद अनुसार 18–27 / 20–30 / 18–30 / 18–32 वर्ष', dobFrom: '1994-08-02', dobTo: '2008-08-01',
    bands: [
      { label: '18–27 वाले पद (Auditor, Tax Asst., UDC आदि)', ageText: '18–27', dobFrom: '1999-08-02', dobTo: '2008-08-01' },
      { label: '20–30 वाले पद (CSS/Railway/MEA ASO आदि)', ageText: '20–30', dobFrom: '1996-08-02', dobTo: '2006-08-01' },
      { label: '18–30 वाले पद (AAO, IB ASO, Inspector आदि)', ageText: '18–30', dobFrom: '1996-08-02', dobTo: '2008-08-01' },
      { label: '18–32 वाले पद (JSO)', ageText: '18–32', dobFrom: '1994-08-02', dobTo: '2008-08-01' },
    ],
    relax: SSC_RELAX, relaxText: SSC_RELAX_TEXT, esm: SSC_ESM,
    genders: ['M', 'F'], minQual: 'grad', appearingOk: true,
    qualText: ['किसी भी विषय में ग्रेजुएशन (01.08.2026 तक)', 'कुछ पदों के लिए विशेष विषय (जैसे JSO: 12वीं में गणित 60% / स्टैटिस्टिक्स)'],
    source: 'SSC CGL परीक्षा अधिसूचना 2026 (21.05.2026)', year: 2026,
    sourceUrl: 'https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_cgl_2025.pdf', official: true,
  },
  {
    id: 'delhi_police', nameHi: 'दिल्ली पुलिस कांस्टेबल (SSC)', nameEn: 'SSC Delhi Police Constable (Executive)', icon: '🚓', group: 'SSC',
    cutoff: '2025-07-01', ageText: '18–25 वर्ष', dobFrom: '2000-07-02', dobTo: '2007-07-01',
    relax: SSC_RELAX, relaxText: SSC_RELAX_TEXT, esm: SSC_ESM,
    genders: ['M', 'F'], keyCondition: 'पुरुष: LMV ड्राइविंग लाइसेंस', minQual: '12',
    qualText: ['12वीं (10+2) पास'],
    conditions: ['पुरुष: PE&MT की तारीख तक वैध LMV (मोटरसाइकिल/कार) ड्राइविंग लाइसेंस'],
    physical: {
      maleH: 170, femaleH: 157,
      lines: ['लंबाई: पुरुष 170 सेमी, महिला 157 सेमी (पहाड़ी/ST को छूट)', 'सीना (पुरुष): 81 सेमी + 4 सेमी फुलाव', 'दौड़: पुरुष 1600 मी. 6 मिनट, महिला 1600 मी. 8 मिनट'],
    },
    source: 'SSC दिल्ली पुलिस कांस्टेबल (Exe) परीक्षा अधिसूचना 2025', year: 2025,
    sourceUrl: 'https://www.resultbharat.com/SSC-Delhi-Police-Constable-Exe-2025.html', official: false,
    unverified: ['physical'],
  },

  // ───────────── DEFENCE ─────────────
  {
    id: 'army_gd', nameHi: 'अग्निवीर आर्मी — जनरल ड्यूटी (GD)', nameEn: 'Agniveer Army — General Duty', icon: '🎖️', group: 'डिफेंस',
    cutoff: null, ageText: '17½–21 वर्ष', dobFrom: '2005-10-01', dobTo: '2009-04-01',
    relax: {}, relaxText: NO_RELAX_TEXT,
    genders: ['M'], genderNote: 'महिलाओं के लिए अलग भर्ती: अग्निवीर GD (महिला मिलिट्री पुलिस)',
    keyCondition: '10वीं में कुल 45%, हर विषय 33%', minQual: '10',
    qualText: ['10वीं पास — कुल 45% और हर विषय में 33%'],
    physical: {
      maleH: 169,
      lines: ['लंबाई: क्षेत्र अनुसार (ज़्यादातर मैदानी इलाके ~169–170 सेमी; पहाड़ी क्षेत्रों में कम)', 'सीना: 77 सेमी + 5 सेमी फुलाव', 'दौड़: 1.6 किमी 5 मिनट 45 सेकंड, पुल-अप्स 10'],
    },
    source: 'भारतीय सेना अग्निवीर भर्ती अधिसूचना 2026-27 (CEE 2026)', year: 2026,
    sourceUrl: 'https://doondefenceacademy.com/indian-army-agniveer/', official: false,
    unverified: ['physical'],
  },
  {
    id: 'army_clerk', nameHi: 'अग्निवीर आर्मी — क्लर्क / स्टोर कीपर (SKT)', nameEn: 'Agniveer Army — Clerk / Store Keeper Technical', icon: '📋', group: 'डिफेंस',
    cutoff: null, ageText: '17½–21 वर्ष', dobFrom: '2005-10-01', dobTo: '2009-04-01',
    relax: {}, relaxText: NO_RELAX_TEXT,
    genders: ['M'], keyCondition: '12वीं में कुल 60%, हर विषय 50%', minQual: '12',
    qualText: ['12वीं (किसी भी स्ट्रीम) — कुल 60% और हर विषय में 50%'],
    conditions: ['12वीं में अंग्रेज़ी और गणित/अकाउंट्स/बुक-कीपिंग में 50%'],
    physical: { maleH: 162, lines: ['लंबाई: 162 सेमी', 'दौड़: 1.6 किमी 5 मिनट 45 सेकंड'] },
    source: 'भारतीय सेना अग्निवीर भर्ती अधिसूचना 2026-27 (CEE 2026)', year: 2026,
    sourceUrl: 'https://doondefenceacademy.com/indian-army-agniveer/', official: false,
  },
  {
    id: 'army_trade', nameHi: 'अग्निवीर आर्मी — ट्रेड्समैन', nameEn: 'Agniveer Army — Tradesman (10th / 8th)', icon: '🔧', group: 'डिफेंस',
    cutoff: null, ageText: '17½–21 वर्ष', dobFrom: '2005-10-01', dobTo: '2009-04-01',
    relax: {}, relaxText: NO_RELAX_TEXT,
    genders: ['M'], minQual: '10',
    qualText: ['10वीं पास — हर विषय में 33%', 'कुछ ट्रेड (हाउस कीपर, मेस कीपर): 8वीं पास'],
    physical: { maleH: 169, lines: ['लंबाई: क्षेत्र अनुसार (मैदानी इलाके ~169–170 सेमी)', 'दौड़: 1.6 किमी 5 मिनट 45 सेकंड'] },
    source: 'भारतीय सेना अग्निवीर भर्ती अधिसूचना 2026-27 (CEE 2026)', year: 2026,
    sourceUrl: 'https://doondefenceacademy.com/indian-army-agniveer/', official: false,
    unverified: ['physical'],
  },
  {
    id: 'navy_ssr', nameHi: 'अग्निवीर नेवी — SSR', nameEn: 'Agniveer Navy — SSR (Senior Secondary Recruit), batch 01/2027', icon: '⚓', group: 'डिफेंस',
    cutoff: null, ageText: '17½–22 वर्ष', dobFrom: '2004-12-01', dobTo: '2009-05-31',
    relax: {}, relaxText: NO_RELAX_TEXT,
    genders: ['M', 'F'], keyCondition: '12वीं में गणित + भौतिकी, कुल 50%', minQual: '12', diplomaAs12: true, appearingOk: true,
    qualText: ['12वीं में गणित + भौतिकी + (रसायन/जीव/कंप्यूटर में से एक) — कुल 50%', 'या 3 साल का इंजीनियरिंग डिप्लोमा (50%)'],
    conditions: ['सिर्फ़ अविवाहित उम्मीदवार'],
    physical: { maleH: 157, femaleH: 157, lines: ['लंबाई: पुरुष व महिला 157 सेमी', 'टैटू सिर्फ़ बाँह के अंदरूनी हिस्से/हथेली के पीछे'] },
    source: 'भारतीय नौसेना अग्निवीर SSR 01/2027 बैच अधिसूचना (मार्च 2026)', year: 2026,
    sourceUrl: 'https://indianexpress.com/article/education/indian-navy-agniveer-recruitment-2026-jobs-ssr-mr-medical-posts-joinindiannavy-gov-in-10575818/', official: false,
  },
  {
    id: 'navy_mr', nameHi: 'अग्निवीर नेवी — MR', nameEn: 'Agniveer Navy — MR (Matric Recruit), batch 01/2027', icon: '🚢', group: 'डिफेंस',
    cutoff: null, ageText: '17½–22 वर्ष', dobFrom: '2004-12-01', dobTo: '2009-05-31',
    relax: {}, relaxText: NO_RELAX_TEXT,
    genders: ['M', 'F'], keyCondition: '10वीं में कुल 50%', minQual: '10', appearingOk: true,
    qualText: ['10वीं पास — कुल 50% अंक'],
    conditions: ['सिर्फ़ अविवाहित उम्मीदवार'],
    physical: { maleH: 157, femaleH: 157, lines: ['लंबाई: पुरुष व महिला 157 सेमी'] },
    source: 'भारतीय नौसेना अग्निवीर MR 01/2027 व 02/2027 बैच अधिसूचना (मार्च 2026)', year: 2026,
    sourceUrl: 'https://cdn.testbook.com/1773140239480-Advt_Agniveer_MR_01_27_and_02_27_English.pdf/1773140240.pdf', official: true,
  },
  {
    id: 'airforce_vayu', nameHi: 'अग्निवीर वायु (एयर फ़ोर्स)', nameEn: 'Agniveer Vayu — Indian Air Force, intake 02/2027', icon: '✈️', group: 'डिफेंस',
    cutoff: null, ageText: '17½–22 वर्ष (भर्ती के समय अधिकतम 22)', dobFrom: '2005-07-01', dobTo: '2010-01-01',
    relax: {}, relaxText: NO_RELAX_TEXT,
    genders: ['M', 'F'], keyCondition: '12वीं में 50% और अंग्रेज़ी में 50%', minQual: '12', diplomaAs12: true, appearingOk: true,
    qualText: ['साइंस: 12वीं में भौतिकी, गणित, अंग्रेज़ी — कुल 50% और अंग्रेज़ी में 50%', 'या 3 साल का इंजीनियरिंग डिप्लोमा (50%)', 'नॉन-साइंस: 12वीं किसी भी स्ट्रीम में 50% और अंग्रेज़ी में 50%'],
    conditions: ['सिर्फ़ अविवाहित उम्मीदवार'],
    physical: { maleH: 152, femaleH: 152, lines: ['लंबाई: पुरुष 152 सेमी, महिला 152 सेमी', 'सीना (पुरुष): 77 सेमी + 5 सेमी फुलाव'] },
    source: 'भारतीय वायुसेना अग्निवीर वायु इनटेक 02/2027 अधिसूचना (2026)', year: 2026,
    sourceUrl: 'https://testbook.com/news/indian-airforce-agniveer-notification-02-2027-recruitment-out/', official: false,
    unverified: ['dob'],
  },
  {
    id: 'nda', nameHi: 'एनडीए (NDA & NA)', nameEn: 'UPSC NDA & NA (II) 2026 — Army / Navy / Air Force officer', icon: '⭐', group: 'UPSC',
    cutoff: null, ageText: '16½–19½ वर्ष', dobFrom: '2008-01-02', dobTo: '2011-01-01',
    relax: {}, relaxText: ['किसी भी वर्ग को आयु में छूट नहीं'],
    genders: ['M', 'F'], keyCondition: 'एयर फ़ोर्स/नेवी विंग के लिए 12वीं में PCM', minQual: '12', appearingOk: true,
    qualText: ['आर्मी विंग: 12वीं किसी भी स्ट्रीम में', 'एयर फ़ोर्स / नेवी विंग: 12वीं भौतिकी, रसायन व गणित के साथ', '12वीं में पढ़ रहे छात्र भी आवेदन कर सकते हैं'],
    conditions: ['सिर्फ़ अविवाहित उम्मीदवार'],
    physical: { maleH: 157, femaleH: 152, lines: ['लंबाई: पुरुष 157 सेमी (एयर फ़ोर्स 162.5), महिला 152 सेमी', 'SSB इंटरव्यू + मेडिकल'] },
    source: 'UPSC NDA & NA (II) परीक्षा अधिसूचना 2026', year: 2026,
    sourceUrl: 'https://testbook.com/news/upsc-nda-2-notification-2026-out/', official: false,
    unverified: ['physical'],
  },
  {
    id: 'capf_ac', nameHi: 'सीएपीएफ असिस्टेंट कमांडेंट', nameEn: 'UPSC CAPF Assistant Commandant (BSF, CRPF, CISF, ITBP, SSB)', icon: '🛡️', group: 'UPSC',
    cutoff: '2026-08-01', ageText: '20–25 वर्ष', dobFrom: '2001-08-02', dobTo: '2006-08-01',
    relax: SSC_RELAX, relaxText: ['OBC: +3 साल', 'SC/ST: +5 साल', 'EWS / Gen: कोई छूट नहीं'], esm: 'पूर्व सैनिक व केंद्रीय सरकारी कर्मचारी: +5 साल',
    genders: ['M', 'F'], minQual: 'grad', appearingOk: true,
    qualText: ['किसी भी विषय में ग्रेजुएशन'],
    physical: { maleH: 165, femaleH: 157, lines: ['लंबाई: पुरुष 165 सेमी, महिला 157 सेमी', 'सीना (पुरुष): 81 सेमी + 5 सेमी फुलाव', 'वज़न: पुरुष 50 किग्रा, महिला 46 किग्रा'] },
    source: 'UPSC CAPF (AC) परीक्षा अधिसूचना 2026 (20.02.2026)', year: 2026,
    sourceUrl: 'https://upsc.gov.in', official: true,
  },

  // ───────────── RAILWAY ─────────────
  {
    id: 'rrb_groupd', nameHi: 'रेलवे ग्रुप डी (लेवल-1)', nameEn: 'RRB Group D (Level-1) — CEN 09/2025', icon: '🚆', group: 'रेलवे',
    cutoff: '2026-01-01', ageText: '18–33 वर्ष', dobFrom: '1993-01-02', dobTo: '2008-01-01',
    relax: SSC_RELAX, relaxText: SSC_RELAX_TEXT, esm: 'पूर्व सैनिक: सेवा अवधि + 3 साल',
    genders: ['M', 'F'], minQual: '10', itiOk: true,
    qualText: ['10वीं पास या ITI या NAC (कोई एक)'],
    physical: { lines: ['PET: पुरुष 35 किग्रा उठाकर 100 मी. 2 मिनट में + 1 किमी दौड़ 4 मिनट 15 सेकंड', 'महिला: 20 किग्रा उठाकर 100 मी. 2 मिनट में + 1 किमी 5 मिनट 40 सेकंड'] },
    source: 'RRB ग्रुप डी CEN 09/2025 अधिसूचना', year: 2025,
    sourceUrl: 'https://testbook.com/news/rrb-group-d-apply-online-2026/', official: false,
    unverified: ['dob', 'physical'],
  },
  {
    id: 'ntpc_ug', nameHi: 'आरआरबी एनटीपीसी — 12वीं लेवल', nameEn: 'RRB NTPC Undergraduate (10+2) — CEN 07/2026', icon: '🎫', group: 'रेलवे',
    cutoff: '2027-01-01', ageText: '18–30 वर्ष', dobFrom: '1997-01-02', dobTo: '2009-01-01',
    relax: SSC_RELAX, relaxText: SSC_RELAX_TEXT, esm: 'पूर्व सैनिक: सेवा अवधि + 3 साल',
    genders: ['M', 'F'], keyCondition: 'Gen: 12वीं में 50%', minQual: '12',
    qualText: ['12वीं पास — सामान्य वर्ग के लिए 50% (SC/ST/पूर्व सैनिक: सिर्फ़ पास)', 'क्लर्क/टाइपिस्ट पदों पर टाइपिंग ज़रूरी'],
    source: 'RRB NTPC अंडरग्रेजुएट CEN 07/2026 अधिसूचना', year: 2026,
    sourceUrl: 'https://www.oliveboard.in/rrb-ntpc-eligibility-criteria/', official: false,
    unverified: ['dob'],
  },
  {
    id: 'ntpc_grad', nameHi: 'आरआरबी एनटीपीसी — ग्रेजुएट लेवल', nameEn: 'RRB NTPC Graduate — CEN 06/2026', icon: '🚄', group: 'रेलवे',
    cutoff: '2027-01-01', ageText: '18–33 वर्ष', dobFrom: '1994-01-02', dobTo: '2009-01-01',
    relax: SSC_RELAX, relaxText: SSC_RELAX_TEXT, esm: 'पूर्व सैनिक: सेवा अवधि + 3 साल',
    genders: ['M', 'F'], minQual: 'grad',
    qualText: ['किसी भी विषय में ग्रेजुएशन (आवेदन की अंतिम तारीख तक — रिज़ल्ट का इंतज़ार कर रहे पात्र नहीं)', 'क्लर्क-कम-टाइपिस्ट पदों पर टाइपिंग ज़रूरी'],
    source: 'RRB NTPC ग्रेजुएट CEN 06/2026 अधिसूचना', year: 2026,
    sourceUrl: 'https://cdn.testbook.com/1791376000619-RRB_Ranchi_CEN_06-2026_NTPC_Notice.pdf/1791376001.pdf', official: true,
  },

  // ───────────── STATE POLICE ─────────────
  {
    id: 'up_police', nameHi: 'यूपी पुलिस कांस्टेबल', nameEn: 'UP Police Constable (UPPRPB) 2025 — 32,679 posts', icon: '👮', group: 'राज्य पुलिस',
    // Base limits: male 18–22, female 18–25 as on 01.07.2025, plus the one-time 3-year relaxation
    // for ALL categories (UP govt order, Jan 2026) — already included in the dates below.
    cutoff: '2025-07-01', ageText: 'पुरुष 18–22, महिला 18–25 वर्ष (+3 साल एकमुश्त छूट सभी को)',
    dobFrom: '2000-07-02', dobFromF: '1997-07-02', dobTo: '2007-07-01',
    relax: { OBC: 5, SC: 5, ST: 5 }, relaxText: ['एकमुश्त छूट: सभी वर्गों को +3 साल (जनवरी 2026 का शासनादेश, ऊपर की तारीखों में जुड़ा है)', 'UP के OBC/SC/ST: +5 साल और', 'दूसरे राज्यों के आरक्षित उम्मीदवार: सामान्य वर्ग की तरह'],
    genders: ['M', 'F'], minQual: '12',
    qualText: ['12वीं (इंटरमीडिएट) पास'],
    conditions: ['आरक्षण/आयु छूट सिर्फ़ UP के मूल निवासियों को'],
    physical: { maleH: 168, femaleH: 152, maleHST: 160, femaleHST: 147, lines: ['लंबाई: पुरुष 168 सेमी (ST 160), महिला 152 सेमी (ST 147)', 'सीना (पुरुष): 79–84 सेमी (ST 77–82)'] },
    source: 'UPPRPB आरक्षी नागरिक पुलिस भर्ती 2025 (+ जनवरी 2026 का आयु छूट आदेश)', year: 2025,
    sourceUrl: 'https://testbook.com/up-police-constable', official: false,
    unverified: ['dob'],
  },
  {
    id: 'bihar_police', nameHi: 'बिहार पुलिस कांस्टेबल', nameEn: 'Bihar Police Constable (CSBC 01/2025) — 19,838 posts', icon: '🚨', group: 'राज्य पुलिस',
    // Ages as on 01.08.2025: min 18; max UR 25, BC/EBC male 27, BC/EBC female 28, SC/ST 30.
    // Treated as "completed years ≤ max" (born on/after 02.08.1999 for UR).
    cutoff: '2025-08-01', ageText: '18–25 वर्ष (UR)', dobFrom: '1999-08-02', dobTo: '2007-08-01',
    relax: { OBC: 2, SC: 5, ST: 5 }, relaxF: { OBC: 3, SC: 5, ST: 5 },
    relaxText: ['BC/EBC पुरुष: 27 साल तक', 'BC/EBC महिला: 28 साल तक', 'SC/ST (पुरुष व महिला): 30 साल तक', 'UR / EWS: 25 साल तक'],
    genders: ['M', 'F'], minQual: '12',
    qualText: ['12वीं (इंटरमीडिएट) पास'],
    conditions: ['आरक्षण सिर्फ़ बिहार के मूल निवासियों को (यहाँ OBC = BC/EBC)'],
    physical: { maleH: 165, femaleH: 155, maleHST: 160, lines: ['लंबाई: पुरुष UR/BC 165 सेमी, EBC/SC/ST 160 सेमी; महिला 155 सेमी', 'सीना (पुरुष): UR/BC/EBC 81–86, SC/ST 79–84 सेमी', 'दौड़: पुरुष 1.6 किमी 6 मिनट, महिला 1 किमी 5 मिनट'] },
    source: 'CSBC बिहार पुलिस सिपाही भर्ती विज्ञापन 01/2025', year: 2025,
    sourceUrl: 'https://www.resultbharat.com/CSBC-Constable-Advt-No-01_2025.html', official: false,
    unverified: ['dob'],
  },
  {
    id: 'raj_police', nameHi: 'राजस्थान पुलिस कांस्टेबल', nameEn: 'Rajasthan Police Constable 2025 (GD)', icon: '🏜️', group: 'राज्य पुलिस',
    cutoff: '2026-01-01', ageText: 'पुरुष 18–23, महिला 18–28 वर्ष (UR)',
    dobFrom: '2002-01-02', dobFromF: '1997-01-02', dobTo: '2008-01-01',
    relax: { OBC: 5, EWS: 5, SC: 5, ST: 5 }, relaxF: { OBC: 5, EWS: 5, SC: 5, ST: 5 },
    relaxText: ['राजस्थान के SC/ST/OBC/MBC/EWS पुरुष: +5 साल', 'UR महिला: +5 साल (ऊपर की तारीख में जुड़ा है)', 'आरक्षित वर्ग की महिला: +10 साल'],
    genders: ['M', 'F'], keyCondition: 'राजस्थान CET (12वीं स्तर) पास', minQual: '12',
    qualText: ['12वीं (सीनियर सेकेंडरी) पास', 'राजस्थान CET (12वीं स्तर) पास होना ज़रूरी'],
    conditions: ['आरक्षण सिर्फ़ राजस्थान के मूल निवासियों को'],
    physical: { maleH: 168, femaleH: 152, lines: ['लंबाई: पुरुष 168 सेमी, महिला 152 सेमी (सहरिया आदि जनजाति को छूट)', 'सीना (पुरुष): 81–86 सेमी', 'दौड़: पुरुष 5 किमी 25 मिनट, महिला 5 किमी 35 मिनट'] },
    source: 'राजस्थान पुलिस कांस्टेबल भर्ती 2025 अधिसूचना', year: 2025,
    sourceUrl: 'https://vacancyinindia.com/govt-job/317', official: false,
    unverified: ['relax', 'physical'],
  },
];
