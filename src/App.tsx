import React, { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { 
  Volume2, VolumeX, ArrowLeft, 
  CheckCircle2, XCircle, Clock, 
  RotateCcw, Sparkles, Calculator, Flame, Sun, Moon, Copy, ChevronRight, Award, Zap,
  Check, BookOpen, ChevronDown, ChevronUp, ExternalLink,
  Code, Eye, Maximize2, Minimize2, RefreshCw, Play,
  Plus, Edit3, Trash2, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  loadStudyBullApp, 
  subscribeToAdminUpdates, 
  recordUserAttempt,
  syncExistingContentToSupabase
} from './lib/supabase.ts';

// Error Boundary to prevent any blank or white screen crashes
interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackView: () => void;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class SafeErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App Error caught by SafeErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl border border-slate-200">
            <div className="w-16 h-16 bg-blue-100 text-blue-700 rounded-2xl mx-auto flex items-center justify-center text-3xl mb-4">
              🐂
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Study Bull App</h2>
            <p className="text-sm text-slate-600 mb-6">
              पेज लोड करने में कोई समस्या हुई। कृपया होम स्क्रीन पर लौटें।
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                this.props.fallbackView();
              }}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow transition"
            >
              होम स्क्रीन पर जाएं
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Gentle, Soft Sound System
// Only plays on Question Answers and Result screens. NEVER on regular button taps!
const playGentleSound = (type: 'correct' | 'wrong' | 'celebrate', muted: boolean) => {
  if (muted) return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Soft, delicate volume (0.012 to 0.018 gain)
    if (type === 'correct') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.04); // E5
      gain.gain.setValueAtTime(0.015, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } else if (type === 'wrong') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, ctx.currentTime);
      osc.frequency.setValueAtTime(220, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.014, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } else if (type === 'celebrate') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
      osc.frequency.setValueAtTime(554.37, ctx.currentTime + 0.05); // C#5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.10); // E5
      gain.gain.setValueAtTime(0.018, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    }
  } catch {
    // Graceful fallback for audio policy
  }
};

type ViewState = 
  | 'home' 
  | 'quiz_categories' 
  | 'quiz_play' 
  | 'quiz_result' 
  | 'mock_play' 
  | 'mock_result' 
  | 'notes_lib' 
  | 'notes_reader' 
  | 'calc_setup' 
  | 'calc_practice' 
  | 'calc_result' 
  | 'typing_setup' 
  | 'typing_practice' 
  | 'typing_result'
  | 'custom_node';

export interface QuizQuestion {
  id: number;
  question: string;
  questionEn: string;
  options: string[];
  optionsEn: string[];
  correct: number;
  explanation: string;
  explanationEn: string;
  shortcut?: string;
  category?: string;
}

interface Chapter {
  id: string;
  title: string;
  titleEn: string;
  subtitle: string;
  content: string;
}

// 1. Curated Real Exam MCQs for Subject Quiz
const QUIZ_SUBJECTS = [
  {
    id: 'polity',
    title: 'भारतीय राजव्यवस्था',
    titleEn: 'Polity & Constitution',
    subtitle: 'संविधान, अनुच्छेद, मौलिक अधिकार',
    subtitleEn: 'Constitution, Articles & Rights',
    icon: '⚖️',
    questions: [
      {
        id: 1,
        question: 'भारतीय संविधान सभा की प्रथम बैठक कब आयोजित की गई थी?',
        questionEn: 'When was the first meeting of the Indian Constituent Assembly held?',
        options: ['9 दिसंबर 1946', '11 दिसंबर 1946', '26 जनवरी 1950', '15 अगस्त 1947'],
        optionsEn: ['9 December 1946', '11 December 1946', '26 January 1950', '15 August 1947'],
        correct: 0,
        explanation: 'संविधान सभा की प्रथम बैठक 9 दिसंबर 1946 को काउंसिल चैंबर, नई दिल्ली में हुई थी, जिसके अस्थायी अध्यक्ष डॉ. सच्चिदानंद सिन्हा थे।',
        explanationEn: 'The first meeting was on 9 December 1946 presided by Dr. Sachchidananda Sinha.'
      },
      {
        id: 2,
        question: 'प्रस्तावना में "धर्मनिरपेक्ष", "समाजवादी" और "अखंडता" शब्द किस संशोधन द्वारा जोड़े गए?',
        questionEn: 'By which constitutional amendment were "Secular", "Socialist" and "Integrity" added to the Preamble?',
        options: ['42वां संशोधन (1976)', '44वां संशोधन (1978)', '86वां संशोधन (2002)', '103वां संशोधन (2019)'],
        optionsEn: ['42nd Amendment (1976)', '44th Amendment (1978)', '86th Amendment (2002)', '103rd Amendment (2019)'],
        correct: 0,
        explanation: '42वें संविधान संशोधन अधिनियम (1976) जिसे "लघु संविधान" भी कहा जाता है, द्वारा प्रस्तावना में ये शब्द जोड़े गए।',
        explanationEn: '42nd Amendment Act 1976 added these three terms to the Preamble.'
      },
      {
        id: 3,
        question: 'संविधान के किस अनुच्छेद को डॉ. बी.आर. अंबेडकर ने "संविधान का हृदय और आत्मा" कहा था?',
        questionEn: 'Which Article was termed as the "Heart and Soul of the Constitution" by Dr. B.R. Ambedkar?',
        options: ['अनुच्छेद 32 (संवैधानिक उपचारों का अधिकार)', 'अनुच्छेद 14 (समानता का अधिकार)', 'अनुच्छेद 19 (स्वतंत्रता का अधिकार)', 'अनुच्छेद 21 (प्राण व दैहिक स्वतंत्रता)'],
        optionsEn: ['Article 32 (Constitutional Remedies)', 'Article 14 (Equality)', 'Article 19 (Freedom)', 'Article 21 (Life & Liberty)'],
        correct: 0,
        explanation: 'अनुच्छेद 32 के तहत सर्वोच्च न्यायालय मौलिक अधिकारों के प्रवर्तन के लिए 5 प्रकार की रिट ( बंदी प्रत्यक्षीकरण, परमादेश, आदि) जारी करता है।',
        explanationEn: 'Article 32 provides the right to Constitutional Remedies and empowers the Supreme Court to issue writs.'
      },
      {
        id: 4,
        question: 'भारत के राष्ट्रपति को पद एवं गोपनीयता की शपथ कौन दिलाता है?',
        questionEn: 'Who administers the oath of office to the President of India?',
        options: ['भारत का मुख्य न्यायाधीश (CJI)', 'उपराष्ट्रपति', 'प्रधानमंत्री', 'लोकसभा अध्यक्ष'],
        optionsEn: ['Chief Justice of India (CJI)', 'Vice President', 'Prime Minister', 'Lok Sabha Speaker'],
        correct: 0,
        explanation: 'अनुच्छेद 60 के अनुसार भारत के मुख्य न्यायाधीश या उनकी अनुपस्थिति में वरिष्ठतम न्यायाधीश राष्ट्रपति को शपथ दिलाते हैं।',
        explanationEn: 'Under Article 60, the Chief Justice of India administers the oath to the President.'
      },
      {
        id: 5,
        question: 'मौलिक कर्तव्यों (Fundamental Duties) को किस समिति की सिफारिश पर संविधान में जोड़ा गया था?',
        questionEn: 'On the recommendation of which committee were Fundamental Duties added to the Constitution?',
        options: ['स्वर्ण सिंह समिति', 'सरकारिया आयोग', 'बलवंत राय मेहता समिति', 'वर्मा समिति'],
        optionsEn: ['Swaran Singh Committee', 'Sarkaria Commission', 'Balwant Rai Mehta Committee', 'Verma Committee'],
        correct: 0,
        explanation: 'स्वर्ण सिंह समिति की सिफारिश पर 42वें संशोधन (1976) द्वारा भाग 4(A) और अनुच्छेद 51(A) में 10 मौलिक कर्तव्य जोड़े गए (वर्तमान में 11 हैं)।',
        explanationEn: 'Swaran Singh Committee recommended Fundamental Duties, added via 42nd Amendment 1976.'
      }
    ]
  },
  {
    id: 'history',
    title: 'भारतीय इतिहास',
    titleEn: 'Indian History',
    subtitle: 'प्राचीन, मध्यकालीन एवं आधुनिक भारत',
    subtitleEn: 'Ancient, Medieval & Modern India',
    icon: '🏛️',
    questions: [
      {
        id: 1,
        question: 'हड़प्पा सभ्यता की खोज किस वर्ष और किसने की थी?',
        questionEn: 'In which year and by whom was the Harappan civilization discovered?',
        options: ['1921 में दयाराम साहनी', '1922 में राखालदास बनर्जी', '1924 में जॉन मार्शल', '1928 में कनिंघम'],
        optionsEn: ['1921 by Dayaram Sahni', '1922 by R.D. Banerjee', '1924 by John Marshall', '1928 by Cunningham'],
        correct: 0,
        explanation: 'रायबहादुर दयाराम साहनी ने 1921 में रावी नदी के तट पर स्थित हड़प्पा स्थल का उत्खनन कार्य शुरू किया था।',
        explanationEn: 'Dayaram Sahni discovered Harappa site in 1921 on the banks of river Ravi.'
      },
      {
        id: 2,
        question: '1857 के प्रथम स्वतंत्रता संग्राम की शुरुआत किस छावनी से हुई थी?',
        questionEn: 'From which cantonment did the First War of Independence in 1857 start?',
        options: ['मेरठ छावनी', 'बैरकपुर छावनी', 'झांसी', 'दिल्ली'],
        optionsEn: ['Meerut Cantonment', 'Barrackpore Cantonment', 'Jhansi', 'Delhi'],
        correct: 0,
        explanation: '10 मई 1857 को मेरठ छावनी के भारतीय सैनिकों ने विद्रोह की औपचारिक शुरुआत की और दिल्ली कूच किया।',
        explanationEn: 'The uprising formally broke out at Meerut on May 10, 1857.'
      },
      {
        id: 3,
        question: 'जलियांवाला बाग नरसंहार की घटना किस तारीख को घटित हुई थी?',
        questionEn: 'On which date did the Jallianwala Bagh massacre take place?',
        options: ['13 अप्रैल 1919', '10 मई 1919', '15 अगस्त 1920', '26 जनवरी 1919'],
        optionsEn: ['13 April 1919', '10 May 1919', '15 August 1920', '26 January 1919'],
        correct: 0,
        explanation: '13 अप्रैल 1919 (बैसाखी के दिन) अमृतसर में जनरल डायर ने शांतिपूर्ण सभा पर गोलियां चलवाईं जिसमें सैकड़ों निर्दोष मारे गए।',
        explanationEn: 'The massacre took place on 13 April 1919 on Baisakhi day in Amritsar.'
      },
      {
        id: 4,
        question: 'पानीपत की पहली लड़ाई (1526) किनके बीच लड़ी गई थी?',
        questionEn: 'Between whom was the First Battle of Panipat (1526) fought?',
        options: ['बाबर और इब्राहिम लोदी', 'अकबर और हेमू', 'अहमद शाह अब्दाली और मराठा', 'बाबर और राणा सांगा'],
        optionsEn: ['Babar and Ibrahim Lodi', 'Akbar and Hemu', 'Ahmad Shah Abdali and Marathas', 'Babar and Rana Sanga'],
        correct: 0,
        explanation: '21 अप्रैल 1526 को बाबर ने इब्राहिम लोदी को पराजित कर भारत में मुगल साम्राज्य की नींव रखी।',
        explanationEn: 'Babar defeated Ibrahim Lodi in 1526, laying the foundation of Mughal Empire.'
      },
      {
        id: 5,
        question: '"करो या मरो" का नारा महात्मा गांधी ने किस आंदोलन के दौरान दिया था?',
        questionEn: 'During which movement did Mahatma Gandhi give the slogan "Do or Die"?',
        options: ['भारत छोड़ो आंदोलन (1942)', 'असहयोग आंदोलन (1920)', 'सविनय अवज्ञा आंदोलन (1930)', 'चंपारण सत्याग्रह (1917)'],
        optionsEn: ['Quit India Movement (1942)', 'Non-Cooperation Movement (1920)', 'Civil Disobedience (1930)', 'Champaran (1917)'],
        correct: 0,
        explanation: '8 अगस्त 1942 को बॉम्बे के ग्वालिया टैंक मैदान से भारत छोड़ो आंदोलन शुरू करते हुए गांधीजी ने यह नारा दिया था।',
        explanationEn: 'Gandhi gave "Do or Die" call at the launch of Quit India Movement in August 1942.'
      }
    ]
  },
  {
    id: 'geography',
    title: 'भूगोल एवं पर्यावरण',
    titleEn: 'Geography & Environment',
    subtitle: 'नदियां, पर्वत, जलवायु व राष्ट्रीय उद्यान',
    subtitleEn: 'Rivers, Mountains, Climate & Parks',
    icon: '🌍',
    questions: [
      {
        id: 1,
        question: 'भारत की सबसे लंबी नदी कौन सी है?',
        questionEn: 'Which is the longest river in India?',
        options: ['गंगा (2525 किमी)', 'गोदावरी (1465 किमी)', 'ब्रह्मपुत्र', 'यमुना'],
        optionsEn: ['Ganga (2525 km)', 'Godavari (1465 km)', 'Brahmaputra', 'Yamuna'],
        correct: 0,
        explanation: 'गंगा नदी भारत की सबसे लंबी नदी है जिसकी कुल लंबाई 2525 किमी है और यह भारत और बांग्लादेश से होकर बहती है।',
        explanationEn: 'Ganga is the longest river in India with a length of 2525 km.'
      },
      {
        id: 2,
        question: 'भारत का एकमात्र सक्रिय ज्वालामुखी कहाँ स्थित है?',
        questionEn: 'Where is the only active volcano of India located?',
        options: ['बैरन द्वीप (अंडमान निकोबार)', 'नारकोंडम द्वीप', 'लक्षद्वीप', 'दीव'],
        optionsEn: ['Barren Island (Andaman)', 'Narcondam Island', 'Lakshadweep', 'Diu'],
        correct: 0,
        explanation: 'बैरन द्वीप अंडमान सागर में स्थित भारत तथा दक्षिण एशिया का एकमात्र सक्रिय ज्वालामुखी है।',
        explanationEn: 'Barren Island in Andaman Sea is the only active volcano in South Asia.'
      },
      {
        id: 3,
        question: 'कर्क रेखा (Tropic of Cancer) भारत के कितने राज्यों से होकर गुजरती है?',
        questionEn: 'Through how many Indian states does the Tropic of Cancer pass?',
        options: ['8 राज्य', '7 राज्य', '9 राज्य', '6 राज्य'],
        optionsEn: ['8 States', '7 States', '9 States', '6 States'],
        correct: 0,
        explanation: 'कर्क रेखा (23.5° N) 8 राज्यों: गुजरात, राजस्थान, मध्य प्रदेश, छत्तीसगढ़, झारखंड, पश्चिम बंगाल, त्रिपुरा और मिजोरम से गुजरती है।',
        explanationEn: 'Tropic of Cancer passes through 8 states in India.'
      },
      {
        id: 4,
        question: 'काजीरंगा राष्ट्रीय उद्यान किस राज्य में स्थित है और यह किसके लिए प्रसिद्ध है?',
        questionEn: 'In which state is Kaziranga National Park located and what is it famous for?',
        options: ['असम (एक सींग वाला गैंडा)', 'मध्य प्रदेश (बाघ)', 'गुजरात (एशियाई शेर)', 'केरल (हाथी)'],
        optionsEn: ['Assam (One-horned Rhino)', 'Madhya Pradesh (Tiger)', 'Gujarat (Asiatic Lion)', 'Kerala (Elephant)'],
        correct: 0,
        explanation: 'काजीरंगा राष्ट्रीय उद्यान असम में स्थित है और यह विश्व प्रसिद्ध एक सींग वाले गैंडे (Great Indian One-horned Rhino) का प्राकृतिक आवास है।',
        explanationEn: 'Kaziranga in Assam is world famous for the Great Indian One-horned Rhinoceros.'
      },
      {
        id: 5,
        question: 'भारत की मानक समय रेखा (IST) किस देशांतर से निर्धारित होती है?',
        questionEn: 'From which longitude is the Indian Standard Time (IST) determined?',
        options: ['82.5° पूर्वी देशांतर (मिर्जापुर/प्रयागराज)', '80.0° पूर्वी देशांतर', '75.5° पूर्वी देशांतर', '90.0° पूर्वी देशांतर'],
        optionsEn: ['82.5° East Longitude (Prayagraj)', '80.0° East', '75.5° East', '90.0° East'],
        correct: 0,
        explanation: 'भारत का मानक समय 82°30\' पूर्वी देशांतर से लिया गया है जो ग्रीनविच समय (GMT) से 5 घंटे 30 मिनट आगे है।',
        explanationEn: 'IST is calculated from 82.5° E longitude, which is UTC+05:30.'
      }
    ]
  }
];

