import React, { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { 
  Volume2, VolumeX, ArrowLeft, 
  CheckCircle2, XCircle, Clock, 
  RotateCcw, Sparkles, Calculator, Flame, Sun, Moon, Copy, ChevronRight, Award, Zap,
  Check, BookOpen, ChevronDown, ChevronUp, ExternalLink,
  Code, Eye, Maximize2, Minimize2, RefreshCw, Play,
  Plus, Edit3, Trash2, X
} from 'lucide-react';
import { m, AnimatePresence } from 'motion/react';
import { motionFeaturesReady } from './lib/motionLazy';
import { 
  loadStudyBullApp, 
  recordUserAttempt
} from './lib/supabase.ts';
import { splitStore } from './lib/splitStore';
import { SandboxedHtmlView } from './components/SandboxedHtmlView';
import { LevelList, pyqTagOf, stripPyq, PyqBadge, soleQuizChild } from './components/LevelList';
import { refreshNav } from './lib/freshNav';
import { MockRules, buildMockInfo, type MockInfo } from './components/MockRules';

// Code-defined screens load as separate chunks only when opened (smaller first download)
const EligibilityList = React.lazy(() => import('./components/EligibilityChecker').then((m) => ({ default: m.EligibilityList })));
const EligibilityExam = React.lazy(() => import('./components/EligibilityChecker').then((m) => ({ default: m.EligibilityExam })));
import { trackTile } from './lib/views';
const JobAlert = React.lazy(() => import('./components/JobAlert').then((m) => ({ default: m.JobAlert })));

// Return visit: home + already-opened tiles straight from the per-tile cache (split data layout)
const SPLIT_BOOT: { nodes: any[]; settings: any } | null = (() => {
  try {
    return typeof window !== 'undefined' ? splitStore.initFromCache() : null;
  } catch {
    return null;
  }
})();

function ScreenLoader() {
  return (
    <div className="flex items-center justify-center py-16 text-sm font-semibold text-slate-500 gap-2">
      <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      लोड हो रहा है…
    </div>
  );
}
import { playSound, initSound, type SoundType } from './lib/sound';

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

// Sound system: one shared, gesture-unlocked Web Audio context (see src/lib/sound.ts).
// Old version created a NEW AudioContext on every sound (never closed) — browsers cap these,
// so sounds stopped after a while, timer sounds stayed silent, and some were cut mid-way.
const playGentleSound = (type: SoundType, muted: boolean) => {
  playSound(type, muted);
};
initSound();

// One entry of the in-app navigation stack (mirrors browser history entries)
type NavSnapshot = { view: ViewState; node: any; folders: any[]; chapter: any };

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
  | 'custom_node'
  | 'eligibility'
  | 'eligibility_exam'
  | 'job_alert';

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
  pyq?: string; // real past-year tag, e.g. "SSC GD 2023" (badge)
}

interface Chapter {
  id: string;
  title: string;
  titleEn: string;
  subtitle: string;
  subtitleEn?: string;
  content: string;
}

// Admin panel saves the answer as `correctIndex`; older/imported data may use `correct` or `answerIndex`.
function resolveCorrectIndex(q: any): number {
  for (const v of [q?.correctIndex, q?.correct, q?.answerIndex]) {
    const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
    if (typeof n === 'number' && Number.isInteger(n) && n >= 0) return n;
  }
  return 0;
}

// Typing passage time in minutes: its own "duration" (minutes; a value over 60 is read as seconds), else from its
// length at the passage's target speed (or 30 WPM English / 25 WPM Hindi), rounded up, 2–15 min.
function typingPassageMinutes(p: any, text: string): number {
  const raw = Number(p?.duration ?? p?.durationMinutes ?? p?.minutes ?? p?.time);
  if (Number.isFinite(raw) && raw > 0) {
    const mins = raw > 60 ? Math.round(raw / 60) : raw;
    return Math.max(1, Math.min(60, Math.round(mins)));
  }
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  const hindi = String(p?.lang || '').toLowerCase().startsWith('hi') || /[\u0900-\u097F]/.test(String(text || '').slice(0, 200));
  const wpm = Number(p?.targetWpm) > 0 ? Number(p.targetWpm) : (hindi ? 25 : 30);
  return Math.max(2, Math.min(15, Math.ceil(words / wpm)));
}

// Mock duration as set in the admin panel (durationMinutes, default 60 min), in seconds.
function resolveMockDurationSec(node: any): number {
  const m = Number(node?.durationMinutes);
  return Number.isFinite(m) && m > 0 ? Math.round(m * 60) : 3600;
}

// Marks per question as set in the admin panel (positiveMarks / negativeMarks); fallback +1 / 0.
function resolveMockMarks(node: any): { pos: number; neg: number } {
  const p = Number(node?.positiveMarks);
  const n = Number(node?.negativeMarks);
  return {
    pos: Number.isFinite(p) && p > 0 ? p : 1,
    neg: Number.isFinite(n) ? Math.abs(n) : 0
  };
}

function fmtMarks(v: number): string {
  return String(Math.round(v * 100) / 100);
}

function findFirstMockNode(nodes: any[]): any | null {
  if (!Array.isArray(nodes)) return null;
  for (const item of nodes) {
    const kind = String(item?.kind || item?.type || '').toLowerCase();
    const target = String(item?.view || item?.target_view || '').toLowerCase();
    if (kind === 'mock' || target.includes('mock')) return item;
    const found = findFirstMockNode(item?.children);
    if (found) return found;
  }
  return null;
}

// Dynamic Extractor Helpers - Extract Notes, Quiz Subjects, and Mock Questions purely from Admin Nodes
function getNotesChaptersFromAdmin(nodes: any[]): Chapter[] {
  const chapters: Chapter[] = [];
  
  function traverse(list: any[]) {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      const kind = String(item.kind || item.type || '').toLowerCase();
      const target = String(item.view || item.target_view || '').toLowerCase();
      const contentStr = typeof item.notesContent === 'string' ? item.notesContent : (typeof item.content === 'string' ? item.content : '');
      const isHtml = contentStr.includes('<html') || contentStr.includes('<!DOCTYPE') || contentStr.includes('<script');
      
      const hasChapters = Array.isArray(item.chapters) && item.chapters.length > 0;
      const isNotesType = kind === 'notes' || kind === 'pdf' || kind === 'note' || target.includes('note') || target.includes('pdf');
      
      if (hasChapters) {
        for (const ch of item.chapters) {
          chapters.push({
            id: String(ch.id || `chap-${Math.random()}`),
            title: String(ch.title || 'Untitled Note'),
            titleEn: String(ch.titleEn || ch.title || 'Untitled Note'),
            subtitle: String(ch.subtitle || 'Admin Notes'),
            subtitleEn: String(ch.subtitleEn || ch.subtitle || 'Admin Notes'),
            content: String(ch.content || '')
          });
        }
      } else if ((isNotesType || (contentStr && !isHtml)) && contentStr.trim().length > 0) {
        chapters.push({
          id: String(item.id || `chap-${Math.random()}`),
          title: String(item.title || item.name || 'Untitled Note'),
          titleEn: String(item.titleEn || item.title || item.name || 'Untitled Note'),
          subtitle: String(item.subtitle || item.sub || 'Admin Notes'),
          subtitleEn: String(item.subtitleEn || item.subtitle || item.sub || 'Admin Notes'),
          content: contentStr
        });
      }

      if (Array.isArray(item.children) && item.children.length > 0) {
        traverse(item.children);
      }
    }
  }

  traverse(nodes);
  return chapters;
}

function getQuizSubjectsFromAdmin(nodes: any[]): any[] {
  const subjects: any[] = [];
  
  function traverse(list: any[]) {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      const questions = (Array.isArray(item.questions) && item.questions.length > 0 ? item.questions : null) ||
        (Array.isArray(item.mcqs) && item.mcqs.length > 0 ? item.mcqs : null) ||
        (Array.isArray(item.quiz) && item.quiz.length > 0 ? item.quiz : null);
      
      if (questions && questions.length > 0) {
        const validQs = questions.filter((q: any) => {
          const t = String(q.question || q.qText || q.title || '');
          return t && !t.includes('document.') && !t.includes('var ') && !t.includes('STORE_KEY') && !t.includes('moodmoji') && !t.includes('BATCH=') && !t.includes('elementById');
        });

        if (validQs.length > 0) {
          const normalizedQs: QuizQuestion[] = validQs.map((q: any, i: number) => ({
            id: q.id || i + 1,
            question: stripPyq(q.question || q.qText || q.title || 'Question'),
            questionEn: stripPyq(q.questionEn || q.question_en || q.question || 'Question'),
            pyq: pyqTagOf(q) || undefined,
            options: Array.isArray(q.options) ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
            optionsEn: Array.isArray(q.optionsEn) ? q.optionsEn : (Array.isArray(q.options) ? q.options : ['Option A', 'Option B', 'Option C', 'Option D']),
            correct: resolveCorrectIndex(q),
            category: q.section || q.subject || q.category || undefined,
            explanation: stripPyq(q.explanation || q.exp || 'सही उत्तर चुनने हेतु बधाई।'),
            explanationEn: stripPyq(q.explanationEn || q.explanation_en || q.explanation || 'Great job selecting the correct answer.')
          }));

          subjects.push({
            id: item.id,
            title: item.title || item.name || 'Quiz',
            titleEn: item.titleEn || item.title_en || item.title || item.name || 'Quiz',
            subtitle: item.subtitle || item.sub || 'Practice MCQs',
            subtitleEn: item.subtitleEn || item.subtitle_en || 'Practice MCQs',
            icon: item.icon || '📝',
            questions: normalizedQs
          });
        }
      }

      if (Array.isArray(item.children) && item.children.length > 0) {
        traverse(item.children);
      }
    }
  }

  traverse(nodes);
  return subjects;
}

function getMockQuestionsFromAdmin(nodes: any[]): QuizQuestion[] {
  let mockQs: QuizQuestion[] = [];
  
  function traverse(list: any[]) {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      const kind = String(item.kind || item.type || '').toLowerCase();
      const target = String(item.view || item.target_view || '').toLowerCase();
      const questions = (Array.isArray(item.questions) && item.questions.length > 0 ? item.questions : null) ||
        (Array.isArray(item.mcqs) && item.mcqs.length > 0 ? item.mcqs : null);
      
      if ((kind === 'mock' || target.includes('mock')) && questions) {
        const validQs = questions.filter((q: any) => {
          const t = String(q.question || q.qText || q.title || '');
          return t && !t.includes('document.') && !t.includes('var ') && !t.includes('STORE_KEY') && !t.includes('moodmoji') && !t.includes('BATCH=') && !t.includes('elementById');
        });

        if (validQs.length > 0) {
          const normalizedQs: QuizQuestion[] = validQs.map((q: any, i: number) => ({
            id: q.id || i + 1,
            question: stripPyq(q.question || q.qText || q.title || 'Question'),
            questionEn: stripPyq(q.questionEn || q.question_en || q.question || 'Question'),
            pyq: pyqTagOf(q) || undefined,
            options: Array.isArray(q.options) ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
            optionsEn: Array.isArray(q.optionsEn) ? q.optionsEn : (Array.isArray(q.options) ? q.options : ['Option A', 'Option B', 'Option C', 'Option D']),
            correct: resolveCorrectIndex(q),
            category: q.section || q.subject || q.category || undefined,
            explanation: stripPyq(q.explanation || q.exp || 'सही उत्तर चुनने हेतु बधाई।'),
            explanationEn: stripPyq(q.explanationEn || q.explanation_en || q.explanation || 'Great job selecting the correct answer.')
          }));
          mockQs = mockQs.concat(normalizedQs);
        }
      }

      if (Array.isArray(item.children) && item.children.length > 0) {
        traverse(item.children);
      }
    }
  }

  traverse(nodes);
  return mockQs;
}

export { ALL_MATH_TOPICS } from './lib/mathTopics';
import { ALL_MATH_TOPICS } from './lib/mathTopics';

// Speed Math generator: separate chunk, fetched when Speed Math opens (or quietly after home is idle)
type MathGenFn = typeof import('./lib/mathGen').generateUnlimitedMathQuestion;
let mathGenFn: MathGenFn | null = null;
let mathGenP: Promise<MathGenFn> | null = null;
function loadMathGen(): Promise<MathGenFn> {
  if (mathGenFn) return Promise.resolve(mathGenFn);
  if (!mathGenP) {
    mathGenP = import('./lib/mathGen').then((m) => (mathGenFn = m.generateUnlimitedMathQuestion)).catch((e) => {
      mathGenP = null;
      throw e;
    });
  }
  return mathGenP;
}


const HINDI_TO_ENGLISH_MAP: Record<string, string> = {
  'नया Button Page': 'New Button Page',
  'नया Button': 'New Button',
  'नया फोल्डर': 'New Folder',
  'मुख्य पृष्ठ': 'Home Page',
  'मुख्य': 'Main',
  'वापस': 'Back',
  'कैलकुलेशन': 'Calculations',
  'स्पीड मैथ': 'Speed Math',
  'टाइपिंग': 'Typing',
  'टाइपिंग लैब': 'Typing Lab',
  'नोट्स': 'Notes',
  'नोट्स (PDF)': 'Notes (PDF)',
  'क्विज': 'Quiz',
  'क्विज अभ्यास': 'Quiz Practice',
  'मॉक टेस्ट': 'Mock Test',
  'अभ्यास': 'Practice',
  'भारतीय राजव्यवस्था': 'Indian Polity & Constitution',
  'भारतीय इतिहास': 'Indian History',
  'भूगोल एवं पर्यावरण': 'Geography & Environment',
  'सामान्य विज्ञान': 'General Science',
  'सामान्य ज्ञान': 'General Knowledge',
  'गणित': 'Mathematics',
  'रीजनिंग': 'Reasoning',
  'अंग्रेजी': 'English',
  'हिंदी': 'Hindi',
  'सामग्री मौजूद': 'items available',
  'फोल्डर खोलें': 'Open Folder',
  'सामग्री': 'Content',
  'विषय': 'Topic',
  'अध्याय': 'Chapter',
  'प्रश्नों की संख्या': 'Question Count',
  'कठिनाई स्तर': 'Difficulty Level',
  'विषय चुनें': 'Select Topic',
  'असीमित': 'Unlimited',
  'सरल': 'Easy',
  'मध्यम': 'Medium',
  'कठिन': 'Hard',
  'प्रो': 'Pro',
  'मिश्रित (सभी विषय)': 'Mixed (All Topics)',
  'जोड़ (Addition)': 'Addition',
  'घटाव (Subtraction)': 'Subtraction',
  'गुणा (Multiplication)': 'Multiplication',
  'भाग (Division)': 'Division',
  'जोड़ व घटाव (Add & Subtract)': 'Add & Subtract',
  'गुणा व भाग (Multiply & Divide)': 'Multiply & Divide',
  'सरलीकरण (BODMAS)': 'Simplification (BODMAS)',
  'प्रतिशत (Percentage)': 'Percentage',
  'वर्ग व वर्गमूल (Squares & Roots)': 'Squares & Square Roots',
  'घन व घनमूल (Cubes & Roots)': 'Cubes & Cube Roots',
  'भिन्न व दशमलव (Fractions & Decimals)': 'Fractions & Decimals',
  'औसत (Average)': 'Average',
  'अनुपात व समानुपात (Ratio & Proportion)': 'Ratio & Proportion',
  'साधारण ब्याज (Simple Interest)': 'Simple Interest',
  'लाभ व हानि (Profit & Loss)': 'Profit & Loss',
  'समय व कार्य (Time & Work)': 'Time & Work',
  'समय, चाल व दूरी (Time & Distance)': 'Time & Distance',
  'फीचर टूल': 'Feature Tool',
  'स्टडी बुल इंटरएक्टिव फीचर': 'Study Bull Interactive Feature',
  'स्पीड मैथ प्रैक्टिस एवं कैलकुलेशन बूस्टर': 'Speed Math Practice & Calculation Booster',
  'प्रोफेशनल रिज्यूम एवं सीवी बिल्डर': 'Professional Resume & CV Builder',
  'लाइव टाइपिंग स्पीड एवं एक्यूरेसी टेस्ट': 'Live Typing Speed & Accuracy Test'
};

function translateTextToEnglish(input: string): string {
  if (!input) return '';
  const str = String(input).trim();
  if (HINDI_TO_ENGLISH_MAP[str]) {
    return HINDI_TO_ENGLISH_MAP[str];
  }

  let translated = str;
  Object.keys(HINDI_TO_ENGLISH_MAP).forEach((key) => {
    if (translated.includes(key)) {
      translated = translated.replaceAll(key, HINDI_TO_ENGLISH_MAP[key]);
    }
  });

  translated = translated
    .replace(/(\d+)\s*सामग्री मौजूद/g, '$1 items available')
    .replace(/नया\s*Button/gi, 'New Button')
    .replace(/नया\s*फोल्डर/gi, 'New Folder')
    .replace(/फोल्डर खोलें/gi, 'Open Folder');

  return translated;
}

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [langHindi, setLangHindi] = useState<boolean>(() => {
    try { return localStorage.getItem('study_bull_lang') !== 'en'; } catch { return true; }
  });
  const [soundMuted, setSoundMuted] = useState<boolean>(() => {
    try { return localStorage.getItem('study_bull_muted') === 'true'; } catch { return false; }
  });

  // Sync language setting across app and notify any active custom iframe pages
  useEffect(() => {
    try { localStorage.setItem('study_bull_lang', langHindi ? 'hi' : 'en'); } catch {}
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach((iframe) => {
      try {
        iframe.contentWindow?.postMessage({
          type: 'LANG_CHANGE',
          langHindi: langHindi,
          lang: langHindi ? 'hi' : 'en'
        }, '*');
      } catch {}
    });
  }, [langHindi]);

  // Notes Reader
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [readerDarkMode, setReaderDarkMode] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [readerFontSize, setReaderFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('base');

  // Quiz State
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [userQuizAnswers, setUserQuizAnswers] = useState<(number | null)[]>([]);
  const [quizScore, setQuizScore] = useState(0);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);

  // Mock Test State
  const [mockQuestions, setMockQuestions] = useState<QuizQuestion[]>([]);
  const [mockIndex, setMockIndex] = useState(0);
  const [userMockAnswers, setUserMockAnswers] = useState<(number | null)[]>([]);
  const [mockTimer, setMockTimer] = useState(3600);
  const [mockDurationSec, setMockDurationSec] = useState(3600);
  const [mockMarks, setMockMarks] = useState<{ pos: number; neg: number }>({ pos: 1, neg: 0 });
  const [mockTimerActive, setMockTimerActive] = useState(false);
  // instructions screen before every mock; the timer starts only after "टेस्ट शुरू करें"
  const [mockStarted, setMockStarted] = useState(true);
  const [mockInfo, setMockInfo] = useState<MockInfo | null>(null);

  // Calculation Setup State
  const [calcCount, setCalcCount] = useState<number | 'Infinite'>(10);
  const [calcDifficulty, setCalcDifficulty] = useState<'सरल' | 'मध्यम' | 'कठिन' | 'प्रो'>('मध्यम');
  const [calcTopic, setCalcTopic] = useState<string>('मिश्रित (सभी विषय)');
  const [isCustomTopicMode, setIsCustomTopicMode] = useState<boolean>(false);
  const [selectedCustomTopics, setSelectedCustomTopics] = useState<string[]>([]);

  // Calculation Practice State
  const [calcQuestions, setCalcQuestions] = useState<QuizQuestion[]>([]);
  const [calcIndex, setCalcIndex] = useState(0);
  const [calcSelected, setCalcSelected] = useState<number | null>(null);
  const [calcAnswered, setCalcAnswered] = useState(false);
  const [calcScore, setCalcScore] = useState(0);
  const [calcTimer, setCalcTimer] = useState(0);
  const [calcTimerActive, setCalcTimerActive] = useState(false);
  const [calcGenLoading, setCalcGenLoading] = useState(false);
  // Speed Math generator chunk: fetch it as soon as Speed Math is opened, or quietly once home is idle
  useEffect(() => {
    if (String(currentView).startsWith('calc')) { void loadMathGen().catch(() => {}); return; }
    const t = setTimeout(() => void loadMathGen().catch(() => {}), 12000);
    return () => clearTimeout(t);
  }, [currentView]);
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
  // Until the user taps a duration chip, each passage runs on its own time (its "duration" field in minutes,
  // else an estimate from its length) — Oct 27 2026: the timer was 2 min even for 5–10 min passages.
  const [typingDurationPicked, setTypingDurationPicked] = useState(false);
  const [activeTypingPassage, setActiveTypingPassage] = useState<string>('');
  const [activeTypingTitle, setActiveTypingTitle] = useState<string>('');
  const passageText = activeTypingPassage || '';
  const [typedInput, setTypedInput] = useState('');
  // latest typed text for the timer (keeps the 1 s countdown from restarting on every keystroke)
  const typedInputRef = useRef('');
  typedInputRef.current = typedInput;
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
  const [folderStack, setFolderStack] = useState<any[]>([]);
  const [htmlReloadKey, setHtmlReloadKey] = useState<number>(0);
  const [htmlIsFullscreen, setHtmlIsFullscreen] = useState<boolean>(false);

  // Helper functions to resolve feature title, icon, and subtitle cleanly from Admin nodes and code
  const resolveNodeTitle = (btn: any, hindiMode: boolean = true) => {
    if (!btn) return '';
    let currentTitle = '';
    if (hindiMode) {
      currentTitle = String(btn.title || btn.name || '').trim();
    } else {
      currentTitle = String(btn.titleEn || btn.title_en || '').trim();
      if (!currentTitle) {
        const rawHi = String(btn.title || btn.name || '').trim();
        currentTitle = translateTextToEnglish(rawHi);
      }
    }
    const rawHtml = String(btn.htmlContent || btn.html || btn.code || btn.rawHtml || btn.content || '');
    if (rawHtml) {
      const titleMatch = rawHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        const extracted = titleMatch[1].trim();
        if (!currentTitle || currentTitle === 'नया Custom Web Page' || currentTitle.toLowerCase().includes('custom web page') || currentTitle.toLowerCase().includes('untitled')) {
          return hindiMode ? extracted : translateTextToEnglish(extracted);
        }
      }
    }
    return currentTitle || (hindiMode ? 'फीचर टूल' : 'Feature Tool');
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
    let currentSub = '';
    if (hindiMode) {
      currentSub = String(btn.sub || btn.subtitle || '').trim();
    } else {
      currentSub = String(btn.subEn || btn.subtitle_en || '').trim();
      if (!currentSub) {
        const rawHi = String(btn.sub || btn.subtitle || '').trim();
        if (rawHi && !rawHi.includes('Separate Page') && !rawHi.includes('Custom Web Tool') && !rawHi.includes('Interactive Script')) {
          currentSub = translateTextToEnglish(rawHi);
        }
      }
    }
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
    if (!item) return false;
    const kind = String(item?.kind || item?.type || '').toLowerCase();
    return kind === 'section' || kind === 'divider' || kind === 'heading' || kind === 'header';
  };

  const [loadingTileId, setLoadingTileId] = useState<string | null>(null);
  const [tileLoadError, setTileLoadError] = useState<string | null>(null);
  const pendingTileTapRef = useRef<string | null>(null);
  const nodeInteractionRef = useRef<((btn: any) => void) | null>(null);

  const isFolderNode = (item: any) => {
    if (!item) return false;
    const kind = String(item?.kind || item?.type || '').toLowerCase();
    return kind === 'folder' || kind === 'category' || kind === 'group' || kind === 'directory';
  };

  // Reusable universal handler for clicking ANY Admin node (MCQs, Notes, Folders, Pages)
  const handleNodeInteraction = (tapped: any) => {
    if (!tapped) return;
    // 📊 Views: count home-button opens (title only)
    if (tapped.id && adminNodes.some((n: any) => n && n.id === tapped.id)) trackTile(tapped.title || tapped.titleHi || tapped.titleEn);
    // a folder holding just one quiz (e.g. "📜 इतिहास — महत्वपूर्ण PYQ") opens that quiz directly (Aarav 26 Oct)
    let btn = tapped;
    if (!tapped._splitPending && !tapped.url) {
      try { const only = soleQuizChild(tapped); if (only) btn = only; } catch { /* keep the folder */ }
    }

    // Tile whose content isn't downloaded yet: small loader inside the tile, then open it
    if (btn._splitPending) {
      const id = String(btn.id);
      pendingTileTapRef.current = id;
      setTileLoadError(null);
      setLoadingTileId(id);
      splitStore.ensureTile(id).then((full) => {
        if (pendingTileTapRef.current !== id) return;
        pendingTileTapRef.current = null;
        setLoadingTileId(null);
        if (full && !full._splitPending) {
          if (liveNavRef.current.view === 'home') nodeInteractionRef.current?.(full);
        } else {
          setTileLoadError(id);
        }
      });
      return;
    }

    // Big tiles load as an outline first (Speed fix, Oct 27 2026): a quiz / notes page / mock that isn't
    // downloaded yet is a stub — fetch just that node (a few KB), with a loader on its card, then open it.
    const stubNode = splitStore.isStub(btn) ? btn : null;
    if (stubNode) {
      const sid = String(stubNode.id);
      const tappedId = String(tapped.id);
      const viewAt = liveNavRef.current.view;
      const pageAt = String(liveNavRef.current.node?.id ?? '');
      pendingTileTapRef.current = sid;
      setTileLoadError(null);
      setLoadingTileId(sid);
      splitStore.ensureNode(sid).then((ok) => {
        if (pendingTileTapRef.current !== sid) return;
        pendingTileTapRef.current = null;
        setLoadingTileId(null);
        const loadedNode = ok ? splitStore.findNode(sid) : null;
        const fresh = ok ? splitStore.findNode(tappedId) : null;
        const samePage = liveNavRef.current.view === viewAt && String(liveNavRef.current.node?.id ?? '') === pageAt;
        if (loadedNode && !splitStore.isStub(loadedNode) && fresh) { if (samePage) nodeInteractionRef.current?.(fresh); }
        else setTileLoadError(sid);
      });
      return;
    }

    if (btn.url) {
      window.open(btn.url, '_blank');
      return;
    }

    // Parents of the page being opened (for breadcrumbs): the open folder and its own parents
    const nextFolderStack = (currentView === 'custom_node' && activeCustomNode) ? [...folderStack, activeCustomNode] : [];

    // IF THIS BUTTON HAS SUB-BUTTONS OR IS MARKED AS A FOLDER, OPEN AS A FOLDER VIEW SO ALL INSIDE BUTTONS ARE ACCESSIBLE
    if (isFolderNode(btn) || (Array.isArray(btn.children) && btn.children.length > 0)) {
      setFolderStack(nextFolderStack);
      setActiveCustomNode(btn);
      setHtmlReloadKey(0);
      setHtmlIsFullscreen(false);
      navigateTo('custom_node');
      return;
    }

    const target = String(btn.view || btn.target_view || btn.type || btn.kind || btn.id || '').toLowerCase();
    const kind = String(btn.kind || btn.type || '').toLowerCase();

    // 0. CUSTOM HTML / INTERACTIVE WEB APPS (MoodMoji, widgets, tools, API fetch tools)
    const isHtmlNode = Boolean(
      kind === 'html' ||
      target.includes('html') ||
      target.includes('custom_node') ||
      btn.htmlContent ||
      btn.html ||
      btn.code ||
      btn.rawHtml ||
      (typeof btn.content === 'string' && (
        btn.content.includes('<') ||
        btn.content.includes('<!DOCTYPE') ||
        btn.content.includes('<script') ||
        btn.content.includes('<style') ||
        btn.content.includes('<div') ||
        btn.content.includes('function') ||
        btn.content.includes('fetch(') ||
        btn.content.includes('axios') ||
        btn.content.includes('document.') ||
        btn.content.includes('window.') ||
        btn.content.includes('localStorage') ||
        btn.content.includes('addEventListener')
      ))
    );

    if (isHtmlNode) {
      setFolderStack(nextFolderStack);
      setActiveCustomNode(btn);
      setHtmlReloadKey(0);
      setHtmlIsFullscreen(false);
      navigateTo('custom_node');
      return;
    }

    // 1. ADMIN MCQs & QUIZZES (or custom questions attached to admin button)
    const rawQuestions = 
      (Array.isArray(btn.questions) && btn.questions.length > 0 ? btn.questions : null) ||
      (Array.isArray(btn.mcqs) && btn.mcqs.length > 0 ? btn.mcqs : null) ||
      (Array.isArray(btn.items) && btn.items.length > 0 && btn.items[0]?.question ? btn.items : null) ||
      (Array.isArray(btn.quiz) && btn.quiz.length > 0 ? btn.quiz : null) ||
      (typeof btn.content === 'string' && btn.content.trim().startsWith('[') ? (() => {
        try {
          const parsed = JSON.parse(btn.content);
          return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
        } catch { return null; }
      })() : null);

    const validQuestions = rawQuestions?.filter((q: any) => {
      const t = String(q.question || q.qText || q.title || '');
      return t && !t.includes('document.') && !t.includes('var ') && !t.includes('STORE_KEY') && !t.includes('moodmoji') && !t.includes('BATCH=') && !t.includes('elementById') && !t.includes('onclick=');
    });

    if (validQuestions && validQuestions.length > 0) {
      const normalizedQs = validQuestions.map((q: any, i: number) => ({
        id: q.id || i + 1,
        question: stripPyq(q.question || q.qText || q.title || 'Question'),
        questionEn: stripPyq(q.questionEn || q.question_en || q.question || 'Question'),
        pyq: pyqTagOf(q) || undefined,
        options: Array.isArray(q.options) ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
        optionsEn: Array.isArray(q.optionsEn) ? q.optionsEn : (Array.isArray(q.options) ? q.options : ['Option A', 'Option B', 'Option C', 'Option D']),
        correct: resolveCorrectIndex(q),
        category: q.section || q.subject || q.category || undefined,
        explanation: stripPyq(q.explanation || q.exp || 'सही उत्तर चुनने हेतु बधाई।'),
        explanationEn: stripPyq(q.explanationEn || q.explanation_en || q.explanation || 'Great job selecting the correct answer.')
      }));

      const title = resolveNodeTitle(btn, langHindi);
      setSelectedSubject({
        id: btn.id,
        title: title,
        titleEn: btn.titleEn || btn.title_en || title,
        subtitle: resolveNodeSubtitle(btn, langHindi),
        subtitleEn: btn.subtitleEn || btn.subtitle_en || resolveNodeSubtitle(btn, false),
        icon: resolveNodeIcon(btn),
        questions: normalizedQs
      });
      setQuizQuestions(normalizedQs);
      setQuizIndex(0);
      setUserQuizAnswers(new Array(normalizedQs.length).fill(null));
      setQuizScore(0);
      setIsAnswerRevealed(false);

      if (kind === 'mock' || target.includes('mock')) {
        const durSec = resolveMockDurationSec(btn);
        setMockQuestions(normalizedQs);
        setMockIndex(0);
        setUserMockAnswers(new Array(normalizedQs.length).fill(null));
        setMockDurationSec(durSec);
        setMockMarks(resolveMockMarks(btn));
        setMockTimer(durSec);
        setMockTimerActive(false);
        {
          const examNode = tapped !== btn ? tapped : (currentView === 'custom_node' ? activeCustomNode : null);
          const examTitle = examNode ? resolveNodeTitle(examNode, langHindi) : (langHindi ? 'मॉक टेस्ट' : 'Mock Test');
          setMockInfo(buildMockInfo(btn, examTitle, title, normalizedQs));
        }
        setMockStarted(false);
        navigateTo('mock_play');
      } else {
        navigateTo('quiz_play');
      }
      return;
    }

    // 2. ADMIN NOTES & PDF (custom text/chapters attached to node)
    const notesText = btn.notesContent || btn.content || btn.text || btn.notes || btn.pdfUrl || btn.pdf || btn.body || btn.description;
    const hasNotesContent = typeof notesText === 'string' && notesText.trim().length > 0 && !notesText.includes('<html') && !notesText.includes('<!DOCTYPE');
    const hasChapters = Array.isArray(btn.chapters) && btn.chapters.length > 0;

    if (kind === 'notes' || kind === 'pdf' || kind === 'note' || target.includes('note') || target.includes('pdf') || hasNotesContent || hasChapters) {
      if (hasNotesContent || notesText) {
        const title = resolveNodeTitle(btn, langHindi);
        setSelectedChapter({
          id: btn.id,
          title: title,
          titleEn: btn.titleEn || btn.title_en || title,
          subtitle: resolveNodeSubtitle(btn, langHindi),
          subtitleEn: resolveNodeSubtitle(btn, false),
          content: notesText || (langHindi ? 'एडमिन पैनल से इस नोट्स की विषय सामग्री जोड़ी जा रही है...' : 'Notes content is being added from Admin Panel...')
        });
        navigateTo('notes_reader');
        return;
      }
      if (hasChapters) {
        setSelectedChapter(btn.chapters[0]);
        navigateTo('notes_lib');
        return;
      }
      navigateTo('notes_lib');
      return;
    }

    // 3. SPEED MATH / CALCULATION
    const isCalc = target.includes('calc') || 
      kind === 'calc' || 
      String(btn.title || '').toLowerCase().includes('calc') || 
      String(btn.title || '').includes('कैलकुलेशन') || 
      String(btn.title || '').toLowerCase().includes('speed math');

    if (isCalc) {
      navigateTo('calc_setup');
      return;
    }

    // 4. TYPING LAB
    const isTyping = target.includes('typing') || 
      kind === 'typing' || 
      String(btn.title || '').toLowerCase().includes('typing') || 
      String(btn.title || '').includes('टाइपिंग');

    if (isTyping) {
      navigateTo('typing_setup');
      return;
    }

    // 5. MOCK TEST SAMPLE FALLBACK
    if (target.includes('mock')) {
      const mockQs = getMockQuestionsFromAdmin(adminNodes);
      if (mockQs.length > 0) {
        const firstMock = findFirstMockNode(adminNodes);
        const durSec = resolveMockDurationSec(firstMock);
        setMockMarks(resolveMockMarks(firstMock));
        setMockQuestions(mockQs);
        setMockIndex(0);
        setUserMockAnswers(new Array(mockQs.length).fill(null));
        setMockDurationSec(durSec);
        setMockTimer(durSec);
        setMockTimerActive(false);
        setMockInfo(buildMockInfo(firstMock, langHindi ? 'मॉक टेस्ट' : 'Mock Test', firstMock ? resolveNodeTitle(firstMock, langHindi) : (langHindi ? 'मॉक टेस्ट' : 'Mock Test'), mockQs));
        setMockStarted(false);
        navigateTo('mock_play');
      } else {
        navigateTo('mock_play');
      }
      return;
    }

    // 6. QUIZ SAMPLE FALLBACK
    if (target.includes('quiz')) {
      const quizSubjs = getQuizSubjectsFromAdmin(adminNodes);
      if (quizSubjs.length > 0) {
        setSelectedSubject(quizSubjs[0]);
        setQuizQuestions(quizSubjs[0].questions);
        setQuizIndex(0);
        setUserQuizAnswers(new Array(quizSubjs[0].questions.length).fill(null));
        setQuizScore(0);
        setIsAnswerRevealed(false);
        navigateTo('quiz_play');
      } else {
        navigateTo('quiz_categories');
      }
      return;
    }

    // 7. CUSTOM HTML CODE PAGE / OTHER
    setFolderStack(nextFolderStack);
    setActiveCustomNode(btn);
    setHtmlReloadKey(0);
    setHtmlIsFullscreen(false);
    navigateTo('custom_node');
  };
  nodeInteractionRef.current = handleNodeInteraction;

  // Supabase State & Instant Cache-First (eliminates all old default flickers)
  const [adminNodes, setAdminNodes] = useState<any[]>(() => {
    if (SPLIT_BOOT && SPLIT_BOOT.nodes.length > 0) return SPLIT_BOOT.nodes;
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
    if (SPLIT_BOOT && SPLIT_BOOT.settings && Object.keys(SPLIT_BOOT.settings).length > 0) return SPLIT_BOOT.settings;
    try {
      const cached = localStorage.getItem('studybull_cached_settings');
      if (cached) return JSON.parse(cached);
    } catch {}
    return {};
  });

  const [eligibilityExamId, setEligibilityExamId] = useState<string | null>(null);
  const [isDbLoaded, setIsDbLoaded] = useState<boolean>(() => {
    if (SPLIT_BOOT && SPLIT_BOOT.nodes.length > 0) return true;
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

  const applyLiveAdminData = (nodes: any[], settings: any) => {
    if (Array.isArray(nodes)) {
      // Caching is done by splitStore (per tile) / loadStudyBullApp (old single row)
      setAdminNodes(nodes);
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

  useEffect(() => {
    let isMounted = true;

    // 1. Small index row first (home grid), tiles on demand — see src/lib/splitStore.ts.
    //    Falls back to the old single row automatically when the index row is missing.
    splitStore.setListener((nodes, settings) => {
      if (!isMounted) return;
      if (Array.isArray(nodes) && nodes.length > 0) applyLiveAdminData(nodes, settings || {});
    });
    splitStore.start().catch((err) => {
      console.warn('Initial load error from Supabase:', err);
    }).finally(() => {
      if (isMounted) setIsDbLoaded(true);
    });

    // 2. INSTANT UPDATES (Aarav, Oct 27 2026): tiny version stamps from /api/meta (CDN 4 s) every 8 s while the
    //    site is in use (touched in the last 3 min), every 30 s when it just sits open, never in a hidden tab, and
    //    at once when the tab comes back / gets focus / the phone is back online → an admin save shows up in a few
    //    seconds without a refresh. Only changed tiles/pages are downloaded again, in the background; an open
    //    quiz/mock/notes page keeps its own copy (the new version is used the next time it is opened).
    let lastPoll = 0;
    let lastActive = Date.now();
    const syncIfChanged = (force?: boolean) => {
      if (!isMounted) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      const now = Date.now();
      if (!force && now - lastPoll < (now - lastActive < 180000 ? 7500 : 29000)) return;
      if (now - lastPoll < 1500) return;
      lastPoll = now;
      splitStore.poll().catch(() => {});
    };
    const timer = setInterval(() => syncIfChanged(), 2000);
    const first = setTimeout(() => syncIfChanged(true), 3000);
    const onVisible = () => { if (document.visibilityState === 'visible') { lastActive = Date.now(); syncIfChanged(true); } };
    const onNow = () => { lastActive = Date.now(); syncIfChanged(true); };
    const onUse = () => { lastActive = Date.now(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onNow);
    window.addEventListener('online', onNow);
    window.addEventListener('pageshow', onNow);
    window.addEventListener('pointerdown', onUse, { passive: true });
    window.addEventListener('keydown', onUse, { passive: true });
    window.addEventListener('scroll', onUse, { passive: true, capture: true });

    return () => {
      isMounted = false;
      clearInterval(timer);
      clearTimeout(first);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onNow);
      window.removeEventListener('online', onNow);
      window.removeEventListener('pageshow', onNow);
      window.removeEventListener('pointerdown', onUse);
      window.removeEventListener('keydown', onUse);
      window.removeEventListener('scroll', onUse, { capture: true } as any);
    };
  }, []);

  // Fresh data arrived (tile downloaded again / admin saved): the open folder page is a node object from the
  // OLD data, so look it (and its parent trail) up again by id. Gone? → its nearest parent that still exists.
  const adminNodesRef = useRef<any[]>(adminNodes);
  adminNodesRef.current = adminNodes;
  useEffect(() => {
    if (currentView !== 'custom_node' || !activeCustomNode) return;
    try {
      const fix = refreshNav(adminNodes, activeCustomNode, folderStack);
      if (!fix || !fix.changed) return;
      // the open page's content changed on the server (admin save) → keep showing the old copy, fetch the new
      // one in the background; this effect runs again once it has arrived (no blank page, no spinner)
      if (splitStore.isStub(fix.node) && !splitStore.isStub(activeCustomNode) && fix.node && fix.node.id != null) {
        void splitStore.ensureNode(String(fix.node.id));
        return;
      }
      setFolderStack(fix.folders);
      setActiveCustomNode(fix.node);
      // keep the history entry of this page in step too (back/forward from here)
      const st = navStackRef.current;
      const i = navIndexRef.current;
      if (st[i] && st[i].view === 'custom_node') st[i] = { ...st[i], node: fix.node, folders: fix.folders };
    } catch { /* never break the open page */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminNodes]);

  // Views that read across all tiles (old quiz/notes hubs, typing setup) need every tile's content
  useEffect(() => {
    if (['quiz_categories', 'notes_lib', 'typing_setup'].includes(currentView) && adminNodes.some((n: any) => n && n._splitPending)) {
      void splitStore.ensureAll();
    }
  }, [currentView, adminNodes]);

  // Sync Language and Mute with LocalStorage
  useEffect(() => {
    try { localStorage.setItem('study_bull_lang', langHindi ? 'hi' : 'en'); } catch {}
  }, [langHindi]);

  useEffect(() => {
    try { localStorage.setItem('study_bull_muted', soundMuted ? 'true' : 'false'); } catch {}
  }, [soundMuted]);

  // Synchronize document.title with live Admin App Name
  useEffect(() => {
    const title = adminSettings?.appName?.trim() || 'Study Bull';
    // SEO: keep the full keyword title (same as index.html) so Google's rendered title stays descriptive.
    const brand = title.replace(/\s+/g, '').toLowerCase() === 'studybull' ? 'Study Bull (StudyBull)' : `${title} | Study Bull (StudyBull)`;
    document.title = `${brand} — Free Mock Test, PYQ, Notes: SSC GD, Agniveer, Police, Railway (Hindi)`;
  }, [adminSettings?.appName]);

  // ---- Navigation stack synced with browser history ----
  // Every page the user opens is one entry here AND one browser-history entry, so the in-app
  // "वापस" button and the phone/browser back gesture both go exactly ONE level up
  // (content -> topic/subject list -> button page -> home). At home, back leaves the site normally.
  const navStackRef = useRef<NavSnapshot[]>([]);
  const navIndexRef = useRef(0);
  const liveNavRef = useRef<NavSnapshot>({ view: 'home', node: null, folders: [], chapter: null });
  liveNavRef.current = { view: currentView, node: activeCustomNode, folders: folderStack, chapter: selectedChapter };

  const PLAY_VIEWS: ViewState[] = ['quiz_play', 'mock_play', 'calc_practice', 'typing_practice'];
  const RESULT_VIEWS: ViewState[] = ['quiz_result', 'mock_result', 'calc_result', 'typing_result'];
  const HUB_VIEWS: ViewState[] = ['home', 'quiz_categories', 'notes_lib', 'calc_setup', 'typing_setup'];

  const stopActivityTimers = (from: ViewState, to: ViewState) => {
    if (from === to) return;
    if (from === 'mock_play' || from === 'mock_result') setMockTimerActive(false);
    if (from === 'calc_practice' || from === 'calc_result') setCalcTimerActive(false);
    if (from === 'typing_practice' || from === 'typing_result') setTypingStarted(false);
  };

  const restoreNav = (snap: NavSnapshot) => {
    stopActivityTimers(liveNavRef.current.view, snap.view);
    // the page we go back to may have been downloaded again meanwhile → its fresh copy by id
    let snapNode = snap.node;
    let snapFolders = Array.isArray(snap.folders) ? snap.folders : [];
    if (snap.view !== 'home' && snapNode) {
      try {
        const fix = refreshNav(adminNodesRef.current, snapNode, snapFolders);
        if (fix) { snapNode = fix.node; snapFolders = fix.folders; }
      } catch { /* keep the snapshot */ }
    }
    liveNavRef.current = { ...snap, node: snapNode, folders: snapFolders };
    setFolderStack(snapFolders);
    setActiveCustomNode(snap.view === 'home' ? null : snapNode);
    if (snap.chapter !== undefined) setSelectedChapter(snap.chapter);
    setHtmlIsFullscreen(false);
    setCurrentView(snap.view);
  };

  // Move to stack entry i through browser history (popstate below does the restore)
  const goToNavIndex = (i: number) => {
    const before = navIndexRef.current;
    if (i === before || i < 0 || i >= navStackRef.current.length) return;
    try {
      window.history.go(i - before);
    } catch {
      // ignore, fallback below
    }
    // Safety net: if the browser did not move (popstate never came), restore in-app anyway
    window.setTimeout(() => {
      if (navIndexRef.current === before) {
        const stack = navStackRef.current;
        stack[before] = { ...liveNavRef.current };
        navIndexRef.current = i;
        restoreNav(stack[i]);
      }
    }, 700);
  };

  useEffect(() => {
    navStackRef.current = [{ ...liveNavRef.current }];
    navIndexRef.current = 0;
    try {
      window.history.replaceState({ ...(window.history.state || {}), sbNav: 0 }, '');
    } catch {
      // ignore
    }

    const handlePopState = (e: PopStateEvent) => {
      const stack = navStackRef.current;
      if (!stack.length) return;
      const raw = e.state && typeof e.state.sbNav === 'number' ? e.state.sbNav : 0;
      const target = Math.max(0, Math.min(raw, stack.length - 1));
      const cur = navIndexRef.current;
      if (target === cur) return;
      if (cur < stack.length) stack[cur] = { ...liveNavRef.current };
      navIndexRef.current = target;
      restoreNav(stack[target]);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Navigate view with history state
  const navigateTo = (view: ViewState) => {
    const stack = navStackRef.current;
    if (!stack.length) {
      stack.push({ ...liveNavRef.current });
      navIndexRef.current = 0;
    }
    if (view === 'home') {
      goHomeNav();
      return;
    }
    const cur = navIndexRef.current;
    const from = liveNavRef.current.view;

    // A result screen (or "try again" from a result) replaces the current page instead of adding one
    if (RESULT_VIEWS.includes(view) || (RESULT_VIEWS.includes(from) && PLAY_VIEWS.includes(view))) {
      setCurrentView(view);
      return;
    }

    // Going to a list/setup page that is already below us (home, notes list, setup) = go back to it
    if (HUB_VIEWS.includes(view) && view !== from) {
      for (let i = cur - 1; i >= 0; i--) {
        if (stack[i].view === view) {
          goToNavIndex(i);
          return;
        }
      }
    }

    stack[cur] = { ...liveNavRef.current };
    stack.length = cur + 1;
    stack.push({ ...liveNavRef.current, view });
    navIndexRef.current = cur + 1;
    try {
      window.history.pushState({ sbNav: cur + 1 }, '');
    } catch {
      // ignore
    }
    setCurrentView(view);
  };

  // Breadcrumb helpers: jump back to home / to an open parent folder (one history move)
  const goHomeNav = () => {
    if (navIndexRef.current > 0) {
      goToNavIndex(0);
      return;
    }
    setActiveCustomNode(null);
    setFolderStack([]);
    setCurrentView('home');
  };

  const goToFolderNav = (parent: any, idx: number) => {
    const stack = navStackRef.current;
    for (let i = navIndexRef.current - 1; i >= 0; i--) {
      const n = stack[i].node;
      if (stack[i].view === 'custom_node' && n && (n === parent || (n.id != null && n.id === parent?.id))) {
        goToNavIndex(i);
        return;
      }
    }
    setFolderStack(s => s.slice(0, idx));
    setActiveCustomNode(parent);
  };

  // Mock Timer
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (mockTimerActive && mockTimer > 0) {
      interval = setInterval(() => {
        setMockTimer(prev => {
          if (prev <= 1) {
            setMockTimerActive(false);
            playGentleSound('timeup', soundMuted);
            setCurrentView('mock_result');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [mockTimerActive, mockTimer, soundMuted]);

  // Soft countdown tick in the last 10 seconds of a mock test
  useEffect(() => {
    if (mockTimerActive && mockTimer > 0 && mockTimer <= 10) {
      playGentleSound('tick', soundMuted);
    }
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
              const words = typedInputRef.current.trim().split(/\s+/).filter(Boolean).length;
              const durationSec = typeof typingDuration === 'number' ? typingDuration * 60 : 120;
              const finalWpm = Math.round((words / (durationSec / 60))) || 0;
              recordUserAttempt('typing', {
                wpm: finalWpm,
                timeTaken: durationSec,
                characters: typedInputRef.current.length
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
  }, [typingStarted, typingTimeLeft, typingDuration, soundMuted]);

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
    // One level up through the shared navigation stack / browser history
    if (navIndexRef.current > 0) {
      goToNavIndex(navIndexRef.current - 1);
      return;
    }
    // Fallback (page reached without a history entry): old parent mapping
    switch (currentView) {
      case 'custom_node':
        if (folderStack.length > 0) {
          const prevFolder = folderStack[folderStack.length - 1];
          setFolderStack(s => s.slice(0, -1));
          setActiveCustomNode(prevFolder);
        } else {
          setFolderStack([]);
          setActiveCustomNode(null);
          setCurrentView('home');
        }
        break;
      case 'quiz_play':
      case 'quiz_result':
      case 'mock_play':
      case 'mock_result':
        setMockTimerActive(false);
        if (activeCustomNode) {
          setCurrentView('custom_node');
        } else {
          setActiveCustomNode(null);
          setCurrentView('home');
        }
        break;
      case 'quiz_categories':
      case 'notes_lib':
      case 'calc_setup':
      case 'typing_setup':
        if (activeCustomNode) {
          setCurrentView('custom_node');
        } else {
          setActiveCustomNode(null);
          setCurrentView('home');
        }
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
    if (!mathGenFn) {
      setCalcGenLoading(true);
      loadMathGen()
        .then(() => {
          setCalcGenLoading(false);
          generateCalculationSet();
        })
        .catch(() => {
          setCalcGenLoading(false);
          alert('नेटवर्क धीमा है — कृपया दोबारा कोशिश करें।');
        });
      return;
    }
    const generateUnlimitedMathQuestion = mathGenFn;
    const totalQ = calcCount === 'Infinite' ? 20 : Number(calcCount);
    const generated: QuizQuestion[] = [];
    const baseTopics = ALL_MATH_TOPICS.filter(t => !t.includes('मिश्रित'));

    for (let i = 0; i < totalQ; i++) {
      let targetTopic = calcTopic;
      if (isCustomTopicMode && selectedCustomTopics.length > 0) {
        targetTopic = selectedCustomTopics[Math.floor(Math.random() * selectedCustomTopics.length)];
      } else if (calcTopic.includes('मिश्रित')) {
        targetTopic = baseTopics[Math.floor(Math.random() * baseTopics.length)];
      }

      const q = generateUnlimitedMathQuestion(
        targetTopic,
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
      case 'eligibility':
      case 'eligibility_exam':
        return langHindi ? 'पात्रता जाँच' : 'Eligibility Checker';
      case 'job_alert':
        return langHindi ? 'जॉब अलर्ट' : 'Job Alert';
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
      (typeof activeCustomNode.content === 'string' && (
        activeCustomNode.content.includes('<') ||
        activeCustomNode.content.includes('function') ||
        activeCustomNode.content.includes('fetch(') ||
        activeCustomNode.content.includes('document.') ||
        activeCustomNode.content.includes('window.') ||
        activeCustomNode.content.includes('localStorage')
      ))
    );

    const extractedCode = String(
      activeCustomNode.htmlContent ||
      activeCustomNode.html ||
      activeCustomNode.code ||
      activeCustomNode.rawHtml ||
      (typeof activeCustomNode.content === 'string' ? activeCustomNode.content : '')
    ).trim();

    // If pure JS without HTML tags, automatically wrap in script tag
    const rawHtml = (extractedCode && !extractedCode.includes('<') && (extractedCode.includes('function') || extractedCode.includes('fetch') || extractedCode.includes('console.')))
      ? `<script>\n${extractedCode}\n</script>`
      : extractedCode;

    const featureTitle = resolveNodeTitle(activeCustomNode, langHindi);
    const featureIcon = resolveNodeIcon(activeCustomNode);
    const featureSubtitle = resolveNodeSubtitle(activeCustomNode, langHindi);

    return (
      <SafeErrorBoundary fallbackView={() => { setActiveCustomNode(null); setCurrentView('home'); }}>
        <div className="fixed inset-0 z-50 flex flex-col w-full h-dvh bg-slate-50 select-none overflow-hidden">
          {/* Top Bar - Clean header matching main home page header */}
          <div 
            className="h-14 px-4 flex items-center justify-between text-white shadow-sm shrink-0 z-20"
            style={{
              background: `linear-gradient(to right, ${adminSettings?.primaryColor || '#1546b5'}, ${adminSettings?.secondaryColor || '#3d2db3'})`
            }}
          >
            <div className="flex items-center space-x-3 min-w-0">
              <button
                onClick={handleBack}
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
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={() => setSoundMuted(!soundMuted)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition border border-white/20 active:scale-95 cursor-pointer"
                title={soundMuted ? 'ध्वनि चालू करें' : 'ध्वनि बंद करें'}
              >
                {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Interactive Open Tab & Location Banner */}
          <div className="bg-slate-900 text-white text-xs px-4 py-2 flex items-center space-x-2 overflow-x-auto whitespace-nowrap border-b border-slate-800 shrink-0 shadow-inner">
            <button
              onClick={goHomeNav}
              className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 font-medium cursor-pointer border border-slate-700/80"
            >
              <span>🏠</span>
              <span>{langHindi ? 'मुख्य पृष्ठ' : 'Home'}</span>
            </button>

            {folderStack.map((parent, idx) => (
              <React.Fragment key={parent.id || idx}>
                <span className="text-slate-500 font-extrabold text-sm">›</span>
                <button
                  onClick={() => goToFolderNav(parent, idx)}
                  className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 font-medium cursor-pointer border border-slate-700/80"
                >
                  <span>📌</span>
                  <span>{resolveNodeTitle(parent, langHindi)}</span>
                </button>
              </React.Fragment>
            ))}

            <span className="text-slate-500 font-extrabold text-sm">›</span>
            <div className="px-3 py-1 rounded-md bg-blue-600/30 text-blue-300 font-bold flex items-center gap-1.5 border border-blue-500/40 shadow-xs">
              <span>{featureIcon || '📌'}</span>
              <span>{featureTitle}</span>
              <span className="ml-1 px-1.5 py-0.2 bg-blue-500/20 text-[10px] text-blue-200 uppercase rounded tracking-wide border border-blue-400/30 font-extrabold">Open Tab</span>
            </div>
          </div>

          {/* Pure 100% Full Viewport Output without frames, margins or bottom bars */}
          <div
            className={`flex-1 min-h-0 w-full overflow-hidden relative ${isHtmlTool ? 'bg-white' : 'bg-[#f3f6fd]'}`}
            style={isHtmlTool ? { paddingBottom: 'env(safe-area-inset-bottom)' } : undefined}
          >
            {isHtmlTool ? (
              <SandboxedHtmlView
                key={`fs-feature-${activeCustomNode.id}-${htmlReloadKey}`}
                htmlContent={rawHtml}
                title={featureTitle}
                minHeight="100%"
                style={{ width: '100%', height: '100%' }}
              />
            ) : (
              /* If folder or container, show child buttons cleanly in full screen with back button */
              <div className="max-w-4xl mx-auto px-4 pt-5 sm:px-6 overflow-y-auto overscroll-contain h-full" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
                <div className="mb-5 flex items-center gap-3.5">
                  <div className="w-14 h-14 shrink-0 rounded-2xl bg-white border border-blue-100 shadow-[0_4px_14px_-6px_rgba(30,64,175,0.25)] flex items-center justify-center text-[28px]">
                    {featureIcon}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-[20px] font-extrabold text-slate-900 leading-tight truncate">{featureTitle}</h2>
                    {featureSubtitle && <p className="text-[12px] text-slate-500 mt-0.5 leading-snug line-clamp-2">{featureSubtitle}</p>}
                  </div>
                </div>

                {(() => {
                  // 3-level layout: level 1 = cube buttons, level 2+ = big folder cards, leaves = slim section rows
                  const depth = folderStack.length;
                  // (Aarav 11:18 AM Oct 26: no virtual '<विषय> PYQ' mix folder in any subject — real PYQ folders only)
                  const levelItems: any[] = Array.isArray(activeCustomNode.children) ? activeCustomNode.children : [];
                  return levelItems.length > 0 ? (
                    <LevelList
                      items={levelItems}
                      depth={depth}
                      langHindi={langHindi}
                      onOpen={(child: any) => handleNodeInteraction(child)}
                      loadingId={loadingTileId}
                      errorId={tileLoadError}
                      titleOf={(n: any) => resolveNodeTitle(n, langHindi)}
                      iconOf={(n: any) => resolveNodeIcon(n)}
                      subtitleOf={(n: any) => resolveNodeSubtitle(n, langHindi)}
                      isSection={isSectionNode}
                      isFolder={isFolderNode}
                    />
                  ) : (
                    <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
                      <p className="text-sm text-slate-500">
                        {langHindi ? 'इस फोल्डर में कोई सामग्री नहीं है' : 'No items found in this folder'}
                      </p>
                    </div>
                  );
                })()}
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
                // via the CDN index (settings arrive through the splitStore listener) — never the big old row
                splitStore.start().catch(() => {});
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
        className={`min-h-screen font-sans selection:bg-blue-600 selection:text-white antialiased ${adminSettings?.darkMode ? 'dark bg-slate-950 text-white' : 'text-slate-900'}`}
        style={{
          backgroundColor: adminSettings?.darkMode ? '#0b1120' : (adminSettings?.appBgColor || '#f1f5ff'),
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))'
        }}
      >
        {currentView === 'mock_play' && !mockStarted && mockInfo && mockQuestions.length > 0 && (
          <MockRules
            key={mockInfo.title + ':' + mockQuestions.length}
            info={mockInfo}
            langHindi={langHindi}
            headerBg={`linear-gradient(to right, ${adminSettings?.primaryColor || '#1546b5'}, ${adminSettings?.secondaryColor || '#3d2db3'})`}
            onBack={handleBack}
            onStart={() => {
              setMockIndex(0);
              setUserMockAnswers(new Array(mockQuestions.length).fill(null));
              setMockTimer(mockDurationSec);
              setMockStarted(true);
              setMockTimerActive(true);
              window.scrollTo(0, 0);
            }}
          />
        )}
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
                <m.div
                  key="home-grid"
                  initial={motionFeaturesReady() ? { opacity: 0, y: 8 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.16 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {/* Loading skeleton while fetching live buttons from database */}
                    {!isDbLoaded && adminNodes.length === 0 && (
                      <div className="col-span-2 sm:col-span-2 md:col-span-3 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs animate-pulse flex flex-col justify-between h-36">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100" />
                            <div className="space-y-2 w-full">
                              <div className="h-4 bg-slate-200 rounded-md w-3/4" />
                              <div className="h-3 bg-slate-100 rounded-md w-1/2" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Empty State when no buttons are added yet from Admin Panel */}
                    {isDbLoaded && adminNodes.length === 0 && (
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
                        <button
                          onClick={() => {
                            setIsDbLoaded(false);
                            splitStore.start().catch(() => {}).finally(() => setIsDbLoaded(true));
                          }}
                          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          {langHindi ? 'रिफ्रेश करें' : 'Refresh Now'}
                        </button>
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
                        handleNodeInteraction(btn);
                      };

                        // 1. SECTION (Image: Full-width horizontal title banner with tag badge)
                        if (isSection) {
                          return (
                            <button
                              key={btn.id}
                              onClick={handleNodeClick}
                              className="col-span-2 sm:col-span-2 md:col-span-3 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-white border border-blue-200/80 hover:border-blue-300 rounded-2xl p-4 flex items-center justify-between shadow-sm my-1 text-left w-full cursor-pointer transition active:scale-98"
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
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="px-2.5 py-1 bg-blue-100 text-blue-700 font-bold text-[10px] rounded-lg uppercase tracking-wider">
                                  Section
                                </span>
                                <ChevronRight className="w-4 h-4 text-blue-500" />
                              </div>
                            </button>
                          );
                        }

                        // 2. UNIFORM BLOCK GRID CARD (Used for both Folders and regular buttons)
                        const childCount = btn._splitPending ? Number(btn._childCount || 0) : (Array.isArray(btn.children) ? btn.children.length : 0);

                        if (isFolder) {
                          return (
                            <button
                              key={btn.id}
                              onClick={handleNodeClick}
                              className="col-span-2 sm:col-span-2 md:col-span-3 group relative bg-gradient-to-r from-amber-50 via-amber-50/90 to-amber-100/80 rounded-2xl p-4 shadow-sm border-2 border-amber-300/90 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer flex items-center justify-between text-left overflow-hidden my-1 w-full active:scale-98"
                            >
                              {(loadingTileId === String(btn.id) || tileLoadError === String(btn.id)) && (
                              <div className="absolute inset-0 z-10 bg-white/80 flex items-center justify-center rounded-2xl">
                                {loadingTileId === String(btn.id) ? (
                                  <span className="flex items-center gap-2 text-xs font-bold text-blue-700">
                                    <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                    {langHindi ? 'लोड हो रहा है…' : 'Loading…'}
                                  </span>
                                ) : (
                                  <span className="px-2 text-center text-xs font-bold text-red-600">
                                    {langHindi ? 'नेटवर्क धीमा है — फिर से टैप करें' : 'Slow network — tap again'}
                                  </span>
                                )}
                              </div>
                            )}
                              <div className="flex items-center space-x-3.5 min-w-0">
                                <div className="w-11 h-11 rounded-xl bg-amber-200/90 group-hover:bg-amber-300 text-amber-900 transition-colors flex items-center justify-center text-2xl shadow-inner flex-shrink-0 group-hover:scale-105 transform duration-150">
                                  {displayIcon || '📂'}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-extrabold text-amber-950 group-hover:text-amber-900 transition-colors text-base sm:text-lg tracking-tight truncate">
                                      {displayTitle}
                                    </h3>
                                    <span className="px-2 py-0.5 bg-amber-200/90 text-amber-900 text-[10px] font-extrabold rounded-md uppercase tracking-wider shrink-0 border border-amber-300/80 shadow-2xs">
                                      📁 {langHindi ? 'फोल्डर' : 'Folder'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-amber-800/90 font-medium truncate mt-0.5">
                                    {displaySubtitle || (childCount > 0 ? (langHindi ? `${childCount} सामग्री मौजूद` : `${childCount} items inside`) : (langHindi ? 'फोल्डर खोलें' : 'Open Folder'))}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className="px-2.5 py-1 bg-amber-200/80 text-amber-900 font-bold text-xs rounded-lg border border-amber-300/70 shadow-2xs hidden sm:inline-block">
                                  {childCount} {langHindi ? 'आइटम' : 'items'}
                                </span>
                                <ChevronRight className="w-5 h-5 text-amber-700 group-hover:translate-x-0.5 transition-transform" />
                              </div>
                            </button>
                          );
                        }

                        return (
                          <button
                            key={btn.id}
                            onClick={handleNodeClick}
                            className="group relative bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-400 transition-all cursor-pointer flex flex-col items-start justify-between text-left overflow-hidden h-36 active:scale-98"
                          >
                            <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm animate-pulse"></span>
                            </div>
                            {(loadingTileId === String(btn.id) || tileLoadError === String(btn.id)) && (
                              <div className="absolute inset-0 z-10 bg-white/80 flex items-center justify-center rounded-2xl">
                                {loadingTileId === String(btn.id) ? (
                                  <span className="flex items-center gap-2 text-xs font-bold text-blue-700">
                                    <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                    {langHindi ? 'लोड हो रहा है…' : 'Loading…'}
                                  </span>
                                ) : (
                                  <span className="px-2 text-center text-xs font-bold text-red-600">
                                    {langHindi ? 'नेटवर्क धीमा है — फिर से टैप करें' : 'Slow network — tap again'}
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="w-12 h-12 rounded-2xl bg-blue-50 group-hover:bg-blue-100 transition-colors flex items-center justify-center text-2xl shadow-inner flex-shrink-0 mb-2">
                              {displayIcon || '⚡'}
                            </div>

                            <div className="w-full">
                              <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-sm sm:text-base leading-snug line-clamp-1">
                                {displayTitle}
                              </h3>
                              <p className="text-xs text-slate-500 mt-0.5 font-medium line-clamp-1">
                                {displaySubtitle || (langHindi ? 'बटन खोलें' : 'Open Button')}
                              </p>
                            </div>
                          </button>
                        );
                      })}

                    {/* Code-defined block tiles (not from admin data), same card as the admin button tiles: Eligibility Checker, then Job Alert */}
                    {(isDbLoaded || adminNodes.length > 0) && (
                      <button
                        key="eligibility-checker-tile"
                        onClick={() => { trackTile('पात्रता जाँच'); navigateTo('eligibility'); }}
                        className="group relative bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-400 transition-all cursor-pointer flex flex-col items-start justify-between text-left overflow-hidden h-36 active:scale-98"
                      >
                        <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-[9px] font-extrabold rounded-md leading-none">NEW</span>
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm animate-pulse"></span>
                        </div>

                        <div className="w-12 h-12 rounded-2xl bg-blue-50 group-hover:bg-blue-100 transition-colors flex items-center justify-center text-2xl shadow-inner flex-shrink-0 mb-2">
                          ✅
                        </div>

                        <div className="w-full">
                          <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-sm sm:text-base leading-snug line-clamp-1">
                            {langHindi ? 'पात्रता जाँच' : 'Eligibility Checker'}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5 font-medium line-clamp-1">
                            {langHindi ? 'कौन-सी परीक्षा दे सकते हैं?' : 'Which exams can you apply for?'}
                          </p>
                        </div>
                      </button>
                    )}
                    {(isDbLoaded || adminNodes.length > 0) && (
                      <button
                        key="job-alert-tile"
                        onClick={() => { trackTile('Job Alert'); navigateTo('job_alert'); }}
                        className="group relative bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-400 transition-all cursor-pointer flex flex-col items-start justify-between text-left overflow-hidden h-36 active:scale-98"
                      >
                        <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm animate-pulse"></span>
                        </div>

                        <div className="w-12 h-12 rounded-2xl bg-blue-50 group-hover:bg-blue-100 transition-colors flex items-center justify-center text-2xl shadow-inner flex-shrink-0 mb-2">
                          🔔
                        </div>

                        <div className="w-full">
                          <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-sm sm:text-base leading-snug line-clamp-1">
                            {langHindi ? 'Job Alert' : 'Job Alert'}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5 font-medium line-clamp-1">
                            {langHindi ? 'सरकारी नौकरी • अंतिम तिथि' : 'Govt jobs • last dates'}
                          </p>
                        </div>
                      </button>
                    )}
                    </div>
                  </m.div>
              </>
            )}

            {/* 2. QUIZ SUBJECT CATEGORIES */}
            {currentView === 'eligibility' && (
              <React.Suspense fallback={<ScreenLoader />}>
              <EligibilityList
                onOpenExam={(id) => {
                  setEligibilityExamId(id);
                  navigateTo('eligibility_exam');
                }}
              />
              </React.Suspense>
            )}

            {currentView === 'eligibility_exam' && <React.Suspense fallback={<ScreenLoader />}><EligibilityExam examId={eligibilityExamId} /></React.Suspense>}

            {currentView === 'job_alert' && <React.Suspense fallback={<ScreenLoader />}><JobAlert /></React.Suspense>}

            {currentView === 'quiz_categories' && (
              <m.div
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

                {(() => {
                  const quizSubjects = getQuizSubjectsFromAdmin(adminNodes);
                  if (quizSubjects.length === 0) {
                    return (
                      <div className="border-2 border-dashed border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center text-center text-slate-400 select-none bg-slate-50/60 my-6">
                        <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-2xl mb-3">
                          📝
                        </div>
                        <h3 className="text-base font-bold text-slate-800">
                          {langHindi ? 'कोई क्विज अभी उपलब्ध नहीं है' : 'No Quizzes Available'}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm">
                          {langHindi 
                            ? 'Admin Panel से नए MCQs या विषयवार क्विज जोड़ें। वे तुरंत यहाँ दिखाई देंगे।'
                            : 'Add new MCQs or Subject Quizzes from your Admin Panel. They will appear here live.'}
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {quizSubjects.map((subj) => (
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
                            {subj.icon || '📝'}
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900 text-base">{langHindi ? subj.title : subj.titleEn}</h3>
                            <p className="text-xs text-slate-500 mt-0.5">{langHindi ? subj.subtitle : subj.subtitleEn}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </m.div>
            )}

            {/* 3. QUIZ PLAY (MCQ REAL EXPERIENCE WITH INSTANT GREEN/RED FEEDBACK) */}
            {currentView === 'quiz_play' && (
              <m.div
                key="quiz-play"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 sm:p-8 max-w-2xl mx-auto space-y-6"
              >
                {(() => {
                  const currentQ = quizQuestions ? (quizQuestions[quizIndex] || quizQuestions[0]) : null;
                  if (!currentQ) {
                    return (
                      <div className="border-2 border-dashed border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center text-center text-slate-400 select-none bg-slate-50/60 my-6">
                        <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-2xl mb-3">
                          📝
                        </div>
                        <h3 className="text-base font-bold text-slate-800">
                          {langHindi ? 'कोई प्रश्न उपलब्ध नहीं है' : 'No Questions Available'}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm">
                          {langHindi 
                            ? 'Admin Panel से इस क्विज के लिए प्रश्न जोड़ें।' 
                            : 'Add questions for this quiz from Admin Panel.'}
                        </p>
                        <button
                          onClick={() => navigateTo('quiz_categories')}
                          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                        >
                          {langHindi ? 'श्रेणियां देखें' : 'View Categories'}
                        </button>
                      </div>
                    );
                  }
                  return (
                    <>
                      <div className="flex items-center justify-between pb-4 border-b border-slate-100 text-xs font-bold text-slate-500">
                        <span>{langHindi ? `प्रश्न ${quizIndex + 1} / ${quizQuestions.length}` : `Question ${quizIndex + 1} / ${quizQuestions.length}`}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setLangHindi(!langHindi)}
                            className="px-2.5 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold transition border border-blue-200 active:scale-95 cursor-pointer text-xs flex items-center gap-1"
                            title="Language Toggle / भाषा बदलें"
                          >
                            <span>🌐</span>
                            <span>{langHindi ? 'EN' : 'हिंदी'}</span>
                          </button>
                          <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-bold">
                            {langHindi ? `स्कोर: ${quizScore}` : `Score: ${quizScore}`}
                          </span>
                        </div>
                      </div>

                      <PyqBadge tag={(currentQ as any).pyq} />
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
                                  // (tap sound dropped here: the correct/wrong sound plays at the same moment)
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
                            <Sparkles className="w-4 h-4 text-blue-600" /> {langHindi ? 'व्याख्या (Explanation):' : 'Explanation:'}
                          </p>
                          <p>{langHindi ? (currentQ.explanation || currentQ.explanationEn) : (currentQ.explanationEn || currentQ.explanation)}</p>
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
                            <span>{quizIndex + 1 < quizQuestions.length ? (langHindi ? 'अगला प्रश्न' : 'Next Question') : (langHindi ? 'रिजल्ट देखें' : 'View Results')}</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </m.div>
            )}

            {/* 4. QUIZ RESULT SCORECARD & COMPREHENSIVE ANSWER REVIEW */}
            {currentView === 'quiz_result' && (
              <m.div
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
                  <h2 className="text-2xl font-bold text-slate-900 mb-1">{langHindi ? 'क्विज परिणाम (Scorecard)' : 'Quiz Results (Scorecard)'}</h2>
                  <p className="text-xs text-slate-500">{langHindi ? selectedSubject.title : (selectedSubject.titleEn || selectedSubject.title)}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold">{langHindi ? 'कुल सही (Correct)' : 'Total Correct'}</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">{quizScore}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold">{langHindi ? 'कुल गलत (Incorrect)' : 'Total Incorrect'}</p>
                    <p className="text-2xl font-bold text-rose-600 mt-1">{quizQuestions.length - quizScore}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold">{langHindi ? 'सटीकता (Accuracy)' : 'Accuracy'}</p>
                    <p className="text-xl font-bold text-purple-600 mt-1">{Math.round((quizScore / (quizQuestions.length || 1)) * 100)}%</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold">{langHindi ? 'कुल प्रश्न (Total)' : 'Total Questions'}</p>
                    <p className="text-xl font-bold text-blue-600 mt-1">{quizQuestions.length}</p>
                  </div>
                </div>

                {/* Question Review Section */}
                <div className="text-left border-t border-slate-100 pt-4">
                  <button
                    onClick={() => setReviewExpanded(!reviewExpanded)}
                    className="w-full flex items-center justify-between text-xs font-bold text-blue-700 bg-blue-50 px-4 py-2.5 rounded-xl transition cursor-pointer"
                  >
                    <span>{reviewExpanded ? (langHindi ? 'विस्तृत समीक्षा छुपाएं' : 'Hide Detailed Review') : (langHindi ? 'सभी प्रश्नों की विस्तृत समीक्षा देखें' : 'View Detailed Answer Review')}</span>
                    {reviewExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {reviewExpanded && (
                    <div className="mt-4 space-y-4">
                      {quizQuestions.map((q, idx) => {
                        const userAns = userQuizAnswers[idx];
                        const isCorrect = userAns === q.correct;
                        return (
                          <div key={idx} className={"p-4 rounded-2xl border text-xs " + (isCorrect ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200')}>
                            <p className="font-bold text-slate-900 mb-1">
                              Q{idx + 1}. {langHindi ? q.question : (q.questionEn || q.question)}
                            </p>
                            <p className="text-slate-700 mb-1">
                              {langHindi ? 'आपका उत्तर:' : 'Your Answer:'} <span className={isCorrect ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                                {userAns !== null && userAns !== undefined ? (langHindi ? q.options[userAns] : (q.optionsEn?.[userAns] || q.options[userAns])) : (langHindi ? 'अनुत्तरित' : 'Unanswered')}
                              </span>
                            </p>
                            {!isCorrect && (
                              <p className="text-emerald-800 font-bold mb-1">
                                {langHindi ? 'सही उत्तर:' : 'Correct Answer:'} {langHindi ? q.options[q.correct] : (q.optionsEn?.[q.correct] || q.options[q.correct])}
                              </p>
                            )}
                            <p className="text-slate-600 mt-1 italic">
                              💡 {langHindi ? q.explanation : (q.explanationEn || q.explanation)}
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
                    <RotateCcw className="w-4 h-4" /> {langHindi ? 'पुनः अभ्यास' : 'Practice Again'}
                  </button>
                  <button
                    onClick={() => navigateTo('quiz_categories')}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition active:scale-95 cursor-pointer"
                  >
                    {langHindi ? 'विषय बदलें' : 'Change Subject'}
                  </button>
                </div>
              </m.div>
            )}

            {/* 5. MOCK TEST PLAY */}
            {currentView === 'mock_play' && (
              <m.div
                key="mock-play"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 sm:p-8 max-w-2xl mx-auto space-y-6"
              >
                {(() => {
                  const currentMockQ = mockQuestions[mockIndex] || mockQuestions[0];
                  if (!currentMockQ) {
                    return (
                      <div className="border-2 border-dashed border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center text-center text-slate-400 select-none bg-slate-50/60 my-6">
                        <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-2xl mb-3">
                          📋
                        </div>
                        <h3 className="text-base font-bold text-slate-800">
                          {langHindi ? 'कोई मॉक टेस्ट प्रश्न उपलब्ध नहीं है' : 'No Mock Test Questions Available'}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm">
                          {langHindi 
                            ? 'Admin Panel से नया मॉक टेस्ट या MCQs जोड़ें।' 
                            : 'Add a new mock test or MCQs from Admin Panel.'}
                        </p>
                        <button
                          onClick={() => navigateTo('home')}
                          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                        >
                          {langHindi ? 'होम पर वापस जाएं' : 'Back to Home'}
                        </button>
                      </div>
                    );
                  }
                  return (
                    <>
                      <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between shadow-sm flex-wrap gap-2">
                        <div className="flex items-center gap-2 font-mono text-emerald-400 font-bold text-lg">
                          <Clock className="w-5 h-5" />
                          <span>{String(Math.floor(mockTimer / 60)).padStart(2, '0')}:{String(mockTimer % 60).padStart(2, '0')}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setLangHindi(!langHindi)}
                            className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition border border-white/20 active:scale-95 cursor-pointer text-xs flex items-center gap-1"
                          >
                            <span>🌐</span>
                            <span>{langHindi ? 'EN' : 'हिंदी'}</span>
                          </button>
                          <div className="text-xs font-bold text-slate-300">
                            {langHindi ? `प्रश्न ${mockIndex + 1} / ${mockQuestions.length}` : `Question ${mockIndex + 1} / ${mockQuestions.length}`}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setMockTimerActive(false);
                            playGentleSound('celebrate', soundMuted);
                            navigateTo('mock_result');
                          }}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer"
                        >
                          {langHindi ? 'सबमिट करें (Submit)' : 'Submit Test'}
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

                      <PyqBadge tag={(currentMockQ as any).pyq} />
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
                                playGentleSound('tap', soundMuted);
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
                          {langHindi ? 'पिछला (Previous)' : 'Previous'}
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
                                timeTaken: mockDurationSec - mockTimer
                              });
                              navigateTo('mock_result');
                            }
                          }}
                          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-sm active:scale-95 cursor-pointer"
                        >
                          {mockIndex + 1 < mockQuestions.length ? (langHindi ? 'अगला (Next)' : 'Next') : (langHindi ? 'सबमिट टेस्ट' : 'Submit Test')}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </m.div>
            )}

            {/* 6. MOCK TEST RESULT REPORT */}
            {currentView === 'mock_result' && (
              <m.div
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
                  <h2 className="text-2xl font-bold text-slate-900 mb-1">{langHindi ? 'मॉक टेस्ट स्कोरकार्ड (Analysis)' : 'Mock Test Scorecard (Analysis)'}</h2>
                  <p className="text-xs text-slate-500">{langHindi ? 'रिएल एग्जाम सिमुलेशन रिपोर्ट' : 'Real Exam Simulation Report'}</p>
                </div>

                {(() => {
                  let correct = 0;
                  let wrong = 0;
                  let unattempted = 0;
                  const secMap: Record<string, { total: number; correct: number; wrong: number }> = {};
                  mockQuestions.forEach((q, idx) => {
                    const ans = userMockAnswers[idx];
                    const sec = String(q.category || '');
                    if (!secMap[sec]) secMap[sec] = { total: 0, correct: 0, wrong: 0 };
                    secMap[sec].total++;
                    if (ans === null || ans === undefined) unattempted++;
                    else if (ans === q.correct) { correct++; secMap[sec].correct++; }
                    else { wrong++; secMap[sec].wrong++; }
                  });
                  const marksScore = correct * mockMarks.pos - wrong * mockMarks.neg;
                  const marksTotal = mockQuestions.length * mockMarks.pos;
                  const secNames = Object.keys(secMap);
                  const showSections = secNames.length > 1;

                  return (
                    <>
                      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200" data-testid="mock-marks">
                        <p className="text-xs text-blue-700 font-bold">{langHindi ? 'कुल अंक (Marks)' : 'Total Marks'}</p>
                        <p className="text-3xl font-bold text-blue-900 mt-1">{langHindi ? 'अंक: ' : 'Marks: '}{fmtMarks(marksScore)} / {fmtMarks(marksTotal)}</p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {langHindi ? `सही +${fmtMarks(mockMarks.pos)}, गलत −${fmtMarks(mockMarks.neg)}, छोड़े 0` : `Correct +${fmtMarks(mockMarks.pos)}, Wrong −${fmtMarks(mockMarks.neg)}, Skipped 0`}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200">
                          <p className="text-xs text-emerald-700 font-bold">{langHindi ? 'सही (Correct)' : 'Correct'}</p>
                          <p className="text-2xl font-bold text-emerald-800 mt-1">{correct}</p>
                        </div>
                        <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200">
                          <p className="text-xs text-rose-700 font-bold">{langHindi ? 'गलत (Wrong)' : 'Wrong'}</p>
                          <p className="text-2xl font-bold text-rose-800 mt-1">{wrong}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                          <p className="text-xs text-slate-600 font-bold">{langHindi ? 'छोड़े गए (Skipped)' : 'Skipped'}</p>
                          <p className="text-2xl font-bold text-slate-800 mt-1">{unattempted}</p>
                        </div>
                      </div>

                      {showSections && (
                        <div className="text-left border border-slate-200 rounded-2xl overflow-hidden text-xs">
                          <div className="grid grid-cols-4 gap-1 bg-slate-50 px-3 py-2 font-bold text-slate-600">
                            <span>{langHindi ? 'सेक्शन' : 'Section'}</span><span className="text-center">{langHindi ? 'सही' : 'Correct'}</span><span className="text-center">{langHindi ? 'गलत' : 'Wrong'}</span><span className="text-right">{langHindi ? 'अंक' : 'Marks'}</span>
                          </div>
                          {secNames.map(name => {
                            const r = secMap[name];
                            return (
                              <div key={name || '-'} className="grid grid-cols-4 gap-1 px-3 py-2 border-t border-slate-100 text-slate-800">
                                <span className="truncate">{name || (langHindi ? 'अन्य' : 'Other')}</span>
                                <span className="text-center text-emerald-700">{r.correct}</span>
                                <span className="text-center text-rose-700">{r.wrong}</span>
                                <span className="text-right font-bold">{fmtMarks(r.correct * mockMarks.pos - r.wrong * mockMarks.neg)} / {fmtMarks(r.total * mockMarks.pos)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Mock Detailed Review */}
                      <div className="text-left border-t border-slate-100 pt-4">
                        <button
                          onClick={() => setReviewExpanded(!reviewExpanded)}
                          className="w-full flex items-center justify-between text-xs font-bold text-blue-700 bg-blue-50 px-4 py-2.5 rounded-xl transition cursor-pointer"
                        >
                          <span>{reviewExpanded ? (langHindi ? 'प्रश्नों की समीक्षा छुपाएं' : 'Hide Answer Review') : (langHindi ? 'प्रश्नों के सही उत्तर व व्याख्या देखें' : 'View Correct Answers & Explanations')}</span>
                          {reviewExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>

                        {reviewExpanded && (
                          <div className="mt-4 space-y-4">
                            {mockQuestions.map((q, idx) => {
                              const userAns = userMockAnswers[idx];
                              const isCorrect = userAns === q.correct;
                              return (
                                <div key={idx} className={"p-4 rounded-2xl border text-xs " + (isCorrect ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-slate-200')}>
                                  <p className="font-bold text-slate-900 mb-1">
                                    Q{idx + 1}. {langHindi ? q.question : (q.questionEn || q.question)}
                                  </p>
                                  <p className="text-slate-700 mb-1">
                                    {langHindi ? 'आपका उत्तर:' : 'Your Answer:'} <span className={isCorrect ? 'text-emerald-700 font-bold' : userAns === null ? 'text-slate-500' : 'text-rose-700 font-bold'}>
                                      {userAns !== null && userAns !== undefined ? (langHindi ? q.options[userAns] : (q.optionsEn?.[userAns] || q.options[userAns])) : (langHindi ? 'छोड़ा गया' : 'Skipped')}
                                    </span>
                                  </p>
                                  <p className="text-emerald-800 font-bold mb-1">
                                    {langHindi ? 'सही उत्तर:' : 'Correct Answer:'} {langHindi ? q.options[q.correct] : (q.optionsEn?.[q.correct] || q.options[q.correct])}
                                  </p>
                                  <p className="text-slate-600 mt-1 italic">
                                    💡 {langHindi ? q.explanation : (q.explanationEn || q.explanation)}
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
                      setUserMockAnswers(new Array(mockQuestions.length).fill(null));
                      setMockIndex(0);
                      setMockTimer(mockDurationSec);
                      setMockTimerActive(true);
                      navigateTo('mock_play');
                    }}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition flex items-center justify-center gap-2 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" /> {langHindi ? 'पुनः टेस्ट दें' : 'Retake Test'}
                  </button>
                  <button
                    onClick={() => navigateTo('home')}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition active:scale-95 cursor-pointer"
                  >
                    {langHindi ? 'होम स्क्रीन पर लौटें' : 'Return to Home'}
                  </button>
                </div>
              </m.div>
            )}

            {/* 7. NOTES LIBRARY */}
            {currentView === 'notes_lib' && (
              <m.div
                key="notes-lib"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.16 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{langHindi ? 'विषयवार PDF नोट्स लाइब्रेरी' : 'Subject-Wise PDF Notes Library'}</h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">{langHindi ? 'विषय चुनें और इन-ऐप PDF नोट्स पढ़ें' : 'Select subject to read in-app PDF notes'}</p>
                </div>

                {(() => {
                  const notesChapters = getNotesChaptersFromAdmin(adminNodes);
                  if (notesChapters.length === 0) {
                    return (
                      <div className="border-2 border-dashed border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center text-center text-slate-400 select-none bg-slate-50/60 my-6">
                        <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-2xl mb-3">
                          📚
                        </div>
                        <h3 className="text-base font-bold text-slate-800">
                          {langHindi ? 'कोई नोट्स अभी उपलब्ध नहीं हैं' : 'No Notes Available'}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm">
                          {langHindi 
                            ? 'Admin Panel से नए नोट्स या PDF जोड़ें। वे तुरंत यहाँ दिखाई देंगे।'
                            : 'Add new Notes or PDF from your Admin Panel. They will appear here live.'}
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-3 max-w-2xl mx-auto">
                      {notesChapters.map((chap) => (
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
                              <h3 className="font-bold text-slate-900 text-sm sm:text-base">{langHindi ? chap.title : (chap.titleEn || chap.title)}</h3>
                              <p className="text-xs text-slate-500 mt-0.5">{langHindi ? chap.subtitle : (chap.subtitleEn || chap.subtitle)}</p>
                            </div>
                          </div>
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </m.div>
            )}

            {/* 8. NOTES FULL SCREEN READER (PDF VIEWER STYLE) */}
            {currentView === 'notes_reader' && (
              <m.div
                key="notes-reader"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="max-w-4xl mx-auto space-y-4 pb-12"
              >
                {(() => {
                  const allChapters = getNotesChaptersFromAdmin(adminNodes);
                  const chap = selectedChapter || allChapters[0];
                  if (!chap) {
                    return (
                      <div className="text-center py-16 bg-white rounded-xl border border-slate-300 shadow-sm p-8">
                        <p className="text-sm font-medium text-slate-600 mb-4">
                          {langHindi ? 'कोई नोट्स सामग्री उपलब्ध नहीं है' : 'No notes content available'}
                        </p>
                        <button
                          onClick={() => navigateTo('home')}
                          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium shadow-sm cursor-pointer hover:bg-slate-800"
                        >
                          {langHindi ? 'मुख्य पृष्ठ पर लौटें' : 'Return to Home'}
                        </button>
                      </div>
                    );
                  }

                  const currentIndex = allChapters.findIndex(c => c.id === chap.id);
                  const prevChapter = currentIndex > 0 ? allChapters[currentIndex - 1] : null;
                  const nextChapter = currentIndex < allChapters.length - 1 ? allChapters[currentIndex + 1] : null;

                  const fontSizeClass = readerFontSize === 'sm' ? 'text-sm' : readerFontSize === 'lg' ? 'text-lg' : readerFontSize === 'xl' ? 'text-xl' : 'text-base';
                  const wordCount = chap.content.split(/\s+/).length;
                  const readTime = Math.ceil(wordCount / 130);

                  return (
                    <>
                      {/* PDF Viewer Top Bar */}
                      <div className="bg-slate-800 text-slate-200 px-4 py-3 rounded-t-xl flex items-center justify-between flex-wrap gap-3 shadow-md">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={handleBack}
                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
                          >
                            <span>←</span>
                            <span>{langHindi ? 'वापस' : 'Back'}</span>
                          </button>
                          <div className="flex items-center space-x-2 border-l border-slate-700 pl-3">
                            <span className="text-red-400 font-bold text-sm">PDF</span>
                            <span className="text-xs font-medium text-slate-300 truncate max-w-[200px] sm:max-w-xs">
                              {langHindi ? chap.title : (chap.titleEn || chap.title)}.pdf
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {/* Page Indicator */}
                          <span className="text-xs text-slate-400 bg-slate-900 px-2.5 py-1 rounded">
                            {currentIndex + 1} / {allChapters.length}
                          </span>

                          {/* Font Size Adjuster */}
                          <div className="flex items-center bg-slate-900 rounded p-0.5 border border-slate-700">
                            <button
                              onClick={() => setReaderFontSize('sm')}
                              className={`px-2 py-0.5 rounded text-xs font-bold transition ${readerFontSize === 'sm' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                              title="Small Font"
                            >
                              A-
                            </button>
                            <button
                              onClick={() => setReaderFontSize('base')}
                              className={`px-2 py-0.5 rounded text-xs font-bold transition ${readerFontSize === 'base' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                              title="Normal Font"
                            >
                              A
                            </button>
                            <button
                              onClick={() => setReaderFontSize('lg')}
                              className={`px-2 py-0.5 rounded text-xs font-bold transition ${readerFontSize === 'lg' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                              title="Large Font"
                            >
                              A+
                            </button>
                          </div>

                          {/* Dark / Light Mode */}
                          <button
                            onClick={() => setReaderDarkMode(!readerDarkMode)}
                            className="p-1.5 rounded bg-slate-900 hover:bg-slate-700 transition cursor-pointer text-slate-300"
                            title="Toggle Theme"
                          >
                            {readerDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
                          </button>

                          {/* Copy Content */}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(chap.content);
                              setCopiedNotification(true);
                              setTimeout(() => setCopiedNotification(false), 2000);
                            }}
                            className="p-1.5 rounded bg-slate-900 hover:bg-slate-700 transition relative cursor-pointer text-slate-300"
                            title="Copy Notes"
                          >
                            <Copy className="w-4 h-4" />
                            {copiedNotification && (
                              <span className="absolute -bottom-7 left-1/2 transform -translate-x-1/2 bg-slate-950 text-white text-[10px] px-2 py-0.5 rounded shadow">
                                Copied!
                              </span>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* PDF Document Page View */}
                      <div className={`p-8 sm:p-16 rounded-b-xl border border-t-0 shadow-2xl transition-colors font-sans ${readerDarkMode ? 'bg-[#12141c] border-slate-800 text-white' : 'bg-white border-slate-300 text-black'}`}>
                        {/* Document Header */}
                        <div className={`border-b pb-6 mb-8 text-center sm:text-left ${readerDarkMode ? 'border-slate-800' : 'border-slate-300'}`}>
                          <div className="text-xs uppercase tracking-widest text-blue-600 dark:text-blue-400 font-bold mb-1">
                            {langHindi ? 'अध्याय नोट्स • अध्ययन सामग्री' : 'Chapter Notes • Study Material'}
                          </div>
                          <h1 className={`text-2xl sm:text-3xl font-black tracking-tight ${readerDarkMode ? 'text-white' : 'text-black'}`}>
                            {langHindi ? chap.title : (chap.titleEn || chap.title)}
                          </h1>
                          {chap.subtitle && (
                            <p className={`text-sm font-semibold mt-1 ${readerDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                              {chap.subtitle}
                            </p>
                          )}
                        </div>

                        {/* Document Content */}
                        {(() => {
                          const isHtmlContent = Boolean(
                            chap.content && (
                              chap.content.includes('<html') ||
                              chap.content.includes('<!DOCTYPE') ||
                              chap.content.includes('<script') ||
                              chap.content.includes('<style') ||
                              chap.content.includes('<div') ||
                              chap.content.includes('<body')
                            )
                          );

                          if (isHtmlContent) {
                            return (
                              <div className="w-full my-4 rounded-xl overflow-hidden shadow-xs border border-slate-200 dark:border-slate-800 bg-white">
                                <SandboxedHtmlView
                                  htmlContent={chap.content}
                                  title={langHindi ? chap.title : (chap.titleEn || chap.title)}
                                  minHeight={480}
                                />
                              </div>
                            );
                          }

                          return (
                            <div className={`space-y-4 leading-relaxed ${fontSizeClass}`}>
                              {chap.content.split('\n').map((paragraph, idx) => {
                                const trimmed = paragraph.trim();
                                if (!trimmed) return <div key={idx} className="h-3" />;
                                if (trimmed.startsWith('#') || trimmed.endsWith(':') || trimmed.startsWith('•') || trimmed.startsWith('-')) {
                                  return (
                                    <h3 key={idx} className={`font-black text-lg sm:text-xl mt-6 mb-2 border-b pb-1.5 ${readerDarkMode ? 'text-white border-slate-800' : 'text-black border-slate-300'}`}>
                                      {trimmed.replace(/^[#\-•]\s*/, '')}
                                    </h3>
                                  );
                                }
                                return (
                                  <p key={idx} className={`leading-relaxed font-semibold ${readerDarkMode ? 'text-slate-100' : 'text-black'}`}>
                                    {trimmed}
                                  </p>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {/* Page Footer */}
                        <div className="mt-16 pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                          <span>Page {currentIndex + 1} of {allChapters.length}</span>
                          <span>StudyNotes Pro</span>
                        </div>
                      </div>

                      {/* Bottom Navigation Bar */}
                      <div className="flex items-center justify-between pt-2 px-1 flex-wrap gap-3">
                        {prevChapter ? (
                          <button
                            onClick={() => setSelectedChapter(prevChapter)}
                            className="px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition flex items-center gap-2 cursor-pointer shadow-xs"
                          >
                            <span>←</span>
                            <span className="truncate max-w-[150px]">{prevChapter.title}</span>
                          </button>
                        ) : <div />}

                        {nextChapter ? (
                          <button
                            onClick={() => setSelectedChapter(nextChapter)}
                            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition flex items-center gap-2 cursor-pointer shadow-xs ml-auto"
                          >
                            <span className="truncate max-w-[150px]">{nextChapter.title}</span>
                            <span>→</span>
                          </button>
                        ) : null}
                      </div>
                    </>
                  );
                })()}
              </m.div>
            )}

            {/* 9. CALCULATION SETUP SCREEN (ALL SUBJECTS: PERCENTAGE, PROFIT & LOSS, TIME & WORK, ETC.) */}
            {currentView === 'calc_setup' && (
              <m.div
                key="calc-setup"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="space-y-6 max-w-2xl mx-auto"
              >
                {/* Question Count */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{langHindi ? 'प्रश्नों की संख्या (Question Count)' : 'Question Count'}</h3>
                  <div className="grid grid-cols-5 gap-2">
                    {[10, 25, 50, 100, 'Infinite'].map((cnt) => (
                      <button
                        key={String(cnt)}
                        onClick={() => setCalcCount(cnt as number | 'Infinite')}
                        className={"py-3 rounded-xl font-bold text-xs sm:text-sm border transition active:scale-95 cursor-pointer " + (calcCount === cnt ? 'bg-blue-600 border-blue-500 text-white shadow-sm' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200')}
                      >
                        {cnt === 'Infinite' ? (langHindi ? 'असीमित' : 'Unlimited') : `${cnt} Q`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Difficulty */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-amber-500" /> {langHindi ? 'कठिनाई स्तर (Difficulty)' : 'Difficulty Level'}
                  </h3>
                  <div className="grid grid-cols-4 gap-2">
                    {(['सरल', 'मध्यम', 'कठिन', 'प्रो'] as const).map((diff) => (
                      <button
                        key={diff}
                        onClick={() => setCalcDifficulty(diff)}
                        className={"py-3 rounded-xl font-bold text-xs sm:text-sm border transition active:scale-95 cursor-pointer " + (calcDifficulty === diff ? 'bg-blue-600 border-blue-500 text-white shadow-sm' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200')}
                      >
                        {langHindi ? diff : (diff === 'सरल' ? 'Easy' : diff === 'मध्यम' ? 'Medium' : diff === 'कठिन' ? 'Hard' : 'Pro')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mathematics Subjects */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Calculator className="w-4 h-4 text-blue-600" /> {langHindi ? 'विषय चुनें (Math Topics)' : 'Select Math Topic'}
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setIsCustomTopicMode(!isCustomTopicMode);
                          if (!isCustomTopicMode && selectedCustomTopics.length === 0) {
                            const base = ALL_MATH_TOPICS.filter(t => !t.includes('मिश्रित'));
                            setSelectedCustomTopics(base.slice(0, 3));
                          }
                        }}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer active:scale-95 ${isCustomTopicMode ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'}`}
                      >
                        <span>🎛️</span>
                        <span>{langHindi ? (isCustomTopicMode ? 'सिंगल मोड' : 'कस्टम मिक्स (Multi)') : (isCustomTopicMode ? 'Single Mode' : 'Custom Mix (Multi)')}</span>
                      </button>
                      <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                        {isCustomTopicMode ? (langHindi ? `${selectedCustomTopics.length} चुने गए` : `${selectedCustomTopics.length} selected`) : (langHindi ? `${ALL_MATH_TOPICS.length} विषय` : `${ALL_MATH_TOPICS.length} topics`)}
                      </span>
                    </div>
                  </div>

                  {isCustomTopicMode && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 text-xs text-indigo-800 font-medium">
                      💡 {langHindi ? 'अपनी पसंद के जितने चाहें उतने चैप्टर्स पर क्लिक करें। प्रश्न सिर्फ इन्हीं चुने गए चैप्टर्स से मिक्स होकर आएंगे।' : 'Click multiple chapters of your choice. Questions will be randomly mixed from your selected chapters.'}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                    {ALL_MATH_TOPICS.filter(t => !t.includes('मिश्रित')).map((top) => {
                      const isSelected = isCustomTopicMode ? selectedCustomTopics.includes(top) : calcTopic === top;
                      return (
                        <button
                          key={top}
                          onClick={() => {
                            if (isCustomTopicMode) {
                              if (selectedCustomTopics.includes(top)) {
                                if (selectedCustomTopics.length > 1) {
                                  setSelectedCustomTopics(selectedCustomTopics.filter(t => t !== top));
                                }
                              } else {
                                setSelectedCustomTopics([...selectedCustomTopics, top]);
                              }
                            } else {
                              setCalcTopic(top);
                            }
                          }}
                          className={"p-3 rounded-xl text-left font-bold text-xs sm:text-sm border transition flex items-center justify-between gap-2.5 active:scale-98 cursor-pointer " + (isSelected ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100')}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <span className={"w-2.5 h-2.5 rounded-full shrink-0 " + (isSelected ? 'bg-blue-600 ring-4 ring-blue-100' : 'bg-slate-300')}></span>
                            <span className="truncate">{top}</span>
                          </div>
                          {isCustomTopicMode && (
                            <span className={`w-5 h-5 rounded-md flex items-center justify-center text-xs border ${isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-300'}`}>
                              {isSelected ? '✓' : ''}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Start Button */}
                <button
                  onClick={generateCalculationSet}
                  disabled={calcGenLoading}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-bold text-base shadow-md flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
                >
                  <span>🚀 {langHindi ? `अभ्यास शुरू करें (${calcCount === 'Infinite' ? 'असीमित प्रश्न' : `${calcCount} प्रश्न`})` : `Start Practice (${calcCount === 'Infinite' ? 'Unlimited' : `${calcCount} Questions`})`}</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </m.div>
            )}

            {/* 10. CALCULATION PRACTICE (INSTANT FEEDBACK, ZERO REPETITIONS, 100% ACCURATE MATH) */}
            {currentView === 'calc_practice' && calcQuestions && calcQuestions.length > 0 && (
              <m.div
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
                        <span className="truncate max-w-[180px] sm:max-w-[220px]">{langHindi ? `टॉपिक: ${currentCalcQ.category || calcTopic}` : `Topic: ${currentCalcQ.category || calcTopic}`}</span>
                        <div className="flex items-center gap-2.5 sm:gap-3">
                          <button
                            onClick={() => setLangHindi(!langHindi)}
                            className="px-2 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold transition border border-blue-200 active:scale-95 cursor-pointer text-xs flex items-center gap-1"
                            title="Language Toggle / भाषा बदलें"
                          >
                            <span>🌐</span>
                            <span>{langHindi ? 'EN' : 'हिंदी'}</span>
                          </button>
                          <span className="text-amber-600 flex items-center gap-1">
                            <Zap className="w-3.5 h-3.5" /> {calcScore}
                          </span>
                          <span className="flex items-center gap-1 text-blue-600">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{String(Math.floor(calcTimer / 60)).padStart(2, '0')}:{String(calcTimer % 60).padStart(2, '0')}</span>
                          </span>
                          <span className="bg-slate-100 px-2.5 py-1 rounded-lg">
                            Q {calcIndex + 1} {calcCount === 'Infinite' ? (langHindi ? '(∞ असीमित)' : '(∞ Unlimited)') : `/ ${calcQuestions.length}`}
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
                              {langHindi ? 'समाप्त करें' : 'Finish'}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 text-center shadow-sm relative overflow-hidden">
                        <span className="absolute top-3 left-4 text-[10px] uppercase font-bold tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                          {langHindi ? `स्पीड कैलकुलेशन • ${calcDifficulty}` : `Speed Math • ${calcDifficulty}`}
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
                                  // (tap sound dropped here: the correct/wrong sound plays at the same moment)
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
                            {calcSelected === currentCalcQ.correct ? (langHindi ? '✅ सही उत्तर!' : '✅ Correct Answer!') : (langHindi ? `❌ गलत उत्तर! सही उत्तर था: ${currentCalcQ.options[currentCalcQ.correct]}` : `❌ Incorrect! Correct answer was: ${currentCalcQ.options[currentCalcQ.correct]}`)}
                          </p>
                          <p className="text-xs text-slate-700 mt-1 font-medium whitespace-pre-line">
                            📖 {langHindi ? currentCalcQ.explanation : (currentCalcQ.explanationEn || currentCalcQ.explanation)}
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
                              } else if (calcCount === 'Infinite' && mathGenFn) {
                                const nextQ = mathGenFn(
                                  calcTopic,
                                  calcQuestions.length + 1,
                                  calcDifficulty,
                                  seenMathSignaturesRef.current
                                );
                                setCalcQuestions(prev => [...prev, nextQ]);
                                setCalcIndex(prev => prev + 1);
                                setCalcSelected(null);
                                setCalcAnswered(false);

                                try {
                                  const arr = Array.from(seenMathSignaturesRef.current).slice(-2000);
                                  localStorage.setItem('study_seen_math_questions_v2', JSON.stringify(arr));
                                } catch {}
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
                            <span>{calcCount === 'Infinite' || calcIndex + 1 < calcQuestions.length ? (langHindi ? 'अगला प्रश्न' : 'Next Question') : (langHindi ? 'रिजल्ट देखें' : 'View Results')}</span>
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
                              {langHindi ? 'समाप्त करें' : 'Finish'}
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </m.div>
            )}

            {/* 11. CALCULATION RESULT */}
            {currentView === 'calc_result' && (
              <m.div
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
                  <h2 className="text-2xl font-bold text-slate-900 mb-1">{langHindi ? 'कैलकुलेशन रिपोर्ट कार्ड (Analysis)' : 'Calculation Report Card (Analysis)'}</h2>
                  <p className="text-xs text-slate-500">{calcTopic} • {calcDifficulty}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold">{langHindi ? 'कुल सही (Correct)' : 'Total Correct'}</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">{calcCorrectCount}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold">{langHindi ? 'कुल गलत (Incorrect)' : 'Total Incorrect'}</p>
                    <p className="text-2xl font-bold text-rose-600 mt-1">{calcWrongCount}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold">{langHindi ? 'कुल समय (Time Taken)' : 'Time Taken'}</p>
                    <p className="text-xl font-bold text-blue-600 mt-1">{calcTimer}s</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold">{langHindi ? 'सटीकता (Accuracy)' : 'Accuracy'}</p>
                    <p className="text-xl font-bold text-purple-600 mt-1">{Math.round((calcCorrectCount / (calcQuestions.length || 1)) * 100)}%</p>
                  </div>
                </div>

                {/* Calculation Questions Review */}
                <div className="text-left border-t border-slate-100 pt-4">
                  <button
                    onClick={() => setReviewExpanded(!reviewExpanded)}
                    className="w-full flex items-center justify-between text-xs font-bold text-blue-700 bg-blue-50 px-4 py-2.5 rounded-xl transition cursor-pointer"
                  >
                    <span>{reviewExpanded ? (langHindi ? 'सवालों की व्याख्या छुपाएं' : 'Hide Explanations') : (langHindi ? 'सभी सवालों के हल और शॉर्टकट ट्रिक्स देखें' : 'View All Solutions & Shortcut Tricks')}</span>
                    {reviewExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {reviewExpanded && (
                    <div className="mt-4 space-y-4">
                      {calcQuestions.map((q, idx) => {
                        const userAns = calcUserAnswers[idx];
                        const isCorrect = userAns ? userAns.correct : false;
                        return (
                          <div key={idx} className={"p-4 rounded-2xl border text-xs " + (isCorrect ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200')}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-slate-900">Q{idx + 1}. {langHindi ? q.question : (q.questionEn || q.question)}</span>
                              <span className={"font-bold px-2 py-0.5 rounded " + (isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800')}>
                                {isCorrect ? (langHindi ? 'सही' : 'Correct') : (langHindi ? 'गलत' : 'Wrong')}
                              </span>
                            </div>
                            <p className="text-emerald-800 font-bold mb-1">
                              {langHindi ? 'सही उत्तर:' : 'Correct Answer:'} {langHindi ? q.options[q.correct] : (q.optionsEn?.[q.correct] || q.options[q.correct])}
                            </p>
                            <p className="text-slate-700 whitespace-pre-line mt-1">
                              {langHindi ? q.explanation : (q.explanationEn || q.explanation)}
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
                    <RotateCcw className="w-4 h-4" /> {langHindi ? 'नया सेट हल करें' : 'Solve New Set'}
                  </button>
                  <button
                    onClick={() => navigateTo('calc_setup')}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition active:scale-95 cursor-pointer"
                  >
                    {langHindi ? 'सेटअप बदलें' : 'Change Setup'}
                  </button>
                </div>
              </m.div>
            )}

            {/* 12. TYPING SKILLS SETUP */}
            {currentView === 'typing_setup' && (
              <m.div
                key="typing-setup"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.16 }}
                className="space-y-6 max-w-2xl mx-auto"
              >
                <div className="text-center">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{langHindi ? '⌨️ टाइपिंग स्पीड एवं एक्यूरेसी लैब' : '⌨️ Typing Speed & Accuracy Lab'}</h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">{langHindi ? 'SSC CGL, CHSL, Delhi Police HC स्पीड एवं एक्यूरेसी टेस्ट' : 'SSC CGL, CHSL, Delhi Police HC Typing Test'}</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{langHindi ? 'समय अवधि चुनें (Duration):' : 'Select Time Duration:'}</h3>
                  <p className="text-[11px] text-slate-500 mb-3">{typingDurationPicked ? (langHindi ? 'हर पैसेज पर आपका चुना समय लगेगा' : 'Your chosen time applies to every passage') : (langHindi ? 'अभी हर पैसेज अपने समय (⏱) पर चलेगा — बदलना हो तो ऊपर चुनें' : 'Each passage runs on its own time (⏱) — pick one to override')}</p>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 5, 10, 'Infinite'].map((dur) => (
                      <button
                        key={String(dur)}
                        onClick={() => { setTypingDuration(dur as number | 'Infinite'); setTypingDurationPicked(true); }}
                        className={"py-2.5 rounded-xl font-bold text-xs sm:text-sm border transition active:scale-95 cursor-pointer " + (typingDuration === dur ? 'bg-blue-600 border-blue-500 text-white shadow-sm' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200')}
                      >
                        {dur === 'Infinite' ? (langHindi ? '∞ नि:शुल्क' : '∞ Free') : `${dur} ${langHindi ? 'मि' : 'm'}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {langHindi ? 'उपलब्ध टाइपिंग टेस्ट्स:' : 'Available Typing Tests:'}
                  </h3>

                  {(() => {
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

                    if (adminTypingTests.length === 0) {
                      return (
                        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center text-slate-400 select-none bg-slate-50/60 my-2">
                          <div className="w-12 h-12 rounded-xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-xl mb-2">
                            ⌨️
                          </div>
                          <h4 className="text-sm font-bold text-slate-800">
                            {langHindi ? 'कोई टाइपिंग टेस्ट उपलब्ध नहीं है' : 'No Typing Tests Available'}
                          </h4>
                          <p className="text-xs text-slate-500 mt-1 max-w-sm">
                            {langHindi 
                              ? 'Admin Panel से नया टाइपिंग टेस्ट पैसेज जोड़ें। वह तुरंत यहाँ लाइव दिखाई देगा।' 
                              : 'Add a new typing test passage from your Admin Panel. It will appear here live.'}
                          </p>
                        </div>
                      );
                    }

                    return adminTypingTests.map((testItem: any, idx: number) => {
                      const id = testItem.id || `typing-${idx}`;
                      const title = testItem.title || testItem.name || `टाइपिंग टेस्ट सेट #${idx + 1}`;
                      const sub = testItem.subtitle || testItem.sub || 'SSC & State Exams Typing';
                      const text = testItem.passage || testItem.text || testItem.typingPassage || testItem.content || testItem.html || '';
                      const passageMins = typingPassageMinutes(testItem, text);

                      return (
                        <button
                          key={id}
                          onClick={() => {
                            setActiveTypingPassage(text);
                            setActiveTypingTitle(title);
                            setTypedInput('');
                            setTypingStarted(false);
                            if (!typingDurationPicked) {
                              setTypingDuration(passageMins);
                              setTypingTimeLeft(passageMins * 60);
                            } else {
                              setTypingTimeLeft(typeof typingDuration === 'number' ? typingDuration * 60 : 120);
                            }
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
                                {langHindi ? `${text.trim().split(/\s+/).filter(Boolean).length} शब्द • ${text.length} अक्षर` : `${text.trim().split(/\s+/).filter(Boolean).length} words • ${text.length} chars`}
                                {` • ⏱ ${!typingDurationPicked ? passageMins : (typingDuration === 'Infinite' ? '∞' : typingDuration)} ${langHindi ? 'मि' : 'min'}`}
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
              </m.div>
            )}

            {/* 13. TYPING PRACTICE SCREEN */}
            {currentView === 'typing_practice' && (
              <m.div
                key="typing-practice"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 p-3.5 sm:p-6 max-w-2xl mx-auto space-y-3 sm:space-y-5"
              >
                <div className="bg-slate-900 text-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 flex items-center justify-between shadow-sm">
                  <div className={"flex items-center gap-1.5 sm:gap-2 font-mono font-bold text-sm sm:text-lg " + (typingTimeLeft <= 10 && typingDuration !== 'Infinite' ? 'text-rose-400 animate-pulse' : 'text-emerald-400')}>
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>
                      {typingDuration === 'Infinite'
                        ? '∞ Free'
                        : `${String(Math.floor(typingTimeLeft / 60)).padStart(2, '0')}:${String(typingTimeLeft % 60).padStart(2, '0')}`}
                    </span>
                  </div>
                  <div className="text-center font-mono">
                    <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase">WPM</p>
                    <p className="text-base sm:text-xl font-bold text-blue-400">
                      {(() => {
                        const words = typedInput.trim().split(/\s+/).filter(Boolean).length;
                        const totalAllowedSec = typeof typingDuration === 'number' ? typingDuration * 60 : 120;
                        const elapsedSec = Math.max(1, totalAllowedSec - typingTimeLeft);
                        return Math.round((words / elapsedSec) * 60) || 0;
                      })()}
                    </p>
                  </div>
                  <div className="text-center font-mono">
                    <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase">ACC</p>
                    <p className="text-base sm:text-xl font-bold text-amber-400">
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
                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition shadow-sm active:scale-95 cursor-pointer"
                  >
                    {langHindi ? 'समाप्त' : 'Finish'}
                  </button>
                </div>

                {/* Passage Box with Real-time Scrolling and Color-coded Characters */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
                    <span className="text-[11px] sm:text-xs">{langHindi ? 'मूल पैराग्राफ (टाइप करने हेतु टेक्स्ट):' : 'Original Passage (Text to Type):'}</span>
                    <span className="text-[10px] sm:text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-mono">
                      {langHindi ? `${typedInput.length} / ${passageText.length} अक्षर` : `${typedInput.length} / ${passageText.length} chars`}
                    </span>
                  </div>
                  <div 
                    ref={typingScrollRef}
                    className="bg-slate-50 p-3 sm:p-5 rounded-2xl text-slate-800 font-mono text-sm sm:text-lg leading-relaxed border-2 border-slate-200 h-32 sm:h-52 overflow-y-auto overscroll-contain select-none shadow-inner"
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

                {/* Input Area (Compact & Mobile Keyboard Friendly) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
                    <span className="text-[11px] sm:text-xs">{langHindi ? 'टाइपिंग इनपुट (यहीं टाइप करें):' : 'Typing Input (Type Here):'}</span>
                    <span className="text-[10px] sm:text-[11px] text-slate-400">
                      {typingTimeLeft <= 0 && typingDuration !== 'Infinite' ? (langHindi ? '⚠️ समय समाप्त (बंद)' : '⚠️ Time Over (Closed)') : (langHindi ? 'कीबोर्ड फ्रेंडली बॉक्स' : 'Keyboard friendly box')}
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    disabled={typingTimeLeft <= 0 && typingDuration !== 'Infinite'}
                    value={typedInput}
                    onFocus={(e) => {
                      setTimeout(() => {
                        e.target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                      }, 250);
                    }}
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
                    placeholder={typingTimeLeft <= 0 && typingDuration !== 'Infinite' ? (langHindi ? "समय समाप्त हो चुका है।" : "Time is over.") : (langHindi ? "कीबोर्ड से यहाँ टाइप करना शुरू करें..." : "Start typing here with keyboard...")}
                    className={"w-full h-18 sm:h-22 p-2.5 sm:p-3 rounded-2xl border-2 font-mono text-base sm:text-base leading-snug resize-none shadow-sm overscroll-contain transition-colors " + (typingTimeLeft <= 0 && typingDuration !== 'Infinite' ? 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed' : 'border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none bg-white text-slate-900')}
                  />
                </div>
              </m.div>
            )}

            {/* 14. TYPING RESULT REPORT */}
            {currentView === 'typing_result' && (
              <m.div
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
                  <h2 className="text-2xl font-bold text-slate-900 mb-1">{langHindi ? 'टाइपिंग टेस्ट स्कोरकार्ड' : 'Typing Test Scorecard'}</h2>
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
                        <p className="text-xs text-slate-500 font-bold">{langHindi ? 'स्पीड (Speed)' : 'Speed'}</p>
                        <p className="text-2xl font-bold text-blue-600 mt-1">{wpm} WPM</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <p className="text-xs text-slate-500 font-bold">{langHindi ? 'सटीकता (Accuracy)' : 'Accuracy'}</p>
                        <p className="text-2xl font-bold text-emerald-600 mt-1">{accuracy}%</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <p className="text-xs text-slate-500 font-bold">{langHindi ? 'टाइप किए गए शब्द' : 'Typed Words'}</p>
                        <p className="text-xl font-bold text-slate-800 mt-1">{words}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <p className="text-xs text-slate-500 font-bold">{langHindi ? 'कुल वर्ण (Chars)' : 'Total Chars'}</p>
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
                    <RotateCcw className="w-4 h-4" /> {langHindi ? 'पुनः टेस्ट दें' : 'Retake Test'}
                  </button>
                  <button
                    onClick={() => navigateTo('typing_setup')}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition active:scale-95 cursor-pointer"
                  >
                    {langHindi ? 'सेटअप बदलें' : 'Change Setup'}
                  </button>
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </SafeErrorBoundary>
  );
}