// 2. Full-Length Real Mock Test Series
const MOCK_TEST_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: 'भारतीय संविधान में "मौलिक अधिकार" किस देश के संविधान से प्रेरित होकर लिए गए हैं?',
    questionEn: 'From which country\'s constitution were "Fundamental Rights" adopted in India?',
    options: ['संयुक्त राज्य अमेरिका (USA)', 'यूनाइटेड किंगडम (UK)', 'रूस (USSR)', 'आयरलैंड'],
    optionsEn: ['United States (USA)', 'United Kingdom (UK)', 'Russia (USSR)', 'Ireland'],
    correct: 0,
    explanation: 'भारतीय संविधान में मौलिक अधिकार (भाग 3) अमेरिकी संविधान के "बिल ऑफ राइट्स" से प्रेरित हैं।',
    explanationEn: 'Fundamental Rights in Part III were inspired by the US Bill of Rights.'
  },
  {
    id: 2,
    question: 'सौरमंडल का सबसे गर्म ग्रह कौन सा है?',
    questionEn: 'Which is the hottest planet in the Solar System?',
    options: ['शुक्र (Venus)', 'बुध (Mercury)', 'मंगल (Mars)', 'बृहस्पति (Jupiter)'],
    optionsEn: ['Venus', 'Mercury', 'Mars', 'Jupiter'],
    correct: 0,
    explanation: 'शुक्र के वायुमंडल में 96% से अधिक कार्बन डाइऑक्साइड होने के कारण तीव्र ग्रीनहाउस प्रभाव से यह सबसे गर्म (लगभग 465°C) ग्रह है।',
    explanationEn: 'Venus is the hottest planet due to dense CO2 atmosphere and runaway greenhouse effect.'
  },
  {
    id: 3,
    question: 'यदि 15 वस्तुओं का क्रय मूल्य (CP) 12 वस्तुओं के विक्रय मूल्य (SP) के बराबर हो, तो लाभ प्रतिशत क्या होगा?',
    questionEn: 'If Cost Price of 15 articles equals Selling Price of 12 articles, what is the profit percentage?',
    options: ['25%', '20%', '30%', '15%'],
    optionsEn: ['25%', '20%', '30%', '15%'],
    correct: 0,
    explanation: 'लाभ % = [(15 - 12) ÷ 12] × 100 = (3 ÷ 12) × 100 = 25%।',
    explanationEn: 'Profit % = [(15 - 12) / 12] * 100 = 25%.'
  },
  {
    id: 4,
    question: 'अंतर्राष्ट्रीय मुद्रा कोष (IMF) तथा विश्व बैंक का मुख्यालय कहाँ स्थित है?',
    questionEn: 'Where are the headquarters of IMF and World Bank located?',
    options: ['वॉशिंगटन डी.सी. (USA)', 'जिनेवा (स्विट्जरलैंड)', 'न्यूयॉर्क (USA)', 'पेरिस (फ्रांस)'],
    optionsEn: ['Washington D.C. (USA)', 'Geneva (Switzerland)', 'New York (USA)', 'Paris (France)'],
    correct: 0,
    explanation: 'IMF और विश्व बैंक दोनों की स्थापना 1944 के ब्रेटन वुड्स सम्मेलन में हुई थी तथा दोनों का मुख्यालय वॉशिंगटन डी.सी. में है।',
    explanationEn: 'Both institutions were established at Bretton Woods in 1944 with headquarters in Washington D.C.'
  },
  {
    id: 5,
    question: 'कंप्यूटर और स्मार्टफोन में मुख्य प्रोसेसिंग यूनिट (CPU) का प्रमुख घटक क्या होता है?',
    questionEn: 'What is the primary component of a CPU (Central Processing Unit)?',
    options: ['ALU और कंट्रोल यूनिट (CU)', 'रैम और रोम', 'हार्ड डिस्क', 'पावर सप्लाई'],
    optionsEn: ['ALU and Control Unit (CU)', 'RAM and ROM', 'Hard Disk', 'Power Supply'],
    correct: 0,
    explanation: 'CPU में अंकगणितीय व तार्किक कार्यों के लिए ALU (Arithmetic Logic Unit) तथा नियंत्रण के लिए Control Unit (CU) मुख्य घटक हैं।',
    explanationEn: 'CPU mainly consists of ALU and Control Unit.'
  }
];

// 3. Clear Notes Reading Library
const NOTES_CHAPTERS: Chapter[] = [
  {
    id: 'ch-1',
    title: 'मुद्रास्फीति, आरबीआई एवं मौद्रिक नीति',
    titleEn: 'Inflation, RBI & Monetary Policy',
    subtitle: 'भारतीय अर्थव्यवस्था • परीक्षा स्पेशल',
    content: `# मुद्रास्फीति (Inflation) एवं भारतीय मौद्रिक नीति\n\n## 1. मुख्य अवधारणाएँ\n- **मुद्रास्फीति (Inflation)**: वस्तुओं एवं सेवाओं के सामान्य मूल्य स्तर में निरंतर होने वाली वृद्धि, जिससे मुद्रा की क्रय शक्ति घट जाती है।\n- **भारतीय रिजर्व बैंक (RBI)**: देश का सर्वोच्च केंद्रीय बैंक। स्थापना 1 अप्रैल 1935 (हिल्टन यंग आयोग की सिफारिश पर)। राष्ट्रीयकरण 1 जनवरी 1949।\n\n## 2. मौद्रिक नीति के प्रमुख उपकरण\n- **रेपो दर (Repo Rate)**: वह अल्पकालिक ब्याज दर जिस पर आरबीआई वाणिज्यिक बैंकों को उनकी आवश्यकता हेतु ऋण प्रदान करता है।\n- **रिवर्स रेपो दर (Reverse Repo Rate)**: वह दर जिस पर वाणिज्यिक बैंक अपनी अधिशेष नकदी आरबीआई के पास जमा करते हैं।\n- **CRR (नकद आरक्षित अनुपात)**: बैंकों को अपनी कुल जमा का एक निश्चित प्रतिशत अनिवार्य रूप से आरबीआई के पास नकद रखना पड़ता है।\n- **SLR (वैधानिक तरलता अनुपात)**: बैंकों को अपनी जमा का निश्चित अंश स्वर्ण, सरकारी प्रतिभूतियों या नकदी में सुरक्षित रखना होता है।\n\n💡 मास्टर ट्रिक: महँगाई (Inflation) को नियंत्रित करने के लिए आरबीआई रेपो रेट बढ़ाता है, जिससे बाजार में तरलता (Money Supply) कम हो जाती है।`
  },
  {
    id: 'ch-2',
    title: 'केंद्रीय बजट, प्रत्यक्ष एवं अप्रत्यक्ष कर (GST)',
    titleEn: 'Union Budget, Direct & Indirect Taxes (GST)',
    subtitle: 'वित्तीय प्रणाली • आवश्यक प्रावधान',
    content: `# केंद्रीय बजट एवं भारतीय कर प्रणाली\n\n## 1. संवैधानिक प्रावधान (अनुच्छेद 112)\n- संविधान में 'बजट' शब्द का प्रयोग नहीं है, बल्कि इसे **"वार्षिक वित्तीय विवरण" (Annual Financial Statement)** कहा गया है।\n- बजट वित्त मंत्री द्वारा संसद में प्रस्तुत किया जाता है।\n\n## 2. करों का वर्गीकरण\n- **प्रत्यक्ष कर (Direct Tax)**: जिस व्यक्ति पर कर लगाया जाता है, वही उसका भुगतान करता है। उदाहरण: आयकर (Income Tax), निगम कर (Corporate Tax)।\n- **अप्रत्यक्ष कर (Indirect Tax)**: कर का भार अंतिम उपभोक्ता पर स्थानांतरित किया जाता है। उदाहरण: जीएसटी (GST), सीमा शुल्क (Customs Duty)।\n\n## 3. वस्तु एवं सेवा कर (GST)\n- लागू तिथि: 1 जुलाई 2017।\n- संवैधानिक संशोधन: 101वाँ संविधान संशोधन अधिनियम 2016।\n- GST परिषद के अध्यक्ष: केंद्रीय वित्त मंत्री (अनुच्छेद 279A)।\n\n💡 मास्टर ट्रिक: जीएसटी एक गंतव्य आधारित (Destination-based) अप्रत्यक्ष कर है जो "एक राष्ट्र, एक कर" के सिद्धांत पर आधारित है।`
  },
  {
    id: 'ch-3',
    title: 'संविधान सभा, मौलिक अधिकार एवं कर्तव्य',
    titleEn: 'Constituent Assembly & Fundamental Rights',
    subtitle: 'भारतीय राजव्यवस्था • त्वरित रिवीज़न',
    content: `# संविधान सभा एवं मौलिक अधिकार\n\n## 1. संविधान निर्माण के ऐतिहासिक तथ्य\n- कुल समय: 2 वर्ष, 11 माह और 18 दिन।\n- प्रारूप समिति (Drafting Committee) के अध्यक्ष: डॉ. भीमराव अंबेडकर।\n- संविधान अंगीकृत: 26 नवंबर 1949 (विधि दिवस / संविधान दिवस)।\n- पूर्ण रूप से लागू: 26 जनवरी 1950 (गणतंत्र दिवस)।\n\n## 2. मौलिक अधिकार (भाग 3, अनुच्छेद 12 से 35)\n1. समानता का अधिकार (अनुच्छेद 14-18)\n2. स्वतंत्रता का अधिकार (अनुच्छेद 19-22)\n3. शोषण के विरुद्ध अधिकार (अनुच्छेद 23-24)\n4. धार्मिक स्वतंत्रता का अधिकार (अनुच्छेद 25-28)\n5. संस्कृति और शिक्षा संबंधी अधिकार (अनुच्छेद 29-30)\n6. संवैधानिक उपचारों का अधिकार (अनुच्छेद 32)\n\n💡 मास्टर ट्रिक: 44वें संविधान संशोधन (1978) द्वारा संपत्ति के अधिकार को मौलिक अधिकारों से हटाकर अनुच्छेद 300(A) के तहत केवल एक विधिक (कानूनी) अधिकार बना दिया गया।`
  }
];

// Helper to calculate greatest common divisor
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

// Comprehensive Math Subjects List for Speed Calculation
export const ALL_MATH_TOPICS: string[] = [
  'मिश्रित (सभी विषय)',
  'जोड़ (Addition)',
  'घटाव (Subtraction)',
  'गुणा (Multiplication)',
  'भाग (Division)',
  'जोड़ व घटाव (Add & Subtract)',
  'गुणा व भाग (Multiply & Divide)',
  'सरलीकरण (BODMAS)',
  'प्रतिशत (Percentage)',
  'वर्ग व वर्गमूल (Squares & Roots)',
  'घन व घनमूल (Cubes & Roots)',
  'भिन्न व दशमलव (Fractions & Decimals)',
  'औसत (Average)',
  'अनुपात व समानुपात (Ratio & Proportion)',
  'साधारण ब्याज (Simple Interest)',
  'लाभ व हानि (Profit & Loss)',
  'समय व कार्य (Time & Work)',
  'समय, चाल व दूरी (Time & Distance)'
];

// 100% Mathematically Proven Unlimited Question Generator Across All Topics
// Generates unique, non-repeating questions with genuine formulas, zero errors, and authentic Vedic/mental math shortcuts
function generateUnlimitedMathQuestion(
  topic: string,
  indexSeed: number,
  difficulty: 'सरल' | 'मध्यम' | 'कठिन' | 'प्रो' = 'मध्यम',
  seenSignatures?: Set<string>
): QuizQuestion {
  const baseTopics = ALL_MATH_TOPICS.filter(t => !t.includes('मिश्रित'));

  let attempts = 0;
  let finalQ: QuizQuestion | null = null;

  while (attempts < 60) {
    attempts++;
    let chosenTopic = topic;
    if (topic.includes('मिश्रित')) {
      chosenTopic = baseTopics[Math.floor(Math.random() * baseTopics.length)];
    }

    let qText = '';
    let qTextEn = '';
    let ansStr = '';
    let explanation = '';
    let explanationEn = '';
    let shortcut = '';
    let distractors: string[] = [];

    // 1. जोड़ (Addition)
    if (chosenTopic.includes('जोड़ (Addition)')) {
      if (difficulty === 'सरल') {
        const a = Math.floor(Math.random() * 80) + 15;
        const b = Math.floor(Math.random() * 80) + 12;
        const ans = a + b;
        qText = `मान ज्ञात कीजिए: ${a} + ${b} = ?`;
        qTextEn = `Evaluate: ${a} + ${b} = ?`;
        ansStr = `${ans}`;
        explanation = `इकाई और दहाई जोड़ें:\n${a} + ${b} = ${ans}।`;
        explanationEn = `Step-by-step addition: ${a} + ${b} = ${ans}.`;
        shortcut = `मानसिक जोड़: (${Math.floor(a / 10) * 10} + ${Math.floor(b / 10) * 10}) + (${a % 10} + ${b % 10}) = ${ans}`;
        distractors = [`${ans + 10}`, `${ans - 10}`, `${ans + 2}`, `${ans - 2}`];
      } else if (difficulty === 'मध्यम') {
        const isThree = Math.random() > 0.5;
        if (isThree) {
          const a = Math.floor(Math.random() * 85) + 25;
          const b = Math.floor(Math.random() * 85) + 25;
          const c = Math.floor(Math.random() * 85) + 15;
          const ans = a + b + c;
          qText = `तीनों संख्याओं का योग क्या होगा: ${a} + ${b} + ${c} = ?`;
          qTextEn = `Calculate the sum: ${a} + ${b} + ${c} = ?`;
          ansStr = `${ans}`;
          explanation = `चरण 1: ${a} + ${b} = ${a + b}\nचरण 2: ${a + b} + ${c} = ${ans}।`;
          explanationEn = `Step 1: ${a} + ${b} = ${a + b}. Step 2: ${a + b} + ${c} = ${ans}.`;
          shortcut = `जोड़ विधि: समूह बनाकर तेजी से जोड़ें = ${ans}`;
          distractors = [`${ans + 10}`, `${ans - 10}`, `${ans + 5}`, `${ans - 5}`];
        } else {
          const a = Math.floor(Math.random() * 800) + 120;
          const b = Math.floor(Math.random() * 800) + 120;
          const ans = a + b;
          qText = `मान ज्ञात कीजिए: ${a} + ${b} = ?`;
          qTextEn = `Evaluate: ${a} + ${b} = ?`;
          ansStr = `${ans}`;
          explanation = `सैकड़ा, दहाई व इकाई का योग:\n${a} + ${b} = ${ans}।`;
          explanationEn = `Place-value addition: ${a} + ${b} = ${ans}.`;
          shortcut = `निकटतम पूर्णांक विधि: ${a} + ${b} = ${ans}`;
          distractors = [`${ans + 20}`, `${ans - 20}`, `${ans + 10}`, `${ans - 10}`];
        }
      } else if (difficulty === 'कठिन') {
        const a = Math.floor(Math.random() * 7500) + 1500;
        const b = Math.floor(Math.random() * 7500) + 1500;
        const ans = a + b;
        qText = `मान ज्ञात कीजिए: ${a} + ${b} = ?`;
        qTextEn = `Evaluate: ${a} + ${b} = ?`;
        ansStr = `${ans}`;
        explanation = `स्तम्भ जोड़ (Column Addition):\n  ${a}\n+ ${b}\n= ${ans}।`;
        explanationEn = `Standard column addition: ${a} + ${b} = ${ans}.`;
        shortcut = `हजारों और सैकड़ों को अलग-अलग जोड़कर त्वरित हल = ${ans}`;
        distractors = [`${ans + 100}`, `${ans - 100}`, `${ans + 50}`, `${ans - 50}`];
      } else {
        // प्रो (Pro)
        const a = Math.floor(Math.random() * 65000) + 15000;
        const b = Math.floor(Math.random() * 65000) + 15000;
        const ans = a + b;
        qText = `त्वरित गणना: ${a} + ${b} = ?`;
        qTextEn = `Speed addition: ${a} + ${b} = ?`;
        ansStr = `${ans}`;
        explanation = `बड़ी संख्याओं का योग:\n${a} + ${b} = ${ans}।`;
        explanationEn = `Large number addition: ${a} + ${b} = ${ans}.`;
        shortcut = `बाएं से दाएं (Left-to-right) वैदिक विधि = ${ans}`;
        distractors = [`${ans + 200}`, `${ans - 200}`, `${ans + 100}`, `${ans - 100}`];
      }
    }
    // 2. घटाव (Subtraction)
    else if (chosenTopic.includes('घटाव (Subtraction)')) {
      if (difficulty === 'सरल') {
        const a = Math.floor(Math.random() * 70) + 30;
        const b = Math.floor(Math.random() * (a - 15)) + 10;
        const ans = a - b;
        qText = `मान ज्ञात कीजिए: ${a} - ${b} = ?`;
        qTextEn = `Evaluate: ${a} - ${b} = ?`;
        ansStr = `${ans}`;
        explanation = `घटाव प्रक्रिया:\n${a} - ${b} = ${ans}।`;
        explanationEn = `Step subtraction: ${a} - ${b} = ${ans}.`;
        shortcut = `उल्टा जोड़ (Counting up): ${b} में कितना जोड़ें कि ${a} आ जाए? उत्तर = ${ans}`;
        distractors = [`${ans + 10}`, `${ans - 10}`, `${ans + 2}`, `${ans - 2}`];
      } else if (difficulty === 'मध्यम') {
        const isBase = Math.random() > 0.6;
        if (isBase) {
          const b = Math.floor(Math.random() * 750) + 120;
          const ans = 1000 - b;
          qText = `आधार विधि से हल करें: 1000 - ${b} = ?`;
          qTextEn = `Evaluate using base method: 1000 - ${b} = ?`;
          ansStr = `${ans}`;
          explanation = `1000 में से घटाव:\n1000 - ${b} = ${ans}।`;
          explanationEn = `Subtracting from 1000: 1000 - ${b} = ${ans}.`;
          shortcut = `वैदिक सूत्र (निखिलं नवतश्चरमं दशतः): सभी अंकों को 9 से और अंतिम को 10 से घटाएं = ${ans}`;
          distractors = [`${ans + 10}`, `${ans - 10}`, `${ans + 100}`, `${ans - 100}`];
        } else {
          const a = Math.floor(Math.random() * 750) + 250;
          const b = Math.floor(Math.random() * (a - 60)) + 45;
          const ans = a - b;
          qText = `मान ज्ञात कीजिए: ${a} - ${b} = ?`;
          qTextEn = `Evaluate: ${a} - ${b} = ?`;
          ansStr = `${ans}`;
          explanation = `घटाव चरण:\n${a} - ${b} = ${ans}।`;
          explanationEn = `3-digit subtraction: ${a} - ${b} = ${ans}.`;
          shortcut = `निकटतम सैकड़े पर तोड़कर घटाव = ${ans}`;
          distractors = [`${ans + 20}`, `${ans - 20}`, `${ans + 10}`, `${ans - 10}`];
        }
      } else if (difficulty === 'कठिन') {
        const a = Math.floor(Math.random() * 7500) + 2500;
        const b = Math.floor(Math.random() * (a - 300)) + 200;
        const ans = a - b;
        qText = `मान ज्ञात कीजिए: ${a} - ${b} = ?`;
        qTextEn = `Evaluate: ${a} - ${b} = ?`;
        ansStr = `${ans}`;
        explanation = `4-अंकीय घटाव:\n${a} - ${b} = ${ans}।`;
        explanationEn = `4-digit subtraction: ${a} - ${b} = ${ans}.`;
        shortcut = `वैदिक पूरक (Complement) तकनीक = ${ans}`;
        distractors = [`${ans + 100}`, `${ans - 100}`, `${ans + 50}`, `${ans - 50}`];
      } else {
        // प्रो (Pro)
        const b = Math.floor(Math.random() * 8500) + 1200;
        const ans = 10000 - b;
        qText = `मानसिक गणना: 10000 - ${b} = ?`;
        qTextEn = `Mental calculation: 10000 - ${b} = ?`;
        ansStr = `${ans}`;
        explanation = `10000 में से घटाव:\n10000 - ${b} = ${ans}।`;
        explanationEn = `Subtracting from 10000: 10000 - ${b} = ${ans}.`;
        shortcut = `निखिलं नवतश्चरमं दशतः: 9 से सभी तथा इकाई को 10 से = ${ans}`;
        distractors = [`${ans + 100}`, `${ans - 100}`, `${ans + 10}`, `${ans - 10}`];
      }
    }
    // 3. गुणा (Multiplication)
    else if (chosenTopic.includes('गुणा (Multiplication)')) {
      const trickType = Math.floor(Math.random() * 4);
      if (trickType === 0) {
        // Multiply by 11 trick
        const num = Math.floor(Math.random() * 85) + 14;
        const ans = num * 11;
        qText = `वैदिक विधि से हल करें: ${num} × 11 = ?`;
        qTextEn = `Solve using Vedic trick: ${num} × 11 = ?`;
        ansStr = `${ans}`;
        const d1 = Math.floor(num / 10);
        const d2 = num % 10;
        explanation = `${num} × 11 की शॉर्ट ट्रिक:\nप्रथम अंक: ${d1}, मध्य अंक: (${d1} + ${d2}), अंतिम अंक: ${d2}।\nकुल मान = ${ans}।`;
        explanationEn = `${num} * 11 trick: Sandwich the sum of digits (${d1} + ${d2} = ${d1 + d2}) between ${d1} and ${d2} = ${ans}.`;
        shortcut = `11 का वैदिक जादू: दोनों अंकों को फैलाकर उनका योग बीच में रखें = ${ans}`;
        distractors = [`${ans + 11}`, `${ans - 11}`, `${ans + 22}`, `${ans - 22}`];
      } else if (trickType === 1) {
        // Multiply by 25 trick
        const multiplier = Math.floor(Math.random() * 22) + 4;
        const num = multiplier * 4; // guarantees divisible by 4
        const ans = num * 25;
        qText = `त्वरित गुणा ट्रिक: ${num} × 25 = ?`;
        qTextEn = `Fast multiply trick: ${num} × 25 = ?`;
        ansStr = `${ans}`;
        explanation = `25 से गुणा करने का नियम:\nसंख्या को 4 से भाग देकर 100 से गुणा करें।\n(${num} ÷ 4) × 100 = ${multiplier} × 100 = ${ans}।`;
        explanationEn = `Rule for multiplying by 25: Divide by 4 and multiply by 100: (${num} / 4) * 100 = ${ans}.`;
        shortcut = `(${num} ÷ 4) × 100 = ${multiplier} × 100 = ${ans}`;
        distractors = [`${ans + 50}`, `${ans - 50}`, `${ans + 100}`, `${ans - 100}`];
      } else if (trickType === 2) {
        // Multiply by 99 trick
        const num = Math.floor(Math.random() * 65) + 15;
        const ans = num * 99;
        qText = `शॉर्टकट से मान निकालें: ${num} × 99 = ?`;
        qTextEn = `Evaluate using shortcut: ${num} × 99 = ?`;
        ansStr = `${ans}`;
        explanation = `99 से गुणा करने का सूत्र:\n${num} × (100 - 1) = (${num} × 100) - ${num} = ${num * 100} - ${num} = ${ans}।`;
        explanationEn = `${num} * (100 - 1) = ${num * 100} - ${num} = ${ans}.`;
        shortcut = `${num * 100} - ${num} = ${ans}`;
        distractors = [`${ans + 99}`, `${ans - 99}`, `${ans + 100}`, `${ans - 100}`];
      } else {
        // Standard 2-digit multiplication
        const a = Math.floor(Math.random() * 45) + 12;
        const b = [12, 14, 15, 16, 18, 20, 24, 25][Math.floor(Math.random() * 8)];
        const ans = a * b;
        qText = `मान ज्ञात कीजिए: ${a} × ${b} = ?`;
        qTextEn = `Evaluate: ${a} × ${b} = ?`;
        ansStr = `${ans}`;
        explanation = `गुणा की विधि:\n${a} × ${b} = ${ans}।`;
        explanationEn = `Multiplication: ${a} * ${b} = ${ans}.`;
        shortcut = `दहाई में तोड़ें: (${a} × ${Math.floor(b / 10) * 10}) + (${a} × ${b % 10}) = ${ans}`;
        distractors = [`${ans + b}`, `${ans - b}`, `${ans + 20}`, `${ans - 20}`];
      }
    }
    // 4. भाग (Division)
    else if (chosenTopic.includes('भाग (Division)')) {
      const divisors = difficulty === 'सरल' ? [3, 4, 5, 6, 8, 9, 10] : [12, 14, 15, 16, 18, 24, 25, 36];
      const div = divisors[Math.floor(Math.random() * divisors.length)];
      const quotient = Math.floor(Math.random() * 50) + (difficulty === 'सरल' ? 12 : 25);
      const dividend = div * quotient; // 100% exact integer division guaranteed

      qText = `भाग दीजिए: ${dividend} ÷ ${div} = ?`;
      qTextEn = `Divide: ${dividend} ÷ ${div} = ?`;
      ansStr = `${quotient}`;
      explanation = `भागफल = भाज्य ÷ भाजक\n${dividend} ÷ ${div} = ${quotient}।`;
      explanationEn = `Quotient = Dividend / Divisor: ${dividend} / ${div} = ${quotient}.`;
      shortcut = `उभयनिष्ठ गुणनखंड काटकर छोटा करें: ${dividend} ÷ ${div} = ${quotient}`;
      distractors = [`${quotient + 2}`, `${quotient - 2}`, `${quotient + 5}`, `${Math.max(1, quotient - 5)}`];
    }
    // 5. जोड़ व घटाव (Add & Subtract)
    else if (chosenTopic.includes('जोड़ व घटाव')) {
      const a = Math.floor(Math.random() * 250) + 100;
      const b = Math.floor(Math.random() * 200) + 50;
      const c = Math.floor(Math.random() * (a + b - 50)) + 30;
      const ans = a + b - c;

      qText = `सरल कीजिए: ${a} + ${b} - ${c} = ?`;
      qTextEn = `Simplify: ${a} + ${b} - ${c} = ?`;
      ansStr = `${ans}`;
      explanation = `चरण 1: पहले जोड़ें -> ${a} + ${b} = ${a + b}।\nचरण 2: फिर घटाएं -> ${a + b} - ${c} = ${ans}।`;
      explanationEn = `Step 1: Add first -> ${a} + ${b} = ${a + b}. Step 2: Then subtract -> ${a + b} - ${c} = ${ans}.`;
      shortcut = `BODMAS नियम: जोड़ पहले, घटाव बाद में = ${ans}`;
      distractors = [`${ans + 10}`, `${ans - 10}`, `${ans + 20}`, `${Math.max(5, ans - 20)}`];
    }
    // 6. गुणा व भाग (Multiply & Divide)
    else if (chosenTopic.includes('गुणा व भाग')) {
      // (A * B) / C where (A * B) is cleanly divisible by C
      const c = [4, 6, 8, 12, 15][Math.floor(Math.random() * 5)];
      const k1 = Math.floor(Math.random() * 5) + 2;
      const a = c * k1; // a is multiple of c
      const b = Math.floor(Math.random() * 15) + 3;
      const ans = (a * b) / c;

      qText = `मान ज्ञात कीजिए: (${a} × ${b}) ÷ ${c} = ?`;
      qTextEn = `Evaluate: (${a} × ${b}) ÷ ${c} = ?`;
      ansStr = `${ans}`;
      explanation = `काटने का नियम:\n(${a} ÷ ${c}) × ${b} = ${k1} × ${b} = ${ans}।`;
      explanationEn = `Cancellation rule: (${a} / ${c}) * ${b} = ${k1} * ${b} = ${ans}.`;
      shortcut = `गुणा करने से पहले काटें: ${a} ÷ ${c} = ${k1}, फिर ${k1} × ${b} = ${ans}`;
      distractors = [`${ans + b}`, `${Math.max(1, ans - b)}`, `${ans + 5}`, `${ans - 5}`];
    }
    // 7. भिन्न व दशमलव (Fractions & Decimals)
    else if (chosenTopic.includes('भिन्न व दशमलव')) {
      const denoms = [2, 3, 4, 5, 6, 8, 10];
      const d1 = denoms[Math.floor(Math.random() * denoms.length)];
      let d2 = denoms[Math.floor(Math.random() * denoms.length)];
      while (d2 === d1) {
        d2 = denoms[Math.floor(Math.random() * denoms.length)];
      }
      const n1 = Math.floor(Math.random() * (d1 - 1)) + 1;
      const n2 = Math.floor(Math.random() * (d2 - 1)) + 1;

      // Common denominator LCM
      const commonLcm = (d1 * d2) / gcd(d1, d2);
      const numSum = n1 * (commonLcm / d1) + n2 * (commonLcm / d2);
      const finalGcd = gcd(numSum, commonLcm);
      const simpNum = numSum / finalGcd;
      const simpDen = commonLcm / finalGcd;

      ansStr = simpDen === 1 ? `${simpNum}` : `${simpNum}/${simpDen}`;
      qText = `भिन्नों का योग ज्ञात कीजिए: (${n1}/${d1}) + (${n2}/${d2}) = ?`;
      qTextEn = `Calculate sum of fractions: (${n1}/${d1}) + (${n2}/${d2}) = ?`;
      explanation = `ल.स.प. (LCM) ऑफ (${d1}, ${d2}) = ${commonLcm}।\n= [(${n1} × ${commonLcm / d1}) + (${n2} × ${commonLcm / d2})] ÷ ${commonLcm}\n= (${n1 * (commonLcm / d1)} + ${n2 * (commonLcm / d2)}) ÷ ${commonLcm} = ${numSum}/${commonLcm} = ${ansStr}।`;
      explanationEn = `LCM of denominators = ${commonLcm}. Sum = ${ansStr}.`;
      shortcut = `तिर्यक गुणा (Cross multiply): (${n1}×${d2} + ${n2}×${d1}) ÷ (${d1}×${d2}) = ${ansStr}`;

      distractors = [
        `${simpNum + 1}/${simpDen}`,
        simpDen > 2 ? `${simpNum}/${simpDen + 1}` : `${simpNum + 2}/${simpDen}`,
        `${simpNum + 2}/${simpDen}`,
        simpNum > 1 ? `${simpNum - 1}/${simpDen}` : `${simpNum + 3}/${simpDen}`
      ];
    }
    // 8. प्रतिशत (Percentage)
    else if (chosenTopic.includes('प्रतिशत')) {
      const percentages = [5, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75];
      const p = percentages[Math.floor(Math.random() * percentages.length)];
      const baseMultiplier = Math.floor(Math.random() * 25) + 3;
      const base = baseMultiplier * 100;
      const ans = Math.round((p * base) / 100);

      qText = `₹${base} का ${p}% कितना होगा?`;
      qTextEn = `What is ${p}% of ₹${base}?`;
      ansStr = `₹${ans}`;
      explanation = `${p}% = ${p} ÷ 100। कुल मान = (${base} × ${p}) ÷ 100 = ₹${ans}।`;
      explanationEn = `${p}% = ${p} / 100. Total value = (${base} * ${p}) / 100 = ₹${ans}.`;
      shortcut = `शॉर्टकट: 10% = ₹${base / 10}, 1% = ₹${base / 100}। मान निकालें = ₹${ans}`;
      distractors = [
        `₹${ans + Math.max(10, Math.round(ans * 0.1))}`,
        `₹${Math.max(10, ans - Math.max(10, Math.round(ans * 0.1)))}`,
        `₹${ans + 25}`,
        `₹${Math.max(5, ans - 15)}`
      ];
    }
    // 9. वर्ग व वर्गमूल (Squares & Roots)
    else if (chosenTopic.includes('वर्ग व वर्गमूल') || chosenTopic.includes('वर्ग')) {
      const isRoot = Math.random() > 0.5;
      const num = Math.floor(Math.random() * 32) + 12; // 12 to 43
      const sq = num * num;

      if (isRoot) {
        qText = `√${sq} का सटीक मान क्या होगा?`;
        qTextEn = `What is the exact square root of √${sq}?`;
        ansStr = `${num}`;
        explanation = `क्योंकि ${num} × ${num} = ${sq}, अतः √${sq} = ${num}।`;
        explanationEn = `Since ${num} * ${num} = ${sq}, square root of ${sq} is ${num}.`;
        shortcut = `इकाई अंक विधि: अंतिम अंक से पहचानें -> √${sq} = ${num}`;
        distractors = [`${num + 2}`, `${num - 2}`, `${num + 1}`, `${num - 1}`];
      } else {
        qText = `(${num})² का सटीक मान क्या होगा?`;
        qTextEn = `What is the exact value of (${num})²?`;
        ansStr = `${sq}`;
        explanation = `(${num})² = ${num} × ${num} = ${sq}।`;
        explanationEn = `(${num})² = ${num} * ${num} = ${sq}.`;
        shortcut = `वैदिक आधार विधि: ${num} का वर्ग = ${sq}`;
        distractors = [`${sq + 20}`, `${sq - 20}`, `${(num + 1) * (num + 1)}`, `${(num - 1) * (num - 1)}`];
      }
    }
    // 10. घन व घनमूल (Cubes & Roots)
    else if (chosenTopic.includes('घन व घनमूल') || chosenTopic.includes('घन')) {
      const isCubeRoot = Math.random() > 0.5;
      const num = Math.floor(Math.random() * 12) + 5; // 5 to 16
      const cube = num * num * num;

      if (isCubeRoot) {
        qText = `∛${cube} (घनमूल) का मान क्या होगा?`;
        qTextEn = `What is the cube root of ∛${cube}?`;
        ansStr = `${num}`;
        explanation = `क्योंकि ${num}³ = ${num} × ${num} × ${num} = ${cube}, अतः ∛${cube} = ${num}।`;
        explanationEn = `Since ${num}³ = ${cube}, cube root of ${cube} is ${num}.`;
        shortcut = `इकाई अंक मिलान विधि से 2 सेकंड में उत्तर = ${num}`;
        distractors = [`${num + 1}`, `${num - 1}`, `${num + 2}`, `${num - 2}`];
      } else {
        qText = `(${num})³ का सटीक मान क्या होगा?`;
        qTextEn = `What is the exact value of (${num})³?`;
        ansStr = `${cube}`;
        explanation = `(${num})³ = ${num} × ${num} × ${num} = ${cube}।`;
        explanationEn = `(${num})³ = ${num} * ${num} * ${num} = ${cube}.`;
        shortcut = `${num} का घन = ${cube}`;
        distractors = [`${cube + 50}`, `${cube - 50}`, `${(num + 1) * (num + 1) * (num + 1)}`, `${(num - 1) * (num - 1) * (num - 1)}`];
      }
    }
    // 11. औसत (Average)
    else if (chosenTopic.includes('औसत')) {
      const start = Math.floor(Math.random() * 30) + 12;
      const diff = Math.floor(Math.random() * 4) + 2;
      const nums = [start, start + diff, start + 2 * diff, start + 3 * diff, start + 4 * diff];
      const sum = nums.reduce((acc, curr) => acc + curr, 0);
      const avg = nums[2];

      qText = `संख्याओं ${nums.join(', ')} का औसत (Average) क्या होगा?`;
      qTextEn = `What is the average of numbers ${nums.join(', ')}?`;
      ansStr = `${avg}`;
      explanation = `औसत = कुल योग ÷ कुल संख्याएँ = (${nums.join(' + ')}) ÷ 5 = ${sum} ÷ 5 = ${avg}।`;
      explanationEn = `Average = Sum / Count = ${sum} / 5 = ${avg}.`;
      shortcut = `समानांतर श्रेणी (AP) में औसत सदैव मध्य पद होता है = ${avg}`;
      distractors = [`${avg + diff}`, `${avg - diff}`, `${avg + 1}`, `${avg - 1}`];
    }
    // 12. अनुपात व समानुपात (Ratio & Proportion)
    else if (chosenTopic.includes('अनुपात व समानुपात')) {
      const r1 = Math.floor(Math.random() * 3) + 2;
      const r2 = Math.floor(Math.random() * 3) + 3;
      const unitVal = (Math.floor(Math.random() * 15) + 5) * 50;
      const totalAmount = (r1 + r2) * unitVal;
      const ansA = r1 * unitVal;

      qText = `₹${totalAmount} की राशि को A और B में ${r1} : ${r2} के अनुपात में बांटा जाता है। A का हिस्सा कितना होगा?`;
      qTextEn = `₹${totalAmount} is divided between A and B in ratio ${r1} : ${r2}. What is A's share?`;
      ansStr = `₹${ansA}`;
      explanation = `अनुपातों का योग = ${r1} + ${r2} = ${r1 + r2} यूनिट।\n1 यूनिट = ₹${totalAmount} ÷ ${r1 + r2} = ₹${unitVal}।\nA का हिस्सा = ${r1} × ${unitVal} = ₹${ansA}।`;
      explanationEn = `Total ratio = ${r1 + r2}. 1 unit = ₹${unitVal}. A's share = ₹${ansA}.`;
      shortcut = `A का हिस्सा = [${r1} ÷ (${r1} + ${r2})] × ₹${totalAmount} = ₹${ansA}`;
      distractors = [`₹${r2 * unitVal}`, `₹${ansA + 100}`, `₹${Math.max(50, ansA - 100)}`, `₹${ansA + 200}`];
    }
    // 13. साधारण ब्याज (Simple Interest)
    else if (chosenTopic.includes('साधारण ब्याज')) {
      const principals = [1000, 2000, 3000, 4000, 5000, 6000, 8000, 10000];
      const p = principals[Math.floor(Math.random() * principals.length)];
      const rates = [4, 5, 6, 8, 10];
      const r = rates[Math.floor(Math.random() * rates.length)];
      const times = [2, 3, 4, 5];
      const t = times[Math.floor(Math.random() * times.length)];
      const si = Math.round((p * r * t) / 100);

      qText = `₹${p} पर ${r}% वार्षिक दर से ${t} वर्ष का साधारण ब्याज (SI) क्या होगा?`;
      qTextEn = `What is the Simple Interest on ₹${p} at ${r}% per annum for ${t} years?`;
      ansStr = `₹${si}`;
      explanation = `साधारण ब्याज = (मूलधन × दर × समय) ÷ 100 = (${p} × ${r} × ${t}) ÷ 100 = ₹${si}।`;
      explanationEn = `SI = (P * R * T) / 100 = (${p} * ${r} * ${t}) / 100 = ₹${si}.`;
      shortcut = `सूत्र: SI = (P × R × T) ÷ 100 = ₹${si}`;
      distractors = [`₹${si + 100}`, `₹${Math.max(50, si - 100)}`, `₹${si + 50}`, `₹${Math.max(20, si - 50)}`];
    }
    // 14. लाभ व हानि (Profit & Loss)
    else if (chosenTopic.includes('लाभ व हानि')) {
      const cps = [200, 300, 400, 500, 600, 800, 1000, 1200, 1500];
      const cp = cps[Math.floor(Math.random() * cps.length)];
      const rates = [10, 15, 20, 25, 30];
      const rate = rates[Math.floor(Math.random() * rates.length)];
      const isProfit = Math.random() > 0.45;

      if (isProfit) {
        const profit = Math.round((cp * rate) / 100);
        const sp = cp + profit;
        qText = `एक वस्तु का क्रय मूल्य ₹${cp} है। यदि इसे ${rate}% लाभ पर बेचा जाए, तो विक्रय मूल्य क्या होगा?`;
        qTextEn = `Cost price is ₹${cp}. If sold at ${rate}% profit, what is the selling price?`;
        ansStr = `₹${sp}`;
        explanation = `लाभ = (${cp} × ${rate}) ÷ 100 = ₹${profit}। विक्रय मूल्य = ${cp} + ${profit} = ₹${sp}।`;
        explanationEn = `Profit = ₹${profit}. SP = CP + Profit = ₹${sp}.`;
        shortcut = `सूत्र: SP = CP × [(100 + ${rate}) ÷ 100] = ₹${sp}`;
        distractors = [`₹${sp + 50}`, `₹${sp - 50}`, `₹${cp + profit * 2}`, `₹${sp + 20}`];
      } else {
        const loss = Math.round((cp * rate) / 100);
        const sp = cp - loss;
        qText = `एक वस्तु ₹${cp} में खरीदी गई। यदि इसे ${rate}% हानि पर बेचा जाए, तो विक्रय मूल्य क्या होगा?`;
        qTextEn = `An item is bought for ₹${cp}. If sold at ${rate}% loss, what is the selling price?`;
        ansStr = `₹${sp}`;
        explanation = `हानि = (${cp} × ${rate}) ÷ 100 = ₹${loss}। विक्रय मूल्य = ${cp} - ${loss} = ₹${sp}।`;
        explanationEn = `Loss = ₹${loss}. SP = CP - Loss = ₹${sp}.`;
        shortcut = `सूत्र: SP = CP × [(100 - ${rate}) ÷ 100] = ₹${sp}`;
        distractors = [`₹${sp + 40}`, `₹${sp - 40}`, `₹${sp + 60}`, `₹${sp - 20}`];
      }
    }
    // 15. समय व कार्य (Time & Work)
    else if (chosenTopic.includes('समय व कार्य')) {
      const workPairs: [number, number, number][] = [
        [10, 15, 6], [12, 24, 8], [20, 30, 12], [15, 30, 10],
        [12, 60, 10], [10, 40, 8], [6, 12, 4], [20, 20, 10],
        [8, 24, 6], [15, 60, 12], [9, 18, 6], [16, 48, 12],
        [30, 60, 20], [40, 60, 24]
      ];
      const pair = workPairs[Math.floor(Math.random() * workPairs.length)];
      const aDays = pair[0];
      const bDays = pair[1];
      const totalDays = pair[2];

      qText = `A किसी कार्य को ${aDays} दिन में तथा B उसे ${bDays} दिन में करता है। दोनों मिलकर इसे कितने दिन में करेंगे?`;
      qTextEn = `A does a work in ${aDays} days and B in ${bDays} days. In how many days will both finish it together?`;
      ansStr = `${totalDays} दिन`;
      explanation = `ल.स.प. (LCM) विधि:\nकुल दिन = (A × B) ÷ (A + B) = (${aDays} × ${bDays}) ÷ (${aDays + bDays}) = ${totalDays} दिन।`;
      explanationEn = `Total days = (A * B) / (A + B) = ${totalDays} days.`;
      shortcut = `त्वरित सूत्र: (A × B) ÷ (A + B) = ${totalDays} दिन`;
      distractors = [`${totalDays + 2} दिन`, `${Math.max(1, totalDays - 2)} दिन`, `${totalDays + 4} दिन`, `${Math.max(2, totalDays - 1)} दिन`];
    }
    // 16. समय, चाल व दूरी (Time & Distance)
    else if (chosenTopic.includes('समय, चाल व दूरी')) {
      const speeds = [36, 45, 54, 60, 72, 80, 90, 100];
      const speed = speeds[Math.floor(Math.random() * speeds.length)];
      const hours = Math.floor(Math.random() * 5) + 2;
      const distance = speed * hours;

      qText = `एक रेलगाड़ी ${speed} किमी/घंटा की गति से चल रही है। ${distance} किमी की दूरी तय करने में उसे कितना समय लगेगा?`;
      qTextEn = `A train moves at speed of ${speed} km/h. How much time will it take to cover ${distance} km?`;
      ansStr = `${hours} घंटे`;
      explanation = `समय = दूरी ÷ चाल = ${distance} ÷ ${speed} = ${hours} घंटे।`;
      explanationEn = `Time = Distance / Speed = ${distance} / ${speed} = ${hours} hours.`;
      shortcut = `सूत्र: T = D ÷ S = ${distance} ÷ ${speed} = ${hours} घंटे`;
      distractors = [`${hours + 1} घंटे`, `${Math.max(1, hours - 1)} घंटे`, `${hours + 2} घंटे`, `${hours + 3} घंटे`];
    }
    // 17. सरलीकरण (BODMAS - Fallback default)
    else {
      const a = (Math.floor(Math.random() * 10) + 2) * 6;
      const b = [2, 3, 6][Math.floor(Math.random() * 3)];
      const c = Math.floor(Math.random() * 5) + 3;
      const d = Math.floor(Math.random() * 15) + 5;
      const div = a / b;
      const mul = div * c;
      const res = mul + d;

      qText = `मान ज्ञात कीजिए: (${a} ÷ ${b}) × ${c} + ${d} = ?`;
      qTextEn = `Evaluate: (${a} ÷ ${b}) × ${c} + ${d} = ?`;
      ansStr = `${res}`;
      explanation = `BODMAS नियम का पालन करें:\n1. भाग: ${a} ÷ ${b} = ${div}\n2. गुणा: ${div} × ${c} = ${mul}\n3. जोड़: ${mul} + ${d} = ${res}।`;
      explanationEn = `Follow BODMAS: Division first (${a} / ${b} = ${div}), Multiplication (${div} * ${c} = ${mul}), then Addition = ${res}.`;
      shortcut = `चरण: ÷ फिर × फिर + = ${res}`;
      distractors = [`${res + 5}`, `${Math.max(1, res - 5)}`, `${res + 10}`, `${Math.max(2, res - 10)}`];
    }

    // Build unique options list
    const optionSet = new Set<string>();
    optionSet.add(ansStr);

    for (const dist of distractors) {
      if (dist && dist !== ansStr && !optionSet.has(dist)) {
        optionSet.add(dist);
      }
      if (optionSet.size >= 4) break;
    }

    let fallbackStep = 1;
    while (optionSet.size < 4) {
      const fallbackVal = ansStr.startsWith('₹')
        ? `₹${parseInt(ansStr.replace('₹', ''), 10) + fallbackStep * 15}`
        : ansStr.includes('दिन')
          ? `${parseInt(ansStr, 10) + fallbackStep * 3} दिन`
          : ansStr.includes('घंटे')
            ? `${parseInt(ansStr, 10) + fallbackStep * 2} घंटे`
            : ansStr.includes('/')
              ? `${parseInt(ansStr.split('/')[0], 10) + fallbackStep}/${ansStr.split('/')[1]}`
              : `${parseInt(ansStr, 10) + fallbackStep * 7}`;

      if (!optionSet.has(fallbackVal)) {
        optionSet.add(fallbackVal);
      }
      fallbackStep++;
    }

    const shuffledOptions = Array.from(optionSet).sort(() => Math.random() - 0.5);
    const correctIndex = shuffledOptions.indexOf(ansStr);

    const questionCandidate: QuizQuestion = {
      id: indexSeed,
      question: qText,
      questionEn: qTextEn,
      options: shuffledOptions,
      optionsEn: shuffledOptions,
      correct: correctIndex >= 0 ? correctIndex : 0,
      explanation,
      explanationEn,
      shortcut,
      category: chosenTopic
    };

    const signature = `${chosenTopic}:::${qText}`;

    // Anti-repetition check: If we have seen this question before, keep trying to get a unique one
    if (!seenSignatures || !seenSignatures.has(signature) || attempts >= 55) {
      if (seenSignatures) {
        seenSignatures.add(signature);
      }
      finalQ = questionCandidate;
      break;
    }
  }

  return finalQ!;
}

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [langHindi, setLangHindi] = useState<boolean>(() => {
    return localStorage.getItem('study_bull_lang') !== 'en';
  });
  const [soundMuted, setSoundMuted] = useState<boolean>(() => {
    return localStorage.getItem('study_bull_muted') === 'true';
  });

  // Notes Reader
  const [selectedChapter, setSelectedChapter] = useState<Chapter>(NOTES_CHAPTERS[0]);
  const [readerDarkMode, setReaderDarkMode] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Quiz State
  const [selectedSubject, setSelectedSubject] = useState(QUIZ_SUBJECTS[0]);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>(QUIZ_SUBJECTS[0].questions);
  const [quizIndex, setQuizIndex] = useState(0);
  const [userQuizAnswers, setUserQuizAnswers] = useState<(number | null)[]>([]);
  const [quizScore, setQuizScore] = useState(0);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);

  // Mock Test State
  const [mockQuestions] = useState<QuizQuestion[]>(MOCK_TEST_QUESTIONS);
  const [mockIndex, setMockIndex] = useState(0);
  const [userMockAnswers, setUserMockAnswers] = useState<(number | null)[]>(new Array(MOCK_TEST_QUESTIONS.length).fill(null));
  const [mockTimer, setMockTimer] = useState(600);
  const [mockTimerActive, setMockTimerActive] = useState(false);

  // Calculation Setup State
  const [calcCount, setCalcCount] = useState<number | 'Infinite'>(10);
  const [calcDifficulty, setCalcDifficulty] = useState<'सरल' | 'मध्यम' | 'कठिन' | 'प्रो'>('मध्यम');
  const [calcTopic, setCalcTopic] = useState<string>('मिश्रित (सभी विषय)');

  // Calculation Practice State
  const [calcQuestions, setCalcQuestions] = useState<QuizQuestion[]>([]);
  const [calcIndex, setCalcIndex] = useState(0);
  const [calcSelected, setCalcSelected] = useState<number | null>(null);
  const [calcAnswered, setCalcAnswered] = useState(false);
  const [calcScore, setCalcScore] = useState(0);
  const [calcTimer, setCalcTimer] = useState(0);
  const [calcTimerActive, setCalcTimerActive] = useState(false);
  const [calcCorrectCount, setCalcCorrectCount] = useState(0);
  const [calcWrongCount, setCalcWrongCount] = useState(0);
  const [calcUserAnswers, setCalcUserAnswers] = useState<{ selected: number | null; correct: boolean }[]>([]);
  // Persistent tracking of seen questions to eliminate repetitions 100%
  const seenMathSignaturesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = localStorage.getItem('study_seen_math_questions_v2');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: string) => seenMathSignaturesRef.current.add(item));
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  // Typing Test State
  const [typingDuration, setTypingDuration] = useState<number | 'Infinite'>(2);
  const DEFAULT_TYPING_PASSAGE = "The Constitution of India guarantees fundamental rights to all citizens including freedom of speech equality before law and protection of life and personal liberty. Every officer shall uphold integrity honesty and public interest in discharge of official duties without bias or prejudice.";
  const [activeTypingPassage, setActiveTypingPassage] = useState<string>(DEFAULT_TYPING_PASSAGE);
  const [activeTypingTitle, setActiveTypingTitle] = useState<string>('SSC CHSL / CGL English Typing Test Passage #1');
  const passageText = activeTypingPassage || DEFAULT_TYPING_PASSAGE;
  const [typedInput, setTypedInput] = useState('');
  const [typingStarted, setTypingStarted] = useState(false);
  const [typingTimeLeft, setTypingTimeLeft] = useState(120);
  const typingScrollRef = useRef<HTMLDivElement>(null);

  // Submit typing test (called on timeout or user finish)
  const submitTypingTest = () => {
    setTypingStarted(false);
    playGentleSound('celebrate', soundMuted);
    const words = typedInput.trim().split(/\s+/).filter(Boolean).length;
    const totalAllowedSec = typeof typingDuration === 'number' ? typingDuration * 60 : 120;
    const timeSpentSec = Math.max(1, totalAllowedSec - typingTimeLeft);
    const finalWpm = Math.round((words / timeSpentSec) * 60);
    recordUserAttempt('typing', {
      wpm: finalWpm,
      timeTaken: timeSpentSec,
      characters: typedInput.length
    });
    navigateTo('typing_result');
  };

  // Review accordions state for Results
  const [reviewExpanded, setReviewExpanded] = useState(false);
  const [activeCustomNode, setActiveCustomNode] = useState<any>(null);
  const [htmlReloadKey, setHtmlReloadKey] = useState<number>(0);
  const [htmlIsFullscreen, setHtmlIsFullscreen] = useState<boolean>(false);

  // Helper functions to resolve feature title, icon, and subtitle cleanly from Admin nodes and code
  const resolveNodeTitle = (btn: any, hindiMode: boolean = true) => {
    if (!btn) return '';
    const currentTitle = String(hindiMode ? (btn.title || btn.name) : (btn.titleEn || btn.title_en || btn.title || btn.name || '')).trim();
    const rawHtml = String(btn.htmlContent || btn.html || btn.code || btn.rawHtml || btn.content || '');
    if (rawHtml) {
      const titleMatch = rawHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        const extracted = titleMatch[1].trim();
        if (!currentTitle || currentTitle === 'नया Custom Web Page' || currentTitle.toLowerCase().includes('custom web page') || currentTitle.toLowerCase().includes('untitled')) {
          return extracted;
        }
      }
    }
    return currentTitle || 'फीचर टूल';
  };

  const resolveNodeIcon = (btn: any) => {
    if (btn?.icon && btn.icon !== '📌' && btn.icon !== '🔗') return btn.icon;
    const title = String(btn?.title || '').toLowerCase();
    const rawHtml = String(btn?.htmlContent || btn?.html || btn?.code || btn?.rawHtml || '').toLowerCase();
    if (title.includes('math') || title.includes('कैलकुलेशन') || rawHtml.includes('कैलकुलेशन') || rawHtml.includes('math') || rawHtml.includes('speed math')) return '⚡';
    if (title.includes('resume') || rawHtml.includes('resume') || rawHtml.includes('cv')) return '📄';
    if (title.includes('typing') || title.includes('टाइपिंग')) return '⌨️';
    if (title.includes('quiz') || title.includes('test')) return '📝';
    if (title.includes('notes') || title.includes('नोट्स') || title.includes('pdf')) return '📚';
    return btn?.icon || '⚡';
  };

  const resolveNodeSubtitle = (btn: any, hindiMode: boolean = true) => {
    const currentSub = String(hindiMode ? (btn.sub || btn.subtitle || '') : (btn.subEn || btn.subtitle_en || btn.sub || btn.subtitle || '')).trim();
    const title = String(btn?.title || '').toLowerCase();
    const rawHtml = String(btn?.htmlContent || btn?.html || btn?.code || btn?.rawHtml || '').toLowerCase();
    if (currentSub && !currentSub.includes('Separate Page') && !currentSub.includes('Custom Web Tool') && !currentSub.includes('Interactive Script')) {
      return currentSub;
    }
    if (title.includes('स्पीड मैथ') || title.includes('कैलकुलेशन') || rawHtml.includes('कैलकुलेशन') || rawHtml.includes('speed math')) {
      return hindiMode ? 'स्पीड मैथ प्रैक्टिस एवं कैलकुलेशन बूस्टर' : 'Speed Math Practice & Calculation Tool';
    }
    if (title.includes('resume') || rawHtml.includes('resume')) {
      return hindiMode ? 'प्रोफेशनल रिज्यूम एवं सीवी बिल्डर' : 'Professional Resume & CV Builder';
    }
    if (title.includes('typing') || title.includes('टाइपिंग')) {
      return hindiMode ? 'लाइव टाइपिंग स्पीड एवं एक्यूरेसी टेस्ट' : 'Live Typing Speed & Accuracy Test';
    }
    return currentSub || (hindiMode ? 'स्टडी बुल इंटरएक्टिव फीचर' : 'Study Bull Interactive Feature');
  };

  // Node Type Helpers according to Admin schema and Image layout
  const isSectionNode = (item: any) => {
    const kind = String(item?.kind || item?.type || '').toLowerCase();
    return kind === 'section' || kind === 'divider' || kind === 'heading' || kind === 'header';
  };

  const isFolderNode = (item: any) => {
    if (isSectionNode(item)) return false;
    const kind = String(item?.kind || item?.type || '').toLowerCase();
    if (kind === 'folder' || kind === 'category' || kind === 'group' || kind === 'directory') return true;
    if (Array.isArray(item?.children) && item.children.length > 0) return true;
    return false;
  };

  // Supabase State & Instant Cache-First (eliminates all old default flickers)
  const [adminNodes, setAdminNodes] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem('studybull_user_cache') || localStorage.getItem('studybull_cached_nodes');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });

  const [adminSettings, setAdminSettings] = useState<any>(() => {
    try {
      const cached = localStorage.getItem('studybull_cached_settings');
      if (cached) return JSON.parse(cached);
    } catch {}
    return {};
  });

  const [isDbLoaded, setIsDbLoaded] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem('studybull_user_cache') || localStorage.getItem('studybull_cached_nodes');
      if (cached) {
        const parsed = JSON.parse(cached);
        return Array.isArray(parsed) && parsed.length > 0;
      }
      return false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let isMounted = true;

    const applyLiveAdminData = (nodes: any[], settings: any) => {
      if (!isMounted) return;
      if (Array.isArray(nodes)) {
        setAdminNodes(nodes);
        try {
          localStorage.setItem('studybull_user_cache', JSON.stringify(nodes));
          localStorage.setItem('studybull_cached_nodes', JSON.stringify(nodes));
        } catch {}
      }
      if (settings && Object.keys(settings).length > 0) {
        setAdminSettings(settings);
        try {
          localStorage.setItem('studybull_cached_settings', JSON.stringify(settings));
        } catch {}
      }
      setIsDbLoaded(true);
      try {
        localStorage.setItem('studybull_db_loaded', 'true');
      } catch {}
    };

    // 1. Initial background fetch & normalization from Supabase
    loadStudyBullApp().then((appData) => {
      if (!isMounted) return;
      if (Array.isArray(appData.nodes)) {
        applyLiveAdminData(appData.nodes, appData.settings || {});
      } else {
        setIsDbLoaded(true);
      }
    }).catch((err) => {
      console.warn('Initial load error from Supabase:', err);
      if (isMounted) setIsDbLoaded(true);
    });

    // 2. Real-time subscription to admin panel updates
    const unsubscribe = subscribeToAdminUpdates((data) => {
      if (!isMounted) return;
      applyLiveAdminData(data.nodes || [], data.settings || {});
    });

    // 3. Fallback sync to guarantee instant update if realtime socket blips
    const timer = setInterval(() => {
      loadStudyBullApp().then((appData) => {
        if (!isMounted) return;
        if (appData && Array.isArray(appData.nodes)) {
          applyLiveAdminData(appData.nodes, appData.settings || {});
        }
      }).catch(() => {});
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(timer);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Sync Language and Mute with LocalStorage
  useEffect(() => {
    localStorage.setItem('study_bull_lang', langHindi ? 'hi' : 'en');
  }, [langHindi]);

  useEffect(() => {
    localStorage.setItem('study_bull_muted', soundMuted ? 'true' : 'false');
  }, [soundMuted]);

  // Synchronize document.title with live Admin App Name
  useEffect(() => {
    const title = adminSettings?.appName?.trim() || 'Study Bull';
    document.title = title;
  }, [adminSettings?.appName]);

  // Synchronize browser history with views so hardware/browser back NEVER produces a white screen
  useEffect(() => {
    const handlePopState = () => {
      // Safely navigate backwards inside the app
      if (currentView !== 'home') {
        handleBack();
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentView]);

  // Navigate view with history state
  const navigateTo = (view: ViewState) => {
    window.history.pushState({ view }, '');
    setCurrentView(view);
  };

  // Mock Timer
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (mockTimerActive && mockTimer > 0) {
      interval = setInterval(() => {
        setMockTimer(prev => {
          if (prev <= 1) {
            setMockTimerActive(false);
            playGentleSound('celebrate', soundMuted);
            setCurrentView('mock_result');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [mockTimerActive, mockTimer, soundMuted]);

  // Calc Timer
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (calcTimerActive) {
      interval = setInterval(() => setCalcTimer(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [calcTimerActive]);

  // Typing Timer & Auto-Submit when time is over
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (typingStarted && typingDuration !== 'Infinite') {
      if (typingTimeLeft > 0) {
        interval = setInterval(() => {
          setTypingTimeLeft(prev => {
            if (prev <= 1) {
              setTypingStarted(false);
              playGentleSound('celebrate', soundMuted);
              const words = typedInput.trim().split(/\s+/).filter(Boolean).length;
              const durationSec = typeof typingDuration === 'number' ? typingDuration * 60 : 120;
              const finalWpm = Math.round((words / (durationSec / 60))) || 0;
              recordUserAttempt('typing', {
                wpm: finalWpm,
                timeTaken: durationSec,
                characters: typedInput.length
              });
              setCurrentView('typing_result');
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    }
    return () => clearInterval(interval);
  }, [typingStarted, typingTimeLeft, typingDuration, soundMuted, typedInput]);

  // Smooth, stable auto-scroll strictly contained within the text box
  // NEVER scrolls the window or causes screen jumping when mobile keyboard is open
  useEffect(() => {
    const container = typingScrollRef.current;
    if (!container) return;
    const activeEl = container.querySelector('.active-char') as HTMLElement | null;
    if (activeEl) {
      const offsetWithinContainer = activeEl.offsetTop - container.offsetTop;
      const targetScrollTop = offsetWithinContainer - (container.clientHeight / 2) + 16;
      if (Math.abs(container.scrollTop - targetScrollTop) > 20) {
        container.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth'
        });
      }
    }
  }, [typedInput]);

  // Rock-Solid Safe Back Button Handler
  // Never unmounts unexpectedly and always maps to a stable parent view
  const handleBack = () => {
    switch (currentView) {
      case 'custom_node':
        setActiveCustomNode(null);
        setCurrentView('home');
        break;
      case 'quiz_play':
      case 'quiz_result':
        setCurrentView('quiz_categories');
        break;
      case 'quiz_categories':
      case 'mock_result':
      case 'notes_lib':
      case 'calc_setup':
      case 'typing_setup':
        setCurrentView('home');
        break;
      case 'mock_play':
        setMockTimerActive(false);
        setCurrentView('home');
        break;
      case 'notes_reader':
        setCurrentView('notes_lib');
        break;
      case 'calc_practice':
      case 'calc_result':
        setCalcTimerActive(false);
        setCurrentView('calc_setup');
        break;
      case 'typing_practice':
      case 'typing_result':
        setTypingStarted(false);
        setCurrentView('typing_setup');
        break;
      default:
        setCurrentView('home');
    }
  };

  // Generate Calculation Questions
  const generateCalculationSet = () => {
    const totalQ = calcCount === 'Infinite' ? 20 : Number(calcCount);
    const generated: QuizQuestion[] = [];

    for (let i = 0; i < totalQ; i++) {
      const q = generateUnlimitedMathQuestion(
        calcTopic,
        i + 1,
        calcDifficulty,
        seenMathSignaturesRef.current
      );
      generated.push(q);
    }

    // Save recent signatures to persistent storage (limit to last 2000)
    try {
      const arr = Array.from(seenMathSignaturesRef.current).slice(-2000);
      localStorage.setItem('study_seen_math_questions_v2', JSON.stringify(arr));
    } catch {
      // Ignore
    }

    setCalcQuestions(generated);
    setCalcIndex(0);
    setCalcSelected(null);
    setCalcAnswered(false);
    setCalcScore(0);
    setCalcCorrectCount(0);
    setCalcWrongCount(0);
    setCalcUserAnswers([]);
    setCalcTimer(0);
    setCalcTimerActive(true);
    navigateTo('calc_practice');
  };

  // Top Title Helper
  const getHeaderTitle = () => {
    const defaultAppName = adminSettings?.appName?.trim() || 'Study Bull';
    switch (currentView) {
      case 'home':
        return defaultAppName;
      case 'quiz_categories':
      case 'quiz_play':
      case 'quiz_result':
        return langHindi ? 'क्विज अभ्यास' : 'Quiz Practice';
      case 'mock_play':
      case 'mock_result':
        return langHindi ? 'मॉक टेस्ट' : 'Mock Tests';
      case 'notes_lib':
      case 'notes_reader':
        return langHindi ? 'नोट्स (PDF)' : 'Notes (PDF)';
      case 'calc_setup':
      case 'calc_practice':
      case 'calc_result':
        return langHindi ? 'कैलकुलेशन' : 'Calculations';
      case 'typing_setup':
      case 'typing_practice':
      case 'typing_result':
        return langHindi ? 'टाइपिंग लैब' : 'Typing Lab';
      default:
        return defaultAppName;
    }
  };

  // 1. DEDICATED FULL-SCREEN NEW FEATURE PAGE (Matching user requirement & Image 2)
  // When an admin HTML feature/code button is tapped, render pure full-screen page with ONLY top back bar
  if (currentView === 'custom_node' && activeCustomNode) {
    const isHtmlTool = Boolean(
      activeCustomNode.kind === 'html' ||
      activeCustomNode.htmlContent ||
      activeCustomNode.html ||
      activeCustomNode.code ||
      activeCustomNode.rawHtml ||
      (typeof activeCustomNode.content === 'string' && (activeCustomNode.content.includes('<html') || activeCustomNode.content.includes('<!DOCTYPE') || activeCustomNode.content.includes('<script')))
    );

    const rawHtml = String(
      activeCustomNode.htmlContent ||
      activeCustomNode.html ||
      activeCustomNode.code ||
      activeCustomNode.rawHtml ||
      (typeof activeCustomNode.content === 'string' && (activeCustomNode.content.includes('<') || activeCustomNode.content.includes('<!DOCTYPE')) ? activeCustomNode.content : '')
    ).trim();

    const featureTitle = resolveNodeTitle(activeCustomNode, langHindi);
    const featureIcon = resolveNodeIcon(activeCustomNode);
    const featureSubtitle = resolveNodeSubtitle(activeCustomNode, langHindi);

    return (
      <SafeErrorBoundary fallbackView={() => { setActiveCustomNode(null); setCurrentView('home'); }}>
        <div className="fixed inset-0 z-50 flex flex-col w-screen h-screen bg-white select-none overflow-hidden">
          {/* Top Bar - Clean minimal back header as shown in Image 2 */}
          <div 
            className="h-14 px-4 flex items-center justify-between text-white shadow-sm shrink-0 z-20"
            style={{
              background: `linear-gradient(to right, ${adminSettings?.primaryColor || '#1546b5'}, ${adminSettings?.secondaryColor || '#3d2db3'})`
            }}
          >
            <div className="flex items-center space-x-3 min-w-0">
              <button
                onClick={() => {
                  setActiveCustomNode(null);
                  setCurrentView('home');
                }}
                className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs flex items-center space-x-1.5 shadow-sm transition active:scale-95 cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{langHindi ? 'वापस' : 'Back'}</span>
              </button>

              <div className="flex items-center space-x-2 min-w-0">
                <span className="text-xl shrink-0">{featureIcon}</span>
                <div className="min-w-0">
                  <h1 className="text-sm sm:text-base font-bold text-white truncate">
                    {featureTitle}
                  </h1>
                  {featureSubtitle && (
                    <p className="text-[11px] text-white/80 truncate hidden sm:block">
                      {featureSubtitle}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              {/* Refresh button removed as requested by user */}
            </div>
          </div>

          {/* Pure 100% Full Viewport HTML Output without frames, margins or bottom bars */}
          <div className="flex-1 w-full h-[calc(100vh-56px)] bg-white overflow-hidden relative">
            {isHtmlTool && rawHtml ? (
              <iframe
                key={`fs-feature-${activeCustomNode.id}-${htmlReloadKey}`}
                srcDoc={rawHtml.includes('<!DOCTYPE') || rawHtml.includes('<html') 
                  ? rawHtml 
                  : `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><script src="https://cdn.tailwindcss.com"></script><style>body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 0; } * { box-sizing: border-box; }</style></head><body>${rawHtml}</body></html>`}
                title={featureTitle}
                sandbox="allow-scripts allow-modals allow-forms allow-same-origin allow-popups allow-downloads"
                allow="clipboard-read; clipboard-write; fullscreen; autoplay"
                className="w-full h-full border-0 block"
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            ) : isHtmlTool ? (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center text-3xl mb-4 shadow-sm">
                  {featureIcon}
                </div>
                <h3 className="text-lg font-bold text-slate-800">
                  {featureTitle}
                </h3>
                <p className="text-sm text-slate-500 max-w-md mt-2">
                  {langHindi 
                    ? 'एडमिन पैनल से इस फीचर के लिए कोड लोड किया जा रहा है...' 
                    : 'Loading code from Admin Panel...'}
                </p>
                <button
                  onClick={() => {
                    setActiveCustomNode(null);
                    setCurrentView('home');
                  }}
                  className="mt-6 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
                >
                  {langHindi ? 'होम पर वापस जाएं' : 'Back to Home'}
                </button>
              </div>
            ) : (
              /* If folder or container, show child buttons cleanly in full screen with back button */
              <div className="max-w-4xl mx-auto p-6 overflow-y-auto h-full">
                <div className="mb-6 flex items-center gap-3">
                  <span className="text-3xl">{featureIcon}</span>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{featureTitle}</h2>
                    {featureSubtitle && <p className="text-xs text-slate-500 mt-0.5">{featureSubtitle}</p>}
                  </div>
                </div>

                {Array.isArray(activeCustomNode.children) && activeCustomNode.children.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {activeCustomNode.children.map((child: any) => {
                      const childTitle = resolveNodeTitle(child, langHindi);
                      const childIcon = resolveNodeIcon(child);
                      const childSubtitle = resolveNodeSubtitle(child, langHindi);
                      const childTarget = String(child.view || child.target_view || child.type || child.id || '').toLowerCase();
                      const childHasHtml = Boolean(
                        child.htmlContent || child.html || child.code || child.rawHtml ||
                        (typeof child.content === 'string' && (child.content.includes('<html') || child.content.includes('<!DOCTYPE') || child.content.includes('<script')))
                      );

                      const isChildSection = isSectionNode(child);
                      const isChildFolder = isFolderNode(child);

                      const handleChildClick = () => {
                        if (isChildSection) return;
                        if (child.url) {
                          window.open(child.url, '_blank');
                          return;
                        }
                        if (childHasHtml || (child.kind === 'html' && child.id !== 'calc' && child.id !== 'typing')) {
                          setActiveCustomNode(child);
                          setHtmlReloadKey(0);
                          return;
                        }
                        if (childTarget.includes('mock')) {
                          setMockIndex(0);
                          setUserMockAnswers(new Array(MOCK_TEST_QUESTIONS.length).fill(null));
                          setMockTimer(600);
                          setMockTimerActive(true);
                          navigateTo('mock_play');
                        } else if (childTarget.includes('quiz')) {
                          navigateTo('quiz_categories');
                        } else if (childTarget.includes('note') || childTarget.includes('pdf')) {
                          navigateTo('notes_lib');
                        } else if (childTarget.includes('calc')) {
                          navigateTo('calc_setup');
                        } else if (childTarget.includes('typing')) {
                          navigateTo('typing_setup');
                        } else {
                          setActiveCustomNode(child);
                          setHtmlReloadKey(0);
                        }
                      };

                      if (isChildSection) {
                        return (
                          <div
                            key={child.id}
                            className="col-span-2 sm:col-span-2 md:col-span-3 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-white border border-blue-200/80 rounded-2xl p-4 flex items-center justify-between shadow-sm my-1"
                          >
                            <div className="flex items-center space-x-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xl shrink-0 shadow-sm">
                                {childIcon || '📑'}
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight truncate">
                                  {childTitle}
                                </h3>
                                {childSubtitle && (
                                  <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                                    {childSubtitle}
                                  </p>
                                )}
                              </div>
                            </div>
                            <span className="shrink-0 px-2.5 py-1 bg-blue-100 text-blue-700 font-bold text-[10px] rounded-lg uppercase tracking-wider">
                              Section
                            </span>
                          </div>
                        );
                      }

                      if (isChildFolder) {
                        const childCount = Array.isArray(child.children) ? child.children.length : 0;
                        return (
                          <button
                            key={child.id}
                            onClick={handleChildClick}
                            className="col-span-2 sm:col-span-2 md:col-span-3 group relative bg-white hover:bg-blue-50/30 rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex items-center justify-between text-left active:scale-[0.99]"
                          >
                            <div className="flex items-center space-x-4 min-w-0">
                              <div className="w-14 h-14 rounded-2xl bg-amber-50 group-hover:bg-amber-100 border border-amber-200/70 flex items-center justify-center text-3xl shadow-inner shrink-0 transition-colors">
                                {childIcon || '📁'}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center space-x-2">
                                  <h3 className="font-bold text-slate-900 group-hover:text-blue-600 text-base sm:text-lg leading-snug truncate transition-colors">
                                    {childTitle}
                                  </h3>
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md">
                                    Folder
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-1 font-medium line-clamp-1">
                                  {childSubtitle || (childCount > 0 ? `${childCount} सामग्री मौजूद` : 'फोल्डर खोलें')}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 text-slate-400 group-hover:text-blue-600 shrink-0 ml-3 transition-colors">
                              <span className="text-xs font-bold hidden sm:inline text-slate-500">खोलें</span>
                              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </button>
                        );
                      }

                      return (
                        <button
                          key={child.id}
                          onClick={handleChildClick}
                          className="group relative bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer flex flex-col items-start justify-between text-left overflow-hidden h-36 active:scale-98"
                        >
                          <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm animate-pulse"></span>
                          </div>

                          <div className="w-12 h-12 rounded-2xl bg-blue-50 group-hover:bg-blue-100 transition-colors flex items-center justify-center text-2xl shadow-inner flex-shrink-0 mb-2">
                            {childIcon}
                          </div>

                          <div className="w-full">
                            <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-sm sm:text-base leading-snug line-clamp-1">
                              {childTitle}
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5 font-medium line-clamp-1">
                              {childSubtitle}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                    <p className="text-sm text-slate-500">
                      {langHindi ? 'इस फोल्डर में कोई सामग्री नहीं है' : 'No items found in this folder'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </SafeErrorBoundary>
    );
  }

  // 2. MAINTENANCE MODE SCREEN (Controlled in Real-Time by Admin Panel)
  if (adminSettings?.maintenanceMode) {
    return (
      <SafeErrorBoundary fallbackView={() => {}}>
        <div 
          className="min-h-screen flex flex-col items-center justify-center p-6 text-center selection:bg-amber-500 selection:text-white"
          style={{ backgroundColor: adminSettings?.appBgColor || '#f8fafc' }}
        >
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200/80 shadow-xl flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-3xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-4xl mb-5 shadow-sm">
              🛠️
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">
              {adminSettings?.maintenanceTitle || 'ऐप मेंटेनेंस कार्य चल रहा है'}
            </h1>

            <p className="text-sm text-slate-600 leading-relaxed mb-5">
              {adminSettings?.maintenanceMessage || 'प्रिय छात्रों, हम ऐप को और बेहतर बनाने के लिए मेंटेनेंस कर रहे हैं। ऐप जल्द वापस चालू हो जाएगा।'}
            </p>

            {adminSettings?.maintenanceEta && (
              <div className="w-full py-2.5 px-4 rounded-2xl bg-amber-50 border border-amber-200/60 text-amber-800 text-xs font-semibold mb-4">
                ⏱️ {adminSettings.maintenanceEta}
              </div>
            )}

            {adminSettings?.maintenanceContact && (
              <p className="text-xs text-slate-500 mb-6 font-medium">
                {adminSettings.maintenanceContact}
              </p>
            )}

            <button
              onClick={() => {
                loadStudyBullApp().then(appData => {
                  if (appData?.settings) {
                    setAdminSettings(appData.settings);
                  }
                });
              }}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-bold text-sm shadow-md active:scale-95 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              {langHindi ? 'पुनः जांचें (Refresh)' : 'Check Again'}
            </button>
          </div>
        </div>
      </SafeErrorBoundary>
    );
  }

  return (
    <SafeErrorBoundary fallbackView={() => setCurrentView('home')}>
      <div 
        className={`min-h-screen font-sans pb-16 selection:bg-blue-600 selection:text-white antialiased ${adminSettings?.darkMode ? 'dark bg-slate-950 text-white' : 'text-slate-900'}`}
        style={{
          backgroundColor: adminSettings?.darkMode ? '#0b1120' : (adminSettings?.appBgColor || '#f1f5ff')
        }}
      >
        {/* Top Header - Controlled live by Admin App */}
        <header 
          className="sticky top-0 z-40 text-white shadow-md transition-all"
          style={{
            background: `linear-gradient(to right, ${adminSettings?.primaryColor || '#1546b5'}, ${adminSettings?.secondaryColor || '#3d2db3'})`
          }}
        >
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {currentView !== 'home' ? (
                <button 
                  onClick={handleBack}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs flex items-center space-x-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{langHindi ? 'वापस' : 'Back'}</span>
                </button>
              ) : (
                adminSettings?.logoImageUrl ? (
                  <img 
                    src={adminSettings.logoImageUrl} 
                    alt="Logo" 
                    className="w-9 h-9 rounded-2xl object-cover shadow-inner select-none"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-2xl bg-amber-400 flex items-center justify-center text-xl shadow-inner select-none">
                    {adminSettings?.logoEmoji || '🤓'}
                  </div>
                )
              )}
              <div>
                <h1 className="text-base font-bold tracking-wide flex items-center gap-2">
                  {getHeaderTitle()}
                </h1>
                {currentView === 'home' && adminSettings?.appSubtitle && (
                  <p className="text-[10px] text-white/80 line-clamp-1 leading-tight">
                    {adminSettings.appSubtitle}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setLangHindi(!langHindi)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition border border-white/20 active:scale-95 cursor-pointer"
              >
                {langHindi ? 'EN' : 'हिंदी'}
              </button>

              <button
                onClick={() => setSoundMuted(!soundMuted)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition border border-white/20 active:scale-95 cursor-pointer"
                title={soundMuted ? 'ध्वनि चालू करें' : 'ध्वनि बंद करें'}
              >
                {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Real-time Announcement Bar from Admin Panel */}
          {currentView === 'home' && adminSettings?.announcementEnabled !== false && adminSettings?.announcementText && (
            <div className="bg-amber-400 text-slate-950 text-xs font-semibold px-4 py-2 flex items-center space-x-2 border-t border-amber-300 shadow-inner">
              <span className="shrink-0 text-sm">📢</span>
              <span className="truncate">{adminSettings.announcementText}</span>
            </div>
          )}
        </header>

        {/* Main View Area */}
        <main className="max-w-4xl mx-auto px-4 py-6">
          <AnimatePresence mode="wait">
            {/* 1. HOME SCREEN: ONLY CLEAN PURE BUTTON CARDS (NO EXPLORE/START AT BOTTOM) */}
            {currentView === 'home' && (
              <>
                {/* Admin Welcome Heading if configured */}
                {adminSettings?.welcomeHeading && (
                  <div className="mb-4">
                    <h2 className="text-lg sm:text-xl font-black text-slate-800">
                      {adminSettings.welcomeHeading}
                    </h2>
                    {adminSettings?.appSubtitle && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {adminSettings.appSubtitle}
                      </p>
                    )}
                  </div>
                )}
                <motion.div
                  key="home-grid"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.16 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {/* Empty State when no buttons are added yet from Admin Panel */}
                    {adminNodes.length === 0 && (
                      <div className="col-span-2 sm:col-span-2 md:col-span-3 border-2 border-dashed border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center text-center text-slate-400 select-none bg-slate-50/60 my-6">
                        <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-2xl mb-3">
                          📲
                        </div>
                        <h3 className="text-base font-bold text-slate-800">
                          {langHindi ? 'कोई बटन अभी नहीं है' : 'No Buttons Added Yet'}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm">
                          {langHindi 
                            ? 'अपने Admin Panel से Calculation, Typing Test, Quiz या Notes जोड़ें। वे तुरंत यहाँ दिखाई देंगे।'
                            : 'Add Calculation, Typing Test, Quiz or Notes from your Admin Panel. They will appear here live.'}
                        </p>
                      </div>
                    )}

                    {/* All Buttons, Folders, and Sections Added via Admin Panel */}
                    {adminNodes.map((btn: any) => {
                      const target = String(btn.view || btn.target_view || btn.type || btn.id || '').toLowerCase();
                      const isCalc = target.includes('calc') || 
                        btn.kind === 'calc' || 
                        String(btn.title || '').toLowerCase().includes('calc') || 
                        String(btn.title || '').includes('कैलकुलेशन') || 
                        String(btn.title || '').toLowerCase().includes('speed math');
                      const isTyping = target.includes('typing') || 
                        btn.kind === 'typing' || 
                        String(btn.title || '').toLowerCase().includes('typing') || 
                        String(btn.title || '').includes('टाइपिंग');
                      const hasCustomHtml = Boolean(
                        btn.htmlContent || btn.html || btn.code || btn.rawHtml ||
                        (typeof btn.content === 'string' && (btn.content.includes('<html') || btn.content.includes('<!DOCTYPE') || btn.content.includes('<script')))
                      );
                      const displayTitle = resolveNodeTitle(btn, langHindi);
                      const displayIcon = resolveNodeIcon(btn);
                      const displaySubtitle = resolveNodeSubtitle(btn, langHindi);

                      const isSection = isSectionNode(btn);
                      const isFolder = isFolderNode(btn);

                      const handleNodeClick = () => {
                        if (isSection) return; // Sections are visual dividers/headers
                        if (btn.url) {
                          window.open(btn.url, '_blank');
                          return;
                        }
                        if (isCalc) {
                          navigateTo('calc_setup');
                          return;
                        }
                        if (isTyping) {
                          navigateTo('typing_setup');
                          return;
                        }
                        if (hasCustomHtml || (btn.kind === 'html' && btn.id !== 'calc')) {
                          setActiveCustomNode(btn);
                          setHtmlIsFullscreen(false);
                          navigateTo('custom_node');
                          return;
                        }
                        if (target.includes('mock')) {
                          setMockIndex(0);
                          setUserMockAnswers(new Array(MOCK_TEST_QUESTIONS.length).fill(null));
                          setMockTimer(600);
                          setMockTimerActive(true);
                          navigateTo('mock_play');
                        } else if (target.includes('quiz')) {
                          navigateTo('quiz_categories');
                        } else if (target.includes('note') || target.includes('pdf')) {
                          navigateTo('notes_lib');
                        } else {
                          setActiveCustomNode(btn);
                          setHtmlIsFullscreen(false);
                          navigateTo('custom_node');
                        }
                      };

                        // 1. SECTION (Image: Full-width horizontal title banner with tag badge)
                        if (isSection) {
                          return (
                            <div
                              key={btn.id}
                              className="col-span-2 sm:col-span-2 md:col-span-3 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-white border border-blue-200/80 rounded-2xl p-4 flex items-center justify-between shadow-sm my-1"
                            >
                              <div className="flex items-center space-x-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xl shrink-0 shadow-sm">
                                  {displayIcon || '📑'}
                                </div>
                                <div className="min-w-0">
                                  <h3 className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight truncate">
                                    {displayTitle}
                                  </h3>
                                  {displaySubtitle && (
                                    <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                                      {displaySubtitle}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <span className="shrink-0 px-2.5 py-1 bg-blue-100 text-blue-700 font-bold text-[10px] rounded-lg uppercase tracking-wider">
                                Section
                              </span>
                            </div>
                          );
                        }

                        // 2. FOLDER (Image: Horizontal full-width card with Folder icon, title, subtitle & chevron)
                        if (isFolder) {
                          const childCount = Array.isArray(btn.children) ? btn.children.length : 0;
                          return (
                            <button
                              key={btn.id}
                              onClick={handleNodeClick}
                              className="col-span-2 sm:col-span-2 md:col-span-3 group relative bg-white hover:bg-blue-50/30 rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex items-center justify-between text-left active:scale-[0.99]"
                            >
                              <div className="flex items-center space-x-4 min-w-0">
                                <div className="w-14 h-14 rounded-2xl bg-amber-50 group-hover:bg-amber-100 border border-amber-200/70 flex items-center justify-center text-3xl shadow-inner shrink-0 transition-colors">
                                  {displayIcon || '📁'}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center space-x-2">
                                    <h3 className="font-bold text-slate-900 group-hover:text-blue-600 text-base sm:text-lg leading-snug truncate transition-colors">
                                      {displayTitle}
                                    </h3>
                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md">
                                      Folder
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 mt-1 font-medium line-clamp-1">
                                    {displaySubtitle || (childCount > 0 ? `${childCount} सामग्री मौजूद` : 'फोल्डर खोलें')}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2 text-slate-400 group-hover:text-blue-600 shrink-0 ml-3 transition-colors">
                                <span className="text-xs font-bold hidden sm:inline text-slate-500">खोलें</span>
                                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                              </div>
                            </button>
                          );
                        }

                        // 3. BUTTON (Cube Grid Card: Square rounded card with icon in light blue box, title, and subtitle)
                        return (
                          <button
                            key={btn.id}
                            onClick={handleNodeClick}
                            className="group relative bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer flex flex-col items-start justify-between text-left overflow-hidden h-36 active:scale-98"
                          >
                            <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm animate-pulse"></span>
                            </div>

                            <div className="w-12 h-12 rounded-2xl bg-blue-50 group-hover:bg-blue-100 transition-colors flex items-center justify-center text-2xl shadow-inner flex-shrink-0 mb-2">
                              {displayIcon}
                            </div>

                            <div className="w-full">
                              <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-sm sm:text-base leading-snug line-clamp-1">
                                {displayTitle}
                              </h3>
                              <p className="text-xs text-slate-500 mt-0.5 font-medium line-clamp-1">
                                {displaySubtitle}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
              </>
            )}

            {/* 2. QUIZ SUBJECT CATEGORIES */}
            {currentView === 'quiz_categories' && (
              <motion.div
                key="quiz-categories"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.16 }}
                className="space-y-6"
              >
                <div className="text-center mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                    {langHindi ? 'विषयवार प्रैक्टिस क्विज' : 'Subject-Wise Practice Quizzes'}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    {langHindi ? 'विषय चुनें और 4-विकल्प MCQs हल करें' : 'Select a subject to practice 4-option MCQs'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {QUIZ_SUBJECTS.map((subj) => (
                    <button
                      key={subj.id}
                      onClick={() => {
                        setSelectedSubject(subj);
                        setQuizQuestions(subj.questions);
                        setQuizIndex(0);
                        setUserQuizAnswers(new Array(subj.questions.length).fill(null));
                        setQuizScore(0);
                        setIsAnswerRevealed(false);
                        navigateTo('quiz_play');
                      }}
                      className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md hover:border-blue-300 cursor-pointer flex items-center space-x-4 text-left transition active:scale-98"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-2xl flex-shrink-0">
                        {subj.icon}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">{langHindi ? subj.title : subj.titleEn}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{langHindi ? subj.subtitle : subj.subtitleEn}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* 3. QUIZ PLAY (MCQ REAL EXPERIENCE WITH INSTANT GREEN/RED FEEDBACK) */}
            {currentView === 'quiz_play' && quizQuestions && quizQuestions.length > 0 && (
              <motion.div
                key="quiz-play"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 sm:p-8 max-w-2xl mx-auto space-y-6"
              >
                {(() => {
                  const currentQ = quizQuestions[quizIndex] || quizQuestions[0];
                  return (
                    <>
                      <div className="flex items-center justify-between pb-4 border-b border-slate-100 text-xs font-bold text-slate-500">
                        <span>प्रश्न {quizIndex + 1} / {quizQuestions.length}</span>
                        <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-bold">
                          स्कोर: {quizScore}
                        </span>
                      </div>

                      <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-relaxed">
                        {langHindi ? currentQ.question : currentQ.questionEn}
                      </h2>

                      <div className="space-y-3">
                        {currentQ.options.map((opt, idx) => {
                          const isCorrect = idx === currentQ.correct;
                          const isSelected = userQuizAnswers[quizIndex] === idx;
                          let btnStyle = "border-slate-200 bg-white hover:bg-slate-50 text-slate-800";
                          let icon = null;

                          if (isAnswerRevealed) {
                            if (isCorrect) {
                              btnStyle = "border-emerald-500 bg-emerald-50 text-emerald-950 font-bold shadow-sm";
                              icon = <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
                            } else if (isSelected) {
                              btnStyle = "border-rose-500 bg-rose-50 text-rose-950 font-bold shadow-sm";
                              icon = <XCircle className="w-5 h-5 text-rose-600" />;
                            }
                          }

                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                if (!isAnswerRevealed) {
                                  const updated = [...userQuizAnswers];
                                  updated[quizIndex] = idx;
                                  setUserQuizAnswers(updated);
                                  setIsAnswerRevealed(true);

                                  if (idx === currentQ.correct) {
                                    playGentleSound('correct', soundMuted);
                                    setQuizScore(prev => prev + 1);
                                  } else {
                                    playGentleSound('wrong', soundMuted);
                                  }
                                }
                              }}
                              disabled={isAnswerRevealed}
                              className={"w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center justify-between font-medium active:scale-98 cursor-pointer " + btnStyle}
                            >
                              <div className="flex items-center gap-3">
                                <span className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                                  {String.fromCharCode(65 + idx)}
                                </span>
                                <span>{langHindi ? opt : currentQ.optionsEn?.[idx] || opt}</span>
                              </div>
                              {icon}
                            </button>
                          );
                        })}
                      </div>

                      {isAnswerRevealed && (
                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-950">
                          <p className="font-bold mb-1 flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-blue-600" /> व्याख्या (Explanation):
                          </p>
                          <p>{langHindi ? currentQ.explanation : currentQ.explanationEn}</p>
                        </div>
                      )}

                      {isAnswerRevealed && (
                        <div className="flex justify-end pt-2">
                          <button
                            onClick={() => {
                              if (quizIndex + 1 < quizQuestions.length) {
                                setQuizIndex(prev => prev + 1);
                                setIsAnswerRevealed(false);
                              } else {
                                playGentleSound('celebrate', soundMuted);
                                recordUserAttempt('quiz', {
                                  subject: selectedSubject.title,
                                  score: quizScore,
                                  total: quizQuestions.length
                                });
                                navigateTo('quiz_result');
                              }
                            }}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-md transition flex items-center gap-2 active:scale-95 cursor-pointer"
                          >
                            <span>{quizIndex + 1 < quizQuestions.length ? 'अगला प्रश्न' : 'रिजल्ट देखें'}</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </motion.div>
            )}

            {/* 4. QUIZ RESULT SCORECARD & COMPREHENSIVE ANSWER REVIEW */}
            {currentView === 'quiz_result' && (
              <motion.div
                key="quiz-result"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-xl mx-auto text-center shadow-lg space-y-6"
              >
                <div className="w-20 h-20 bg-amber-100 text-amber-700 rounded-3xl mx-auto flex items-center justify-center text-4xl shadow-inner select-none">
                  🏆
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-1">क्विज परिणाम (Scorecard)</h2>
                  <p className="text-xs text-slate-500">{langHindi ? selectedSubject.title : selectedSubject.titleEn}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold">कुल सही (Correct)</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">{quizScore}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold">कुल गलत (Incorrect)</p>
                    <p className="text-2xl font-bold text-rose-600 mt-1">{quizQuestions.length - quizScore}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold">सटीकता (Accuracy)</p>
                    <p className="text-xl font-bold text-purple-600 mt-1">{Math.round((quizScore / (quizQuestions.length || 1)) * 100)}%</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold">कुल प्रश्न (Total)</p>
                    <p className="text-xl font-bold text-blue-600 mt-1">{quizQuestions.length}</p>
                  </div>
                </div>

                {/* Question Review Section */}
                <div className="text-left border-t border-slate-100 pt-4">
                  <button
                    onClick={() => setReviewExpanded(!reviewExpanded)}
                    className="w-full flex items-center justify-between text-xs font-bold text-blue-700 bg-blue-50 px-4 py-2.5 rounded-xl transition cursor-pointer"
                  >
                    <span>{reviewExpanded ? 'विस्तृत समीक्षा छुपाएं' : 'सभी प्रश्नों की विस्तृत समीक्षा देखें'}</span>
                    {reviewExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {reviewExpanded && (
                    <div className="mt-4 space-y-4 max-h-96 overflow-y-auto pr-1">
                      {quizQuestions.map((q, idx) => {
                        const userAns = userQuizAnswers[idx];
                        const isCorrect = userAns === q.correct;
                        return (
                          <div key={idx} className={"p-4 rounded-2xl border text-xs " + (isCorrect ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200')}>
                            <p className="font-bold text-slate-900 mb-1">
                              Q{idx + 1}. {langHindi ? q.question : q.questionEn}
                            </p>
                            <p className="text-slate-700 mb-1">
                              आपका उत्तर: <span className={isCorrect ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                                {userAns !== null && userAns !== undefined ? q.options[userAns] : 'अनुत्तरित'}
                              </span>
                            </p>
                            {!isCorrect && (
                              <p className="text-emerald-800 font-bold mb-1">
                                सही उत्तर: {q.options[q.correct]}
                              </p>
                            )}
                            <p className="text-slate-600 mt-1 italic">
                              💡 {langHindi ? q.explanation : q.explanationEn}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setQuizIndex(0);
                      setUserQuizAnswers(new Array(quizQuestions.length).fill(null));
                      setQuizScore(0);
                      setIsAnswerRevealed(false);
                      navigateTo('quiz_play');
                    }}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition flex items-center justify-center gap-2 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" /> पुनः अभ्यास
                  </button>
                  <button
                    onClick={() => navigateTo('quiz_categories')}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition active:scale-95 cursor-pointer"
                  >
                    विषय बदलें
                  </button>
                </div>
              </motion.div>
            )}

            {/* 5. MOCK TEST PLAY */}
            {currentView === 'mock_play' && (
              <motion.div
                key="mock-play"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 sm:p-8 max-w-2xl mx-auto space-y-6"
              >
                {(() => {
                  const currentMockQ = mockQuestions[mockIndex] || mockQuestions[0];
                  return (
                    <>
                      <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-2 font-mono text-emerald-400 font-bold text-lg">
                          <Clock className="w-5 h-5" />
                          <span>{String(Math.floor(mockTimer / 60)).padStart(2, '0')}:{String(mockTimer % 60).padStart(2, '0')}</span>
                        </div>
                        <div className="text-xs font-bold text-slate-300">
                          प्रश्न {mockIndex + 1} / {mockQuestions.length}
                        </div>
                        <button
                          onClick={() => {
                            setMockTimerActive(false);
                            playGentleSound('celebrate', soundMuted);
                            navigateTo('mock_result');
                          }}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer"
                        >
                          सबमिट करें (Submit)
                        </button>
                      </div>

                      {/* Question Navigation Palette */}
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {mockQuestions.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setMockIndex(i)}
                            className={"w-9 h-9 rounded-xl font-bold text-xs transition cursor-pointer " + (mockIndex === i ? 'bg-blue-600 text-white ring-2 ring-blue-300' : userMockAnswers[i] !== null ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700')}
                          >
                            {i + 1}
                          </button>
                        ))}
                      </div>

                      <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-relaxed">
                        {langHindi ? currentMockQ.question : currentMockQ.questionEn}
                      </h2>

                      <div className="space-y-3">
                        {currentMockQ.options.map((opt, idx) => {
                          const isSelected = userMockAnswers[mockIndex] === idx;
                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                const updated = [...userMockAnswers];
                                updated[mockIndex] = idx;
                                setUserMockAnswers(updated);
                              }}
                              className={"w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center gap-3 font-medium active:scale-98 cursor-pointer " + (isSelected ? 'border-blue-600 bg-blue-50 text-blue-950 font-bold' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800')}
                            >
                              <span className={"w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold " + (isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600')}>
                                {String.fromCharCode(65 + idx)}
                              </span>
                              <span>{opt}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex justify-between pt-4 border-t border-slate-100">
                        <button
                          onClick={() => setMockIndex(prev => Math.max(0, prev - 1))}
                          disabled={mockIndex === 0}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm disabled:opacity-50 active:scale-95 cursor-pointer"
                        >
                          पिछला (Previous)
                        </button>
                        <button
                          onClick={() => {
                            if (mockIndex + 1 < mockQuestions.length) {
                              setMockIndex(prev => prev + 1);
                            } else {
                              setMockTimerActive(false);
                              playGentleSound('celebrate', soundMuted);
                              recordUserAttempt('mock', {
                                answers: userMockAnswers,
                                timeTaken: 600 - mockTimer
                              });
                              navigateTo('mock_result');
                            }
                          }}
                          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-sm active:scale-95 cursor-pointer"
                        >
                          {mockIndex + 1 < mockQuestions.length ? 'अगला (Next)' : 'सबमिट टेस्ट'}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </motion.div>
            )}

            {/* 6. MOCK TEST RESULT REPORT */}
            {currentView === 'mock_result' && (
              <motion.div
                key="mock-result"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-xl mx-auto text-center shadow-lg space-y-6"
              >
                <div className="w-20 h-20 bg-blue-100 text-blue-700 rounded-3xl mx-auto flex items-center justify-center text-4xl shadow-inner select-none">
                  📊
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-1">मॉक टेस्ट स्कोरकार्ड (Analysis)</h2>
                  <p className="text-xs text-slate-500">Real Exam Simulation Report</p>
                </div>

                {(() => {
                  let correct = 0;
                  let wrong = 0;
                  let unattempted = 0;
                  mockQuestions.forEach((q, idx) => {
                    const ans = userMockAnswers[idx];
                    if (ans === null || ans === undefined) unattempted++;
                    else if (ans === q.correct) correct++;
                    else wrong++;
                  });

                  return (
                    <>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200">
                          <p className="text-xs text-emerald-700 font-bold">सही (Correct)</p>
                          <p className="text-2xl font-bold text-emerald-800 mt-1">{correct}</p>
                        </div>
                        <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200">
                          <p className="text-xs text-rose-700 font-bold">गलत (Wrong)</p>
                          <p className="text-2xl font-bold text-rose-800 mt-1">{wrong}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                          <p className="text-xs text-slate-600 font-bold">छोड़े गए (Skipped)</p>
                          <p className="text-2xl font-bold text-slate-800 mt-1">{unattempted}</p>
                        </div>
                      </div>

                      {/* Mock Detailed Review */}
                      <div className="text-left border-t border-slate-100 pt-4">
                        <button
                          onClick={() => setReviewExpanded(!reviewExpanded)}
                          className="w-full flex items-center justify-between text-xs font-bold text-blue-700 bg-blue-50 px-4 py-2.5 rounded-xl transition cursor-pointer"
                        >
                          <span>{reviewExpanded ? 'प्रश्नों की समीक्षा छुपाएं' : 'प्रश्नों के सही उत्तर व व्याख्या देखें'}</span>
                          {reviewExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>

                        {reviewExpanded && (
                          <div className="mt-4 space-y-4 max-h-96 overflow-y-auto pr-1">
                            {mockQuestions.map((q, idx) => {
                              const userAns = userMockAnswers[idx];
                              const isCorrect = userAns === q.correct;
                              return (
                                <div key={idx} className={"p-4 rounded-2xl border text-xs " + (isCorrect ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-slate-200')}>
                                  <p className="font-bold text-slate-900 mb-1">
                                    Q{idx + 1}. {langHindi ? q.question : q.questionEn}
                                  </p>
                                  <p className="text-slate-700 mb-1">
                                    आपका उत्तर: <span className={isCorrect ? 'text-emerald-700 font-bold' : userAns === null ? 'text-slate-500' : 'text-rose-700 font-bold'}>
                                      {userAns !== null && userAns !== undefined ? q.options[userAns] : 'छोड़ा गया'}
                                    </span>
                                  </p>
                                  <p className="text-emerald-800 font-bold mb-1">
                                    सही उत्तर: {q.options[q.correct]}
                                  </p>
                                  <p className="text-slate-600 mt-1 italic">
                                    💡 {langHindi ? q.explanation : q.explanationEn}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setUserMockAnswers(new Array(MOCK_TEST_QUESTIONS.length).fill(null));
                      setMockIndex(0);
                      setMockTimer(600);
                      setMockTimerActive(true);
                      navigateTo('mock_play');
                    }}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition flex items-center justify-center gap-2 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" /> पुनः टेस्ट दें
                  </button>
                  <button
                    onClick={() => navigateTo('home')}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition active:scale-95 cursor-pointer"
                  >
                    होम स्क्रीन पर लौटें
                  </button>
                </div>
              </motion.div>
            )}

            {/* 7. NOTES LIBRARY */}
            {currentView === 'notes_lib' && (
              <motion.div
                key="notes-lib"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.16 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">विषयवार PDF नोट्स लाइब्रेरी</h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">विषय चुनें और इन-ऐप PDF नोट्स पढ़ें</p>
                </div>

                <div className="space-y-3 max-w-2xl mx-auto">
                  {NOTES_CHAPTERS.map((chap) => (
                    <button
                      key={chap.id}
                      onClick={() => {
                        setSelectedChapter(chap);
                        navigateTo('notes_reader');
                      }}
                      className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:border-blue-300 cursor-pointer flex items-center justify-between text-left transition active:scale-98"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-lg flex-shrink-0">
                          📄
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm sm:text-base">{langHindi ? chap.title : chap.titleEn}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">{chap.subtitle}</p>
                        </div>
                      </div>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* 8. NOTES FULL SCREEN READER */}
            {currentView === 'notes_reader' && (
              <motion.div
                key="notes-reader"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className={"rounded-3xl shadow-lg border p-6 sm:p-8 max-w-3xl mx-auto transition-colors " + (readerDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900')}
              >
                {(() => {
                  const chap = selectedChapter || NOTES_CHAPTERS[0];
                  return (
                    <>
                      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-6 flex-wrap gap-3">
                        <button
                          onClick={handleBack}
                          className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-sm hover:bg-blue-700 transition active:scale-95 cursor-pointer"
                        >
                          ← वापस
                        </button>
                        <span className="text-xs font-medium opacity-70">Study Bull Official Notes</span>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setReaderDarkMode(!readerDarkMode)}
                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition active:scale-95 cursor-pointer"
                          >
                            {readerDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(chap.content);
                              setCopiedNotification(true);
                              setTimeout(() => setCopiedNotification(false), 2000);
                            }}
                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition relative active:scale-95 cursor-pointer"
                          >
                            <Copy className="w-4 h-4" />
                            {copiedNotification && (
                              <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded shadow">
                                Copied!
                              </span>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-6 mb-6 shadow-sm flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider bg-white/20 px-2.5 py-1 rounded-full">CHAPTER</span>
                          <h2 className="text-lg sm:text-xl font-bold mt-2">{langHindi ? chap.title : chap.titleEn}</h2>
                        </div>
                        <Sparkles className="w-8 h-8 text-amber-300 flex-shrink-0" />
                      </div>

                      <div className="prose max-w-none leading-relaxed whitespace-pre-line font-medium mb-8 text-base">
                        {chap.content}
                      </div>
                    </>
                  );
                })()}
              </motion.div>
            )}

            {/* 9. CALCULATION SETUP SCREEN (ALL SUBJECTS: PERCENTAGE, PROFIT & LOSS, TIME & WORK, ETC.) */}
            {currentView === 'calc_setup' && (
              <motion.div
                key="calc-setup"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="space-y-6 max-w-2xl mx-auto"
              >
                {/* Question Count */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">प्रश्नों की संख्या (Question Count)</h3>
                  <div className="grid grid-cols-5 gap-2">
                    {[10, 25, 50, 100, 'Infinite'].map((cnt) => (
                      <button
                        key={String(cnt)}
                        onClick={() => setCalcCount(cnt as number | 'Infinite')}
                        className={"py-3 rounded-xl font-bold text-xs sm:text-sm border transition active:scale-95 cursor-pointer " + (calcCount === cnt ? 'bg-blue-600 border-blue-500 text-white shadow-sm' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200')}
                      >
                        {cnt === 'Infinite' ? 'असीमित' : `${cnt} Q`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Difficulty */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-amber-500" /> कठिनाई स्तर (Difficulty)
                  </h3>
                  <div className="grid grid-cols-4 gap-2">
                    {(['सरल', 'मध्यम', 'कठिन', 'प्रो'] as const).map((diff) => (
                      <button
                        key={diff}
                        onClick={() => setCalcDifficulty(diff)}
                        className={"py-3 rounded-xl font-bold text-xs sm:text-sm border transition active:scale-95 cursor-pointer " + (calcDifficulty === diff ? 'bg-blue-600 border-blue-500 text-white shadow-sm' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200')}
                      >
                        {diff}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mathematics Subjects */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Calculator className="w-4 h-4 text-blue-600" /> विषय चुनें (Math Topics)
                    </h3>
                    <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                      {ALL_MATH_TOPICS.length} विषय उपलब्ध
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                    {ALL_MATH_TOPICS.map((top) => (
                      <button
                        key={top}
                        onClick={() => setCalcTopic(top)}
                        className={"p-3 rounded-xl text-left font-bold text-xs sm:text-sm border transition flex items-center gap-2.5 active:scale-98 cursor-pointer " + (calcTopic === top ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100')}
                      >
                        <span className={"w-2.5 h-2.5 rounded-full shrink-0 " + (calcTopic === top ? 'bg-blue-600 ring-4 ring-blue-100' : 'bg-slate-300')}></span>
                        <span className="truncate">{top}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Start Button */}
                <button
                  onClick={generateCalculationSet}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-bold text-base shadow-md flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
                >
                  <span>🚀 अभ्यास शुरू करें ({calcCount === 'Infinite' ? 'असीमित प्रश्न' : `${calcCount} प्रश्न`})</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}

            {/* 10. CALCULATION PRACTICE (INSTANT FEEDBACK, ZERO REPETITIONS, 100% ACCURATE MATH) */}
            {currentView === 'calc_practice' && calcQuestions && calcQuestions.length > 0 && (
              <motion.div
                key="calc-practice"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="max-w-2xl mx-auto space-y-4"
              >
                {(() => {
                  const currentCalcQ = calcQuestions[calcIndex] || calcQuestions[0];
                  return (
                    <>
                      <div className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center justify-between text-xs font-bold text-slate-700 shadow-sm flex-wrap gap-2">
                        <span className="truncate max-w-[180px] sm:max-w-[220px]">टॉपिक: {currentCalcQ.category || calcTopic}</span>
                        <div className="flex items-center gap-3 sm:gap-4">
                          <span className="text-amber-600 flex items-center gap-1">
                            <Zap className="w-3.5 h-3.5" /> {calcScore}
                          </span>
                          <span className="flex items-center gap-1 text-blue-600">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{String(Math.floor(calcTimer / 60)).padStart(2, '0')}:{String(calcTimer % 60).padStart(2, '0')}</span>
                          </span>
                          <span className="bg-slate-100 px-2.5 py-1 rounded-lg">
                            Q {calcIndex + 1} {calcCount === 'Infinite' ? '(∞ असीमित)' : `/ ${calcQuestions.length}`}
                          </span>
                          {calcCount === 'Infinite' && (
                            <button
                              onClick={() => {
                                setCalcTimerActive(false);
                                playGentleSound('celebrate', soundMuted);
                                recordUserAttempt('calc', {
                                  topic: calcTopic,
                                  difficulty: calcDifficulty,
                                  correct: calcCorrectCount,
                                  wrong: calcWrongCount,
                                  timeTaken: calcTimer
                                });
                                navigateTo('calc_result');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold transition text-[11px] cursor-pointer"
                            >
                              समाप्त करें
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 text-center shadow-sm relative overflow-hidden">
                        <span className="absolute top-3 left-4 text-[10px] uppercase font-bold tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                          स्पीड कैलकुलेशन • {calcDifficulty}
                        </span>
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 my-6 leading-relaxed">
                          {langHindi ? currentCalcQ.question : currentCalcQ.questionEn}
                        </h2>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {currentCalcQ.options.map((opt, idx) => {
                          let btnStyle = "border-slate-200 bg-white hover:bg-slate-50 text-slate-800";
                          let icon = null;

                          if (calcAnswered) {
                            if (idx === currentCalcQ.correct) {
                              btnStyle = "border-emerald-500 bg-emerald-50 text-emerald-900 font-bold shadow-sm";
                              icon = <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
                            } else if (idx === calcSelected) {
                              btnStyle = "border-rose-500 bg-rose-50 text-rose-900 font-bold shadow-sm";
                              icon = <XCircle className="w-5 h-5 text-rose-600" />;
                            }
                          }

                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                if (!calcAnswered) {
                                  setCalcSelected(idx);
                                  setCalcAnswered(true);
                                  const isCorrect = idx === currentCalcQ.correct;

                                  setCalcUserAnswers(prev => [...prev, { selected: idx, correct: isCorrect }]);

                                  if (isCorrect) {
                                    playGentleSound('correct', soundMuted);
                                    setCalcScore(prev => prev + 1);
                                    setCalcCorrectCount(prev => prev + 1);
                                  } else {
                                    playGentleSound('wrong', soundMuted);
                                    setCalcWrongCount(prev => prev + 1);
                                  }
                                }
                              }}
                              disabled={calcAnswered}
                              className={"p-4 sm:p-5 rounded-2xl border-2 transition-all flex items-center justify-between font-bold text-base sm:text-lg active:scale-98 cursor-pointer " + btnStyle}
                            >
                              <span>{opt}</span>
                              {icon}
                            </button>
                          );
                        })}
                      </div>

                      {calcAnswered && (
                        <div className={"rounded-2xl p-4 border text-sm " + (calcSelected === currentCalcQ.correct ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900')}>
                          <p className="font-bold mb-1">
                            {calcSelected === currentCalcQ.correct ? '✅ सही उत्तर!' : `❌ गलत उत्तर! सही उत्तर था: ${currentCalcQ.options[currentCalcQ.correct]}`}
                          </p>
                          <p className="text-xs text-slate-700 mt-1 font-medium whitespace-pre-line">
                            📖 {langHindi ? currentCalcQ.explanation : currentCalcQ.explanationEn}
                          </p>
                          {currentCalcQ.shortcut && (
                            <p className="text-xs text-blue-700 mt-1.5 font-semibold">
                              ⚡ {currentCalcQ.shortcut}
                            </p>
                          )}
                        </div>
                      )}

                      {calcAnswered && (
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              if (calcIndex + 1 < calcQuestions.length) {
                                setCalcIndex(prev => prev + 1);
                                setCalcSelected(null);
                                setCalcAnswered(false);
                              } else if (calcCount === 'Infinite') {
                                // Dynamically generate a brand new unique question on the fly
                                const nextQ = generateUnlimitedMathQuestion(
                                  calcTopic,
                                  calcQuestions.length + 1,
                                  calcDifficulty,
                                  seenMathSignaturesRef.current
                                );
                                setCalcQuestions(prev => [...prev, nextQ]);
                                setCalcIndex(prev => prev + 1);
                                setCalcSelected(null);
                                setCalcAnswered(false);

                                // Save updated signatures to localStorage
                                try {
                                  const arr = Array.from(seenMathSignaturesRef.current).slice(-2000);
                                  localStorage.setItem('study_seen_math_questions_v2', JSON.stringify(arr));
                                } catch {
                                  // Ignore
                                }
                              } else {
                                setCalcTimerActive(false);
                                playGentleSound('celebrate', soundMuted);
                                recordUserAttempt('calc', {
                                  topic: calcTopic,
                                  difficulty: calcDifficulty,
                                  correct: calcCorrectCount,
                                  wrong: calcWrongCount,
                                  timeTaken: calcTimer
                                });
                                navigateTo('calc_result');
                              }
                            }}
                            className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-md transition flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
                          >
                            <span>{calcCount === 'Infinite' || calcIndex + 1 < calcQuestions.length ? 'अगला प्रश्न' : 'रिजल्ट देखें'}</span>
                            <ChevronRight className="w-5 h-5" />
                          </button>

                          {calcCount === 'Infinite' && (
                            <button
                              onClick={() => {
                                setCalcTimerActive(false);
                                playGentleSound('celebrate', soundMuted);
                                recordUserAttempt('calc', {
                                  topic: calcTopic,
                                  difficulty: calcDifficulty,
                                  correct: calcCorrectCount,
                                  wrong: calcWrongCount,
                                  timeTaken: calcTimer
                                });
                                navigateTo('calc_result');
                              }}
                              className="px-5 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition active:scale-98 cursor-pointer text-sm"
                            >
                              समाप्त करें
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </motion.div>
            )}

            {/* 11. CALCULATION RESULT */}
            {currentView === 'calc_result' && (
              <motion.div
                key="calc-result"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-xl mx-auto text-center shadow-lg space-y-6"
              >
                <div className="w-20 h-20 bg-amber-100 text-amber-700 rounded-3xl mx-auto flex items-center justify-center text-4xl shadow-inner select-none">
                  🏆
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-1">कैलकुलेशन रिपोर्ट कार्ड (Analysis)</h2>
                  <p className="text-xs text-slate-500">{calcTopic} • {calcDifficulty}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold">कुल सही (Correct)</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">{calcCorrectCount}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold">कुल गलत (Incorrect)</p>
                    <p className="text-2xl font-bold text-rose-600 mt-1">{calcWrongCount}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold">कुल समय (Time Taken)</p>
                    <p className="text-xl font-bold text-blue-600 mt-1">{calcTimer}s</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold">सटीकता (Accuracy)</p>
                    <p className="text-xl font-bold text-purple-600 mt-1">{Math.round((calcCorrectCount / (calcQuestions.length || 1)) * 100)}%</p>
                  </div>
                </div>

                {/* Calculation Questions Review */}
                <div className="text-left border-t border-slate-100 pt-4">
                  <button
                    onClick={() => setReviewExpanded(!reviewExpanded)}
                    className="w-full flex items-center justify-between text-xs font-bold text-blue-700 bg-blue-50 px-4 py-2.5 rounded-xl transition cursor-pointer"
                  >
                    <span>{reviewExpanded ? 'सवालों की व्याख्या छुपाएं' : 'सभी सवालों के हल और शॉर्टकट ट्रिक्स देखें'}</span>
                    {reviewExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {reviewExpanded && (
                    <div className="mt-4 space-y-4 max-h-96 overflow-y-auto pr-1">
                      {calcQuestions.map((q, idx) => {
                        const userAns = calcUserAnswers[idx];
                        const isCorrect = userAns ? userAns.correct : false;
                        return (
                          <div key={idx} className={"p-4 rounded-2xl border text-xs " + (isCorrect ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200')}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-slate-900">Q{idx + 1}. {q.question}</span>
                              <span className={"font-bold px-2 py-0.5 rounded " + (isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800')}>
                                {isCorrect ? 'सही' : 'गलत'}
                              </span>
                            </div>
                            <p className="text-emerald-800 font-bold mb-1">
                              सही उत्तर: {q.options[q.correct]}
                            </p>
                            <p className="text-slate-700 whitespace-pre-line mt-1">
                              {q.explanation}
                            </p>
                            {q.shortcut && (
                              <p className="text-blue-700 font-semibold mt-1">
                                ⚡ {q.shortcut}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={generateCalculationSet}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition flex items-center justify-center gap-2 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" /> नया सेट हल करें
                  </button>
                  <button
                    onClick={() => navigateTo('calc_setup')}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition active:scale-95 cursor-pointer"
                  >
                    सेटअप बदलें
                  </button>
                </div>
              </motion.div>
            )}

            {/* 12. TYPING SKILLS SETUP */}
            {currentView === 'typing_setup' && (
              <motion.div
                key="typing-setup"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.16 }}
                className="space-y-6 max-w-2xl mx-auto"
              >
                <div className="text-center">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">⌨️ टाइपिंग स्पीड एवं एक्यूरेसी लैब</h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">SSC CGL, CHSL, Delhi Police HC स्पीड एवं एक्यूरेसी टेस्ट</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">समय अवधि चुनें (Duration):</h3>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 5, 10, 'Infinite'].map((dur) => (
                      <button
                        key={String(dur)}
                        onClick={() => setTypingDuration(dur as number | 'Infinite')}
                        className={"py-2.5 rounded-xl font-bold text-xs sm:text-sm border transition active:scale-95 cursor-pointer " + (typingDuration === dur ? 'bg-blue-600 border-blue-500 text-white shadow-sm' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200')}
                      >
                        {dur === 'Infinite' ? '∞ Free' : `${dur} मि`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {langHindi ? 'उपलब्ध टाइपिंग टेस्ट्स:' : 'Available Typing Tests:'}
                  </h3>

                  {(() => {
                    // Check if Admin panel configured tests inside a Typing folder, button, or children
                    const typingNode = adminNodes.find((n: any) => 
                      String(n.id || n.view || n.type || '').toLowerCase().includes('typing') ||
                      String(n.title || '').toLowerCase().includes('typing') ||
                      String(n.title || '').includes('टाइपिंग')
                    );
                    const adminTypingTests = (typingNode && Array.isArray(typingNode.passages) && typingNode.passages.length > 0)
                      ? typingNode.passages
                      : (typingNode && Array.isArray(typingNode.children) && typingNode.children.length > 0)
                        ? typingNode.children
                        : (typingNode && (typingNode.typingPassage || typingNode.passage))
                          ? [{ id: 'single-passage', title: typingNode.title || 'Typing Test', passage: typingNode.typingPassage || typingNode.passage }]
                          : [];

                    const defaultTests = [
                      {
                        id: 'typing-pass-1',
                        title: 'SSC CHSL / CGL English Typing Test Passage #1',
                        subtitle: 'English Standard Exam Passage',
                        passage: DEFAULT_TYPING_PASSAGE
                      },
                      {
                        id: 'typing-pass-2',
                        title: 'Delhi Police HC Typing Passage #2',
                        subtitle: 'General Knowledge & Official Duty Rules',
                        passage: 'Public administration requires accountability integrity and dedication to national service. The rule of law ensures that all individuals institutions and entities are responsible before the law that is equally enforced and independently adjudicated.'
                      },
                      {
                        id: 'typing-pass-3',
                        title: 'Court Clerk / Stenographer Practice Passage #3',
                        subtitle: 'Legal Terminology & Precision Typing',
                        passage: 'The judicial system safeguards constitutional principles and protects democratic freedoms. Every judgment delivered by the court serves as an instrument of justice equality and social welfare across all jurisdictions.'
                      }
                    ];

                    const testList = adminTypingTests.length > 0 ? adminTypingTests : defaultTests;

                    return testList.map((testItem: any, idx: number) => {
                      const id = testItem.id || `typing-${idx}`;
                      const title = testItem.title || testItem.name || `टाइपिंग टेस्ट सेट #${idx + 1}`;
                      const sub = testItem.subtitle || testItem.sub || 'SSC & State Exams Typing';
                      const text = testItem.passage || testItem.text || testItem.typingPassage || testItem.content || testItem.html || DEFAULT_TYPING_PASSAGE;

                      return (
                        <button
                          key={id}
                          onClick={() => {
                            setActiveTypingPassage(text);
                            setActiveTypingTitle(title);
                            setTypedInput('');
                            setTypingStarted(false);
                            setTypingTimeLeft(typeof typingDuration === 'number' ? typingDuration * 60 : 120);
                            navigateTo('typing_practice');
                          }}
                          className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-md cursor-pointer flex items-center justify-between text-left transition active:scale-98 group"
                        >
                          <div className="flex items-center space-x-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 group-hover:bg-blue-100 text-blue-600 flex items-center justify-center text-lg flex-shrink-0 transition-colors">
                              ⌨️
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-slate-900 group-hover:text-blue-600 text-sm truncate transition-colors">
                                {title}
                              </h4>
                              <p className="text-xs text-slate-500 mt-0.5 truncate">{sub}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                {text.trim().split(/\s+/).filter(Boolean).length} शब्द • {text.length} अक्षर
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 shrink-0 ml-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                          </div>
                        </button>
                      );
                    });
                  })()}
                </div>
              </motion.div>
            )}

            {/* 13. TYPING PRACTICE SCREEN */}
            {currentView === 'typing_practice' && (
              <motion.div
                key="typing-practice"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 sm:p-8 max-w-2xl mx-auto space-y-6"
              >
                <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between shadow-sm">
                  <div className={"flex items-center gap-2 font-mono font-bold text-lg " + (typingTimeLeft <= 10 && typingDuration !== 'Infinite' ? 'text-rose-400 animate-pulse' : 'text-emerald-400')}>
                    <Clock className="w-5 h-5" />
                    <span>
                      {typingDuration === 'Infinite'
                        ? '∞ Free'
                        : `${String(Math.floor(typingTimeLeft / 60)).padStart(2, '0')}:${String(typingTimeLeft % 60).padStart(2, '0')}`}
                    </span>
                  </div>
                  <div className="text-center font-mono">
                    <p className="text-[10px] text-slate-400 uppercase">WPM</p>
                    <p className="text-xl font-bold text-blue-400">
                      {(() => {
                        const words = typedInput.trim().split(/\s+/).filter(Boolean).length;
                        const totalAllowedSec = typeof typingDuration === 'number' ? typingDuration * 60 : 120;
                        const elapsedSec = Math.max(1, totalAllowedSec - typingTimeLeft);
                        return Math.round((words / elapsedSec) * 60) || 0;
                      })()}
                    </p>
                  </div>
                  <div className="text-center font-mono">
                    <p className="text-[10px] text-slate-400 uppercase">ACC</p>
                    <p className="text-xl font-bold text-amber-400">
                      {(() => {
                        if (!typedInput) return '100%';
                        let correct = 0;
                        for (let i = 0; i < typedInput.length; i++) {
                          if (typedInput[i] === passageText[i]) correct++;
                        }
                        return `${Math.round((correct / typedInput.length) * 100)}%`;
                      })()}
                    </p>
                  </div>
                  <button
                    onClick={submitTypingTest}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition shadow-sm active:scale-95 cursor-pointer"
                  >
                    समाप्त
                  </button>
                </div>

                {/* Passage Box with Real-time Scrolling and Color-coded Characters */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
                    <span>मूल पैराग्राफ (टाइप करने हेतु टेक्स्ट):</span>
                    <span className="text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-mono">
                      {typedInput.length} / {passageText.length} अक्षर
                    </span>
                  </div>
                  <div 
                    ref={typingScrollRef}
                    className="bg-slate-50 p-4 sm:p-5 rounded-2xl text-slate-800 font-mono text-base sm:text-lg leading-relaxed border-2 border-slate-200 h-44 sm:h-52 overflow-y-auto overscroll-contain select-none shadow-inner"
                  >
                    {passageText.split('').map((char, index) => {
                      let charClass = "text-slate-700";
                      if (index < typedInput.length) {
                        if (typedInput[index] === char) {
                          charClass = "text-emerald-700 bg-emerald-100 font-bold";
                        } else {
                          charClass = "text-rose-700 bg-rose-200 font-bold underline";
                        }
                      } else if (index === typedInput.length) {
                        charClass = "active-char bg-blue-600 text-white font-bold underline px-0.5 rounded-xs ring-2 ring-blue-300 animate-pulse";
                      }
                      return (
                        <span key={index} className={charClass}>
                          {char}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Input Area (Strictly 2-3 lines height as requested) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
                    <span>टाइपिंग इनपुट (यहीं टाइप करें):</span>
                    <span className="text-[11px] text-slate-400">
                      {typingTimeLeft <= 0 && typingDuration !== 'Infinite' ? '⚠️ समय समाप्त (बंद)' : '2-3 पंक्तियों का कॉम्पैक्ट बॉक्स'}
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    disabled={typingTimeLeft <= 0 && typingDuration !== 'Infinite'}
                    value={typedInput}
                    onChange={(e) => {
                      if (!typingStarted) setTypingStarted(true);
                      setTypedInput(e.target.value);
                      if (e.target.value.length >= passageText.length) {
                        submitTypingTest();
                      }
                    }}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder={typingTimeLeft <= 0 && typingDuration !== 'Infinite' ? "समय समाप्त हो चुका है।" : "कीबोर्ड से यहाँ टाइप करना शुरू करें (2-3 पंक्तियाँ)..."}
                    className={"w-full h-20 sm:h-22 p-3 rounded-2xl border-2 font-mono text-sm sm:text-base leading-snug resize-none shadow-sm overscroll-contain transition-colors " + (typingTimeLeft <= 0 && typingDuration !== 'Infinite' ? 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed' : 'border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none bg-white text-slate-900')}
                  />
                </div>
              </motion.div>
            )}

            {/* 14. TYPING RESULT REPORT */}
            {currentView === 'typing_result' && (
              <motion.div
                key="typing-result"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-xl mx-auto text-center shadow-lg space-y-6"
              >
                <div className="w-20 h-20 bg-emerald-100 text-emerald-700 rounded-3xl mx-auto flex items-center justify-center text-4xl shadow-inner select-none">
                  🎉
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-1">टाइपिंग टेस्ट स्कोरकार्ड</h2>
                  <p className="text-xs text-slate-600 font-semibold">{activeTypingTitle}</p>
                </div>

                {(() => {
                  let correctChars = 0;
                  for (let i = 0; i < typedInput.length; i++) {
                    if (typedInput[i] === passageText[i]) correctChars++;
                  }
                  const words = typedInput.trim().split(/\s+/).filter(Boolean).length;
                  const accuracy = typedInput.length > 0 ? Math.round((correctChars / typedInput.length) * 100) : 0;
                  const timeTakenSec = 120 - typingTimeLeft || 1;
                  const wpm = Math.round((words / timeTakenSec) * 60);

                  return (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <p className="text-xs text-slate-500 font-bold">स्पीड (Speed)</p>
                        <p className="text-2xl font-bold text-blue-600 mt-1">{wpm} WPM</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <p className="text-xs text-slate-500 font-bold">सटीकता (Accuracy)</p>
                        <p className="text-2xl font-bold text-emerald-600 mt-1">{accuracy}%</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <p className="text-xs text-slate-500 font-bold">टाइप किए गए शब्द</p>
                        <p className="text-xl font-bold text-slate-800 mt-1">{words}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <p className="text-xs text-slate-500 font-bold">कुल वर्ण (Chars)</p>
                        <p className="text-xl font-bold text-purple-600 mt-1">{typedInput.length}</p>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setTypedInput('');
                      setTypingStarted(false);
                      setTypingTimeLeft(120);
                      navigateTo('typing_practice');
                    }}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition flex items-center justify-center gap-2 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" /> पुनः टेस्ट दें
                  </button>
                  <button
                    onClick={() => navigateTo('typing_setup')}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition active:scale-95 cursor-pointer"
                  >
                    सेटअप बदलें
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </SafeErrorBoundary>
  );
}
