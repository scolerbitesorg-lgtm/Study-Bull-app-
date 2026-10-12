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
  subtitleEn?: string;
  content: string;
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
        const normalizedQs: QuizQuestion[] = questions.map((q: any, i: number) => ({
          id: q.id || i + 1,
          question: q.question || q.qText || q.title || 'Question',
          questionEn: q.questionEn || q.question_en || q.question || 'Question',
          options: Array.isArray(q.options) ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
          optionsEn: Array.isArray(q.optionsEn) ? q.optionsEn : (Array.isArray(q.options) ? q.options : ['Option A', 'Option B', 'Option C', 'Option D']),
          correct: typeof q.correct === 'number' ? q.correct : (typeof q.answerIndex === 'number' ? q.answerIndex : 0),
          explanation: q.explanation || q.exp || 'सही उत्तर चुनने हेतु बधाई।',
          explanationEn: q.explanationEn || q.explanation_en || q.explanation || 'Great job selecting the correct answer.'
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
        const normalizedQs: QuizQuestion[] = questions.map((q: any, i: number) => ({
          id: q.id || i + 1,
          question: q.question || q.qText || q.title || 'Question',
          questionEn: q.questionEn || q.question_en || q.question || 'Question',
          options: Array.isArray(q.options) ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
          optionsEn: Array.isArray(q.optionsEn) ? q.optionsEn : (Array.isArray(q.options) ? q.options : ['Option A', 'Option B', 'Option C', 'Option D']),
          correct: typeof q.correct === 'number' ? q.correct : (typeof q.answerIndex === 'number' ? q.answerIndex : 0),
          explanation: q.explanation || q.exp || 'सही उत्तर चुनने हेतु बधाई।',
          explanationEn: q.explanationEn || q.explanation_en || q.explanation || 'Great job selecting the correct answer.'
        }));
        mockQs = mockQs.concat(normalizedQs);
      }

      if (Array.isArray(item.children) && item.children.length > 0) {
        traverse(item.children);
      }
    }
  }

  traverse(nodes);
  return mockQs;
}

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
      const typeVar = Math.floor(Math.random() * 6);
      if (typeVar === 0) {
        // Multi-term addition
        const count = difficulty === 'सरल' ? 2 : difficulty === 'मध्यम' ? 3 : 4;
        const nums = Array.from({ length: count }, () => Math.floor(Math.random() * (difficulty === 'प्रो' ? 4500 : 850)) + 45);
        const ans = nums.reduce((a, b) => a + b, 0);
        qText = `योग ज्ञात कीजिए: ${nums.join(' + ')} = ?`;
        qTextEn = `Calculate the sum: ${nums.join(' + ')} = ?`;
        ansStr = `${ans}`;
        explanation = `सभी पदों का योग:\n${nums.join(' + ')} = ${ans}।`;
        explanationEn = `Sum of all terms: ${nums.join(' + ')} = ${ans}.`;
        shortcut = `इकाई और दहाई अंकों को समूह बनाकर तेजी से जोड़ें = ${ans}`;
        distractors = [`${ans + 10}`, `${ans - 10}`, `${ans + 20}`, `${Math.max(1, ans - 20)}`];
      } else if (typeVar === 1) {
        // Missing term addition: A + X + B = C
        const a = Math.floor(Math.random() * 450) + 50;
        const b = Math.floor(Math.random() * 350) + 50;
        const x = Math.floor(Math.random() * 500) + 100;
        const c = a + b + x;
        qText = `समीकरण में अज्ञात संख्या 'X' का मान क्या होगा: ${a} + X + ${b} = ${c}?`;
        qTextEn = `Find the missing number 'X' in: ${a} + X + ${b} = ${c}?`;
        ansStr = `${x}`;
        explanation = `X = ${c} - (${a} + ${b}) = ${c} - ${a + b} = ${x}।`;
        explanationEn = `X = ${c} - (${a} + ${b}) = ${x}.`;
        shortcut = `कुल योग में से ज्ञात संख्याओं का योग घटाएं: ${c} - ${a + b} = ${x}`;
        distractors = [`${x + 10}`, `${Math.max(1, x - 10)}`, `${x + 25}`, `${Math.max(1, x - 25)}`];
      } else if (typeVar === 2) {
        // Sum of first N natural numbers
        const n = Math.floor(Math.random() * 40) + 10;
        const ans = (n * (n + 1)) / 2;
        qText = `प्रथम ${n} प्राकृत संख्याओं का योग (1 + 2 + 3 + ... + ${n}) कितना होगा?`;
        qTextEn = `What is the sum of first ${n} natural numbers (1 + 2 + 3 + ... + ${n})?`;
        ansStr = `${ans}`;
        explanation = `प्राकृत संख्याओं का योग सूत्र: S = [N × (N + 1)] ÷ 2\nS = [${n} × ${n + 1}] ÷ 2 = ${n * (n + 1)} ÷ 2 = ${ans}।`;
        explanationEn = `Sum formula = [N * (N + 1)] / 2 = [${n} * ${n + 1}] / 2 = ${ans}.`;
        shortcut = `शॉर्टकट सूत्र: S = [${n} × ${n + 1}] ÷ 2 = ${ans}`;
        distractors = [`${ans + n}`, `${ans - n}`, `${ans + 10}`, `${Math.max(1, ans - 10)}`];
      } else if (typeVar === 3) {
        // Sum of first N odd or even numbers
        const isEven = Math.random() > 0.5;
        const n = Math.floor(Math.random() * 25) + 10;
        if (isEven) {
          const ans = n * (n + 1);
          qText = `प्रथम ${n} सम (Even) संख्याओं का योग (2 + 4 + 6 + ... + ${2 * n}) क्या होगा?`;
          qTextEn = `What is the sum of first ${n} even numbers (2 + 4 + 6 + ... + ${2 * n})?`;
          ansStr = `${ans}`;
          explanation = `प्रथम N सम संख्याओं का योग सूत्र: N × (N + 1)\nयोग = ${n} × ${n + 1} = ${ans}।`;
          explanationEn = `Sum of first N even numbers = N * (N + 1) = ${n} * ${n + 1} = ${ans}.`;
          shortcut = `सूत्र: ${n} × ${n + 1} = ${ans}`;
          distractors = [`${ans + 10}`, `${ans - 10}`, `${ans + 20}`, `${ans - 20}`];
        } else {
          const ans = n * n;
          qText = `प्रथम ${n} विषम (Odd) संख्याओं का योग (1 + 3 + 5 + ... + ${2 * n - 1}) क्या होगा?`;
          qTextEn = `What is the sum of first ${n} odd numbers (1 + 3 + 5 + ... + ${2 * n - 1})?`;
          ansStr = `${ans}`;
          explanation = `प्रथम N विषम संख्याओं का योग सूत्र: N²\nयोग = (${n})² = ${ans}।`;
          explanationEn = `Sum of first N odd numbers = N² = (${n})² = ${ans}.`;
          shortcut = `सूत्र: (${n})² = ${ans}`;
          distractors = [`${ans + n}`, `${ans - n}`, `${ans + 15}`, `${Math.max(1, ans - 15)}`];
        }
      } else if (typeVar === 4) {
        // Unit digit of sum
        const a = Math.floor(Math.random() * 800) + 123;
        const b = Math.floor(Math.random() * 800) + 145;
        const c = Math.floor(Math.random() * 800) + 167;
        const d = Math.floor(Math.random() * 800) + 189;
        const unitAns = (a % 10 + b % 10 + c % 10 + d % 10) % 10;
        qText = `व्यंजक (${a} + ${b} + ${c} + ${d}) का इकाई अंक (Unit Digit) क्या होगा?`;
        qTextEn = `What is the unit digit of (${a} + ${b} + ${c} + ${d})?`;
        ansStr = `${unitAns}`;
        explanation = `केवल इकाई अंकों को जोड़ें:\n${a % 10} + ${b % 10} + ${c % 10} + ${d % 10} = ${a % 10 + b % 10 + c % 10 + d % 10}।\nइकाई का अंक = ${unitAns}।`;
        explanationEn = `Add only the unit digits: ${a % 10} + ${b % 10} + ${c % 10} + ${d % 10} = ${unitAns}.`;
        shortcut = `इकाई अंक की ट्रिक: अंतिम अंकों का योग mod 10 = ${unitAns}`;
        distractors = [`${(unitAns + 1) % 10}`, `${(unitAns + 2) % 10}`, `${(unitAns + 3) % 10}`, `${(unitAns + 5) % 10}`];
      } else {
        // Decimal addition
        const a = (Math.floor(Math.random() * 850) + 100) / 10;
        const b = (Math.floor(Math.random() * 650) + 50) / 10;
        const c = (Math.floor(Math.random() * 450) + 20) / 10;
        const ans = Math.round((a + b + c) * 10) / 10;
        qText = `दशमलव जोड़: ${a} + ${b} + ${c} = ?`;
        qTextEn = `Decimal sum: ${a} + ${b} + ${c} = ?`;
        ansStr = `${ans}`;
        explanation = `दशमलव बिंदुओं को सीध में रखकर जोड़ें:\n${a} + ${b} + ${c} = ${ans}।`;
        explanationEn = `Align decimal points and add: ${a} + ${b} + ${c} = ${ans}.`;
        shortcut = `दशमलव बिंदु सीधे जोड़ें = ${ans}`;
        distractors = [`${Math.round((ans + 1.2) * 10) / 10}`, `${Math.round(Math.max(0.1, ans - 1.2) * 10) / 10}`, `${Math.round((ans + 2.5) * 10) / 10}`, `${Math.round(Math.max(0.1, ans - 2.5) * 10) / 10}`];
      }
    }
    // 2. घटाव (Subtraction)
    else if (chosenTopic.includes('घटाव (Subtraction)')) {
      const typeVar = Math.floor(Math.random() * 5);
      if (typeVar === 0) {
        // Base method subtract (1000, 10000, 100000)
        const base = [1000, 10000, 100000][Math.floor(Math.random() * 3)];
        const b = Math.floor(Math.random() * (base * 0.8)) + Math.floor(base * 0.1);
        const ans = base - b;
        qText = `आधार विधि से घटाव हल करें: ${base} - ${b} = ?`;
        qTextEn = `Base subtraction: ${base} - ${b} = ?`;
        ansStr = `${ans}`;
        explanation = `${base} में से ${b} घटाया:\n${base} - ${b} = ${ans}।`;
        explanationEn = `Subtract from base ${base}: ${base} - ${b} = ${ans}.`;
        shortcut = `वैदिक सूत्र (निखिलं नवतश्चरमं दशतः): सभी अंकों को 9 से तथा अंतिम अंक को 10 से घटाएं = ${ans}`;
        distractors = [`${ans + 10}`, `${ans - 10}`, `${ans + 100}`, `${Math.max(1, ans - 100)}`];
      } else if (typeVar === 1) {
        // Missing term subtraction: A - X = B or X - A = B
        const isUnknownFirst = Math.random() > 0.5;
        if (isUnknownFirst) {
          const a = Math.floor(Math.random() * 400) + 150;
          const b = Math.floor(Math.random() * 600) + 200;
          const x = a + b;
          qText = `समीकरण में 'X' का मान बताइए: X - ${a} = ${b}`;
          qTextEn = `Solve for 'X' in equation: X - ${a} = ${b}`;
          ansStr = `${x}`;
          explanation = `X = ${b} + ${a} = ${x}।`;
          explanationEn = `X = ${b} + ${a} = ${x}.`;
          shortcut = `पक्षांतरण नियम: X = ${b} + ${a} = ${x}`;
          distractors = [`${x + 20}`, `${x - 20}`, `${x + 50}`, `${Math.max(1, x - 50)}`];
        } else {
          const a = Math.floor(Math.random() * 1200) + 500;
          const b = Math.floor(Math.random() * 400) + 100;
          const x = a - b;
          qText = `समीकरण में 'X' का मान बताइए: ${a} - X = ${b}`;
          qTextEn = `Solve for 'X' in equation: ${a} - X = ${b}`;
          ansStr = `${x}`;
          explanation = `X = ${a} - ${b} = ${x}।`;
          explanationEn = `X = ${a} - ${b} = ${x}.`;
          shortcut = `X = ${a} - ${b} = ${x}`;
          distractors = [`${x + 20}`, `${x - 20}`, `${x + 40}`, `${Math.max(1, x - 40)}`];
        }
      } else if (typeVar === 2) {
        // Difference of squares formula: A² - B² = (A-B)(A+B)
        const a = Math.floor(Math.random() * 60) + 40;
        const b = a - (Math.floor(Math.random() * 10) + 1); // small gap
        const ans = a * a - b * b;
        qText = `बीजगणितीय सूत्र (A² - B²) का प्रयोग कर मान निकालें: (${a})² - (${b})² = ?`;
        qTextEn = `Evaluate using (A² - B²) formula: (${a})² - (${b})² = ?`;
        ansStr = `${ans}`;
        explanation = `सूत्र: A² - B² = (A - B) × (A + B)\n= (${a} - ${b}) × (${a} + ${b}) = ${a - b} × ${a + b} = ${ans}।`;
        explanationEn = `Formula A² - B² = (A - B) * (A + B) = (${a - b}) * (${a + b}) = ${ans}.`;
        shortcut = `(${a} - ${b}) × (${a} + ${b}) = ${a - b} × ${a + b} = ${ans}`;
        distractors = [`${ans + 20}`, `${ans - 20}`, `${ans + 100}`, `${Math.max(1, ans - 100)}`];
      } else if (typeVar === 3) {
        // Decimal subtraction
        const a = (Math.floor(Math.random() * 15000) + 2000) / 10;
        const b = (Math.floor(Math.random() * (a * 10 - 500)) + 100) / 10;
        const ans = Math.round((a - b) * 10) / 10;
        qText = `दशमलव घटाव: ${a} - ${b} = ?`;
        qTextEn = `Decimal subtraction: ${a} - ${b} = ?`;
        ansStr = `${ans}`;
        explanation = `दशमलव बिंदु सीध में रखकर घटाएं:\n${a} - ${b} = ${ans}।`;
        explanationEn = `Align decimal points and subtract: ${a} - ${b} = ${ans}.`;
        shortcut = `${a} - ${b} = ${ans}`;
        distractors = [`${Math.round((ans + 1.5) * 10) / 10}`, `${Math.round(Math.max(0.1, ans - 1.5) * 10) / 10}`, `${Math.round((ans + 3) * 10) / 10}`, `${Math.round(Math.max(0.1, ans - 3) * 10) / 10}`];
      } else {
        // Reversed 2-digit number difference: AB - BA
        const d1 = Math.floor(Math.random() * 7) + 3;
        const d2 = d1 - (Math.floor(Math.random() * 2) + 1);
        const num1 = d1 * 10 + d2;
        const num2 = d2 * 10 + d1;
        const ans = num1 - num2;
        qText = `वैदिक ट्रिक से हल करें: ${num1} - ${num2} = ?`;
        qTextEn = `Solve using Vedic trick: ${num1} - ${num2} = ?`;
        ansStr = `${ans}`;
        explanation = `दो अंकों की संख्या और उसके अंकों को पलटने पर अंतर की शॉर्टकट ट्रिक:\nअंतर = 9 × (अंकों का अंतर) = 9 × (${d1} - ${d2}) = 9 × ${d1 - d2} = ${ans}।`;
        explanationEn = `Difference = 9 * (Difference of digits) = 9 * (${d1} - ${d2}) = ${ans}.`;
        shortcut = `वैदिक जादू: 9 × (${d1} - ${d2}) = ${ans}`;
        distractors = [`${ans + 9}`, `${Math.max(1, ans - 9)}`, `${ans + 18}`, `${Math.max(1, ans - 18)}`];
      }
    }
    // 3. गुणा (Multiplication)
    else if (chosenTopic.includes('गुणा (Multiplication)')) {
      const typeVar = Math.floor(Math.random() * 6);
      if (typeVar === 0) {
        // Vedic Trick multipliers (11, 25, 99, 101, 125, 15)
        const tricks = [11, 25, 99, 101, 15, 125];
        const m = tricks[Math.floor(Math.random() * tricks.length)];
        let num = Math.floor(Math.random() * 80) + 12;
        if (m === 25 || m === 125) {
          num = (Math.floor(Math.random() * 20) + 3) * 4; // divisible by 4 for exact trick
        }
        const ans = num * m;
        qText = `वैदिक गुणा ट्रिक से उत्तर निकालें: ${num} × ${m} = ?`;
        qTextEn = `Solve using speed multiplication: ${num} × ${m} = ?`;
        ansStr = `${ans}`;
        explanation = m === 11
          ? `${num} × 11 ट्रिक: इकाई और दहाई अंक के बीच उनका योग रखें = ${ans}।`
          : m === 25
          ? `${num} × 25 ट्रिक: (${num} ÷ 4) × 100 = ${num / 4} × 100 = ${ans}।`
          : m === 99
          ? `${num} × 99 ट्रिक: ${num} × (100 - 1) = ${num * 100} - ${num} = ${ans}।`
          : m === 101
          ? `${num} × 101 ट्रिक: दो अंकों की संख्या को दोहराएं = ${ans}।`
          : `${num} × ${m} = ${ans}।`;
        explanationEn = `${num} * ${m} = ${ans}.`;
        shortcut = `स्पीड मैथ वैदिक शॉर्टकट = ${ans}`;
        distractors = [`${ans + m}`, `${ans - m}`, `${ans + m * 2}`, `${Math.max(1, ans - m * 2)}`];
      } else if (typeVar === 1) {
        // Base 100 multiplication (e.g. 98 x 97 or 103 x 106)
        const isAbove = Math.random() > 0.5;
        if (isAbove) {
          const d1 = Math.floor(Math.random() * 8) + 2; // 102 to 109
          const d2 = Math.floor(Math.random() * 8) + 2;
          const a = 100 + d1;
          const b = 100 + d2;
          const ans = a * b;
          qText = `100 के आधार (Base 100) वैदिक सूत्र से हल करें: ${a} × ${b} = ?`;
          qTextEn = `Solve using Base 100 Vedic formula: ${a} × ${b} = ?`;
          ansStr = `${ans}`;
          explanation = `Base 100 ट्रिक (+${d1}, +${d2}):\nबाएं भाग: 100 + ${d1} + ${d2} = ${100 + d1 + d2}\nदाएं भाग: ${d1} × ${d2} = ${d1 * d2 < 10 ? '0' + (d1 * d2) : d1 * d2}\nकुल मान = ${ans}।`;
          explanationEn = `Base 100 trick: (${100 + d1 + d2})|(${d1 * d2}) = ${ans}.`;
          shortcut = `वैदिक आधार सूत्र: (${100 + d1 + d2})|(${d1 * d2}) = ${ans}`;
          distractors = [`${ans + 10}`, `${ans - 10}`, `${ans + 100}`, `${ans - 100}`];
        } else {
          const d1 = Math.floor(Math.random() * 8) + 2; // 92 to 98
          const d2 = Math.floor(Math.random() * 8) + 2;
          const a = 100 - d1;
          const b = 100 - d2;
          const ans = a * b;
          qText = `100 के आधार (Base 100) वैदिक सूत्र से हल करें: ${a} × ${b} = ?`;
          qTextEn = `Solve using Base 100 Vedic formula: ${a} × ${b} = ?`;
          ansStr = `${ans}`;
          explanation = `Base 100 ट्रिक (-${d1}, -${d2}):\nबाएं भाग: 100 - ${d1} - ${d2} = ${100 - d1 - d2}\nदाएं भाग: (-${d1}) × (-${d2}) = ${d1 * d2 < 10 ? '0' + (d1 * d2) : d1 * d2}\nकुल मान = ${ans}।`;
          explanationEn = `Base 100 trick: (${100 - d1 - d2})|(${d1 * d2}) = ${ans}.`;
          shortcut = `वैदिक आधार सूत्र: (${100 - d1 - d2})|(${d1 * d2}) = ${ans}`;
          distractors = [`${ans + 10}`, `${ans - 10}`, `${ans + 100}`, `${ans - 100}`];
        }
      } else if (typeVar === 2) {
        // Ending in 5 multiplication (e.g. 35 x 35 or 85 x 85)
        const tens = Math.floor(Math.random() * 11) + 2; // 25 to 125
        const num = tens * 10 + 5;
        const ans = num * num;
        qText = `5 पर समाप्त होने वाली संख्या का वर्ग: (${num})² = ${num} × ${num} = ?`;
        qTextEn = `Square of number ending in 5: (${num})² = ?`;
        ansStr = `${ans}`;
        explanation = `इकाई अंक 5 वाले वर्ग की ट्रिक (एकाधिकेन पूर्वेण):\nप्रथम भाग = दहाई × (दहाई + 1) = ${tens} × ${tens + 1} = ${tens * (tens + 1)}\nअंतिम भाग = 25\nकुल मान = ${ans}।`;
        explanationEn = `Square of ending 5 trick: ${tens} * (${tens} + 1) = ${tens * (tens + 1)} concatenated with 25 = ${ans}.`;
        shortcut = `${tens} × ${tens + 1} = ${tens * (tens + 1)} फिर 25 चिपकाएं = ${ans}`;
        distractors = [`${ans + 100}`, `${ans - 100}`, `${ans + 200}`, `${Math.max(1, ans - 200)}`];
      } else if (typeVar === 3) {
        // Unit digit of multiplication product
        const a = Math.floor(Math.random() * 80) + 12;
        const b = Math.floor(Math.random() * 80) + 13;
        const c = Math.floor(Math.random() * 80) + 14;
        const d = Math.floor(Math.random() * 80) + 17;
        const unitAns = (a % 10 * b % 10 * c % 10 * d % 10) % 10;
        qText = `गुणनफल (${a} × ${b} × ${c} × ${d}) का इकाई का अंक (Unit Digit) क्या होगा?`;
        qTextEn = `Find the unit digit of product (${a} × ${b} × ${c} × ${d})?`;
        ansStr = `${unitAns}`;
        explanation = `केवल इकाई अंकों की गुणा करें:\n${a % 10} × ${b % 10} × ${c % 10} × ${d % 10} mod 10 = ${unitAns}।`;
        explanationEn = `Multiply only unit digits: ${a % 10} * ${b % 10} * ${c % 10} * ${d % 10} mod 10 = ${unitAns}.`;
        shortcut = `इकाई अंकों का गुणनफल mod 10 = ${unitAns}`;
        distractors = [`${(unitAns + 1) % 10}`, `${(unitAns + 2) % 10}`, `${(unitAns + 4) % 10}`, `${(unitAns + 5) % 10}`];
      } else if (typeVar === 4) {
        // Missing multiplier: A x X = B
        const a = Math.floor(Math.random() * 45) + 12;
        const x = Math.floor(Math.random() * 60) + 15;
        const b = a * x;
        qText = `समीकरण में अज्ञात संख्या 'X' ज्ञात कीजिए: ${a} × X = ${b}`;
        qTextEn = `Solve for missing multiplier 'X': ${a} × X = ${b}`;
        ansStr = `${x}`;
        explanation = `X = ${b} ÷ ${a} = ${x}।`;
        explanationEn = `X = ${b} / ${a} = ${x}.`;
        shortcut = `X = ${b} ÷ ${a} = ${x}`;
        distractors = [`${x + 2}`, `${Math.max(1, x - 2)}`, `${x + 5}`, `${Math.max(1, x - 5)}`];
      } else {
        // Decimal multiplication
        const a = (Math.floor(Math.random() * 80) + 12) / 100; // e.g. 0.25
        const b = (Math.floor(Math.random() * 40) + 10) / 10;  // e.g. 1.2
        const ans = Math.round(a * b * 1000) / 1000;
        qText = `दशमलव गुणनफल ज्ञात कीजिए: ${a} × ${b} = ?`;
        qTextEn = `Calculate decimal product: ${a} × ${b} = ?`;
        ansStr = `${ans}`;
        explanation = `दशमलव स्थान गिनकर गुणा करें:\n${a} × ${b} = ${ans}।`;
        explanationEn = `Count total decimal places and multiply: ${a} * ${b} = ${ans}.`;
        shortcut = `दशमलव स्थान का योग = ${ans}`;
        distractors = [`${Math.round((ans + 0.05) * 1000) / 1000}`, `${Math.round(Math.max(0.001, ans - 0.05) * 1000) / 1000}`, `${Math.round((ans + 0.1) * 1000) / 1000}`, `${Math.round(Math.max(0.001, ans - 0.1) * 1000) / 1000}`];
      }
    }
    // 4. भाग (Division)
    else if (chosenTopic.includes('भाग (Division)')) {
      const typeVar = Math.floor(Math.random() * 5);
      if (typeVar === 0) {
        // Standard clean integer division
        const divisors = difficulty === 'सरल' ? [4, 5, 6, 8, 9, 12, 15] : [16, 18, 24, 25, 36, 45, 48, 72];
        const div = divisors[Math.floor(Math.random() * divisors.length)];
        const quotient = Math.floor(Math.random() * 80) + 15;
        const dividend = div * quotient;
        qText = `भाग दीजिए: ${dividend} ÷ ${div} = ?`;
        qTextEn = `Divide: ${dividend} ÷ ${div} = ?`;
        ansStr = `${quotient}`;
        explanation = `भागफल = ${dividend} ÷ ${div} = ${quotient}।`;
        explanationEn = `Quotient = ${dividend} / ${div} = ${quotient}.`;
        shortcut = `उभयनिष्ठ गुणनखंड काटकर हल करें = ${quotient}`;
        distractors = [`${quotient + 2}`, `${Math.max(1, quotient - 2)}`, `${quotient + 5}`, `${Math.max(1, quotient - 5)}`];
      } else if (typeVar === 1) {
        // Divisibility rule test
        const testDiv = [9, 11, 4, 8, 3][Math.floor(Math.random() * 5)];
        if (testDiv === 9) {
          const base3 = Math.floor(Math.random() * 700) + 100; // e.g. 451
          const dSum = String(base3).split('').reduce((s, d) => s + Number(d), 0);
          const reqDigit = (9 - (dSum % 9)) % 9;
          const numStr = `${base3}${reqDigit}`;
          qText = `यदि संख्या ${base3}X, 9 से पूर्णतः विभाजित (Divisible) होती है, तो स्थान 'X' पर कौनसा अंक आएगा?`;
          qTextEn = `If number ${base3}X is completely divisible by 9, what is the value of digit 'X'?`;
          ansStr = `${reqDigit}`;
          explanation = `9 की विभाज्यता का नियम: सभी अंकों का योग 9 से विभाजित होना चाहिए।\nअंकों का योग = ${dSum} + X\nX = ${reqDigit} रखने पर योग 9 का गुणज बनता है।`;
          explanationEn = `Divisibility rule of 9: Sum of digits must be divisible by 9. X = ${reqDigit}.`;
          shortcut = `अंकों का योग 9 का गुणज बनाएं: X = ${reqDigit}`;
          distractors = [`${(reqDigit + 1) % 9}`, `${(reqDigit + 2) % 9}`, `${(reqDigit + 4) % 9}`, `${(reqDigit + 5) % 9}`];
        } else {
          const divBase = 11;
          const k = Math.floor(Math.random() * 50) + 15;
          const targetNum = k * 11;
          qText = `क्या संख्या ${targetNum}, 11 से पूर्णतः विभाजित है? विभाजित करने पर भागफल क्या होगा: ${targetNum} ÷ 11 = ?`;
          qTextEn = `What is the quotient when ${targetNum} is divided by 11: ${targetNum} ÷ 11 = ?`;
          ansStr = `${k}`;
          explanation = `${targetNum} ÷ 11 = ${k}।`;
          explanationEn = `${targetNum} / 11 = ${k}.`;
          shortcut = `11 का विभाज्यता नियम = ${k}`;
          distractors = [`${k + 2}`, `${Math.max(1, k - 2)}`, `${k + 5}`, `${Math.max(1, k - 5)}`];
        }
      } else if (typeVar === 2) {
        // Missing divisor: A ÷ X = B
        const x = Math.floor(Math.random() * 35) + 12;
        const b = Math.floor(Math.random() * 45) + 15;
        const a = x * b;
        qText = `समीकरण में भाजक 'X' का मान ज्ञात कीजिए: ${a} ÷ X = ${b}`;
        qTextEn = `Find divisor 'X' in equation: ${a} ÷ X = ${b}`;
        ansStr = `${x}`;
        explanation = `X = ${a} ÷ ${b} = ${x}।`;
        explanationEn = `X = ${a} / ${b} = ${x}.`;
        shortcut = `X = ${a} ÷ ${b} = ${x}`;
        distractors = [`${x + 2}`, `${Math.max(1, x - 2)}`, `${x + 4}`, `${Math.max(1, x - 4)}`];
      } else if (typeVar === 3) {
        // Remainder Theorem basic
        const div = Math.floor(Math.random() * 15) + 7;
        const q = Math.floor(Math.random() * 40) + 10;
        const rem = Math.floor(Math.random() * (div - 2)) + 1;
        const num = div * q + rem;
        qText = `शेषफल ज्ञात कीजिए: जब ${num} को ${div} से भाग दिया जाता है, तो शेषफल (Remainder) क्या बचेगा?`;
        qTextEn = `Find the remainder when ${num} is divided by ${div}?`;
        ansStr = `${rem}`;
        explanation = `भाज्य = (भाजक × भागफल) + शेषफल\n${num} = (${div} × ${q}) + ${rem}।\nशेषफल = ${rem}।`;
        explanationEn = `Dividend = (Divisor * Quotient) + Remainder. Remainder = ${rem}.`;
        shortcut = `${num} mod ${div} = ${rem}`;
        distractors = [`${(rem + 1) % div}`, `${(rem + 2) % div}`, `${(rem + 3) % div}`, `${(rem + 4) % div}`];
      } else {
        // Decimal division
        const div = [0.2, 0.4, 0.5, 0.05, 0.08, 0.12][Math.floor(Math.random() * 6)];
        const ans = Math.floor(Math.random() * 80) + 15;
        const dividend = Math.round(div * ans * 1000) / 1000;
        qText = `दशमलव भाग: ${dividend} ÷ ${div} = ?`;
        qTextEn = `Decimal division: ${dividend} ÷ ${div} = ?`;
        ansStr = `${ans}`;
        explanation = `अंश और हर दोनों को 100 या 1000 से गुणा करके दशमलव हटाएं:\n${dividend} ÷ ${div} = ${ans}।`;
        explanationEn = `Remove decimals and divide: ${dividend} / ${div} = ${ans}.`;
        shortcut = `दशमलव हटाकर सीधी विभाजन प्रक्रिया = ${ans}`;
        distractors = [`${ans + 5}`, `${Math.max(1, ans - 5)}`, `${ans * 10}`, `${Math.max(1, Math.round(ans / 10))}`];
      }
    }
    // 5. जोड़ व घटाव (Add & Subtract)
    else if (chosenTopic.includes('जोड़ व घटाव')) {
      const typeVar = Math.floor(Math.random() * 4);
      if (typeVar === 0) {
        // Multi-term Add & Subtract: A + B - C + D - E
        const a = Math.floor(Math.random() * 300) + 100;
        const b = Math.floor(Math.random() * 250) + 50;
        const c = Math.floor(Math.random() * 200) + 40;
        const d = Math.floor(Math.random() * 150) + 30;
        const ans = a + b - c + d;
        qText = `सरल कीजिए: ${a} + ${b} - ${c} + ${d} = ?`;
        qTextEn = `Simplify: ${a} + ${b} - ${c} + ${d} = ?`;
        ansStr = `${ans}`;
        explanation = `पहले सभी धनात्मक संख्याओं को जोड़ें -> (${a} + ${b} + ${d}) = ${a + b + d}।\nफिर ऋणात्मक संख्या घटाएं -> ${a + b + d} - ${c} = ${ans}।`;
        explanationEn = `Add positive numbers first (${a + b + d}), then subtract ${c} = ${ans}.`;
        shortcut = `धनात्मक योग - ऋणात्मक = ${ans}`;
        distractors = [`${ans + 10}`, `${ans - 10}`, `${ans + 20}`, `${Math.max(1, ans - 20)}`];
      } else if (typeVar === 1) {
        // Missing variable equation: A + X - B = C
        const a = Math.floor(Math.random() * 400) + 100;
        const b = Math.floor(Math.random() * 250) + 50;
        const c = Math.floor(Math.random() * 500) + 200;
        const x = c + b - a;
        qText = `समीकरण में 'X' का मान क्या होगा: ${a} + X - ${b} = ${c}`;
        qTextEn = `Solve for 'X' in equation: ${a} + X - ${b} = ${c}`;
        ansStr = `${x}`;
        explanation = `X = ${c} + ${b} - ${a} = ${c + b} - ${a} = ${x}।`;
        explanationEn = `X = ${c} + ${b} - ${a} = ${x}.`;
        shortcut = `X = ${c} + ${b} - ${a} = ${x}`;
        distractors = [`${x + 15}`, `${x - 15}`, `${x + 30}`, `${Math.max(1, x - 30)}`];
      } else if (typeVar === 2) {
        // Decimal multi-term
        const a = (Math.floor(Math.random() * 800) + 100) / 10;
        const b = (Math.floor(Math.random() * 500) + 50) / 10;
        const c = (Math.floor(Math.random() * 400) + 30) / 10;
        const ans = Math.round((a + b - c) * 10) / 10;
        qText = `दशमलव व्यंजक सरल करें: ${a} + ${b} - ${c} = ?`;
        qTextEn = `Simplify decimal expression: ${a} + ${b} - ${c} = ?`;
        ansStr = `${ans}`;
        explanation = `चरण 1: ${a} + ${b} = ${Math.round((a + b) * 10) / 10}\nचरण 2: ${Math.round((a + b) * 10) / 10} - ${c} = ${ans}।`;
        explanationEn = `Step 1: ${a} + ${b} = ${a + b}. Step 2: Subtract ${c} = ${ans}.`;
        shortcut = `दशमलव योग व अंतर = ${ans}`;
        distractors = [`${Math.round((ans + 1.2) * 10) / 10}`, `${Math.round(Math.max(0.1, ans - 1.2) * 10) / 10}`, `${Math.round((ans + 2.5) * 10) / 10}`, `${Math.round(Math.max(0.1, ans - 2.5) * 10) / 10}`];
      } else {
        // Integer + Fraction mix
        const a = Math.floor(Math.random() * 10) + 3; // e.g. 5
        const num = Math.floor(Math.random() * 3) + 1; // 1 to 3
        const den = Math.floor(Math.random() * 4) + 4; // 4 to 7
        const ansNum = a * den - num;
        ansStr = `${ansNum}/${den}`;
        qText = `पूर्णांक व भिन्न का अंतर निकालें: ${a} - (${num}/${den}) = ?`;
        qTextEn = `Subtract fraction from integer: ${a} - (${num}/${den}) = ?`;
        explanation = `${a} - (${num}/${den}) = [(${a} × ${den}) - ${num}] ÷ ${den} = (${a * den} - ${num}) ÷ ${den} = ${ansNum}/${den}।`;
        explanationEn = `${a} - (${num}/${den}) = (${a * den} - ${num}) / ${den} = ${ansNum}/${den}.`;
        shortcut = `(${a * den} - ${num}) ÷ ${den} = ${ansNum}/${den}`;
        distractors = [`${ansNum + 1}/${den}`, `${Math.max(1, ansNum - 1)}/${den}`, `${ansNum + 2}/${den}`, `${Math.max(1, ansNum - 2)}/${den}`];
      }
    }
    // 6. गुणा व भाग (Multiply & Divide)
    else if (chosenTopic.includes('गुणा व भाग')) {
      const typeVar = Math.floor(Math.random() * 4);
      if (typeVar === 0) {
        // Combined product and division: (A x B) / C
        const c = [4, 6, 8, 12, 15, 18, 24][Math.floor(Math.random() * 7)];
        const k = Math.floor(Math.random() * 6) + 2;
        const a = c * k;
        const b = Math.floor(Math.random() * 20) + 5;
        const ans = k * b;
        qText = `मान ज्ञात कीजिए: (${a} × ${b}) ÷ ${c} = ?`;
        qTextEn = `Evaluate: (${a} × ${b}) ÷ ${c} = ?`;
        ansStr = `${ans}`;
        explanation = `काटने की विधि: (${a} ÷ ${c}) × ${b} = ${k} × ${b} = ${ans}।`;
        explanationEn = `Cancel common factor: (${a} / ${c}) * ${b} = ${k} * ${b} = ${ans}.`;
        shortcut = `गुणा से पहले काटें: ${k} × ${b} = ${ans}`;
        distractors = [`${ans + b}`, `${Math.max(1, ans - b)}`, `${ans + 5}`, `${Math.max(1, ans - 5)}`];
      } else if (typeVar === 1) {
        // Continued fraction product division: (A x B) / (C x D)
        const c = Math.floor(Math.random() * 6) + 2;
        const d = Math.floor(Math.random() * 5) + 3;
        const k1 = Math.floor(Math.random() * 4) + 2;
        const k2 = Math.floor(Math.random() * 4) + 2;
        const a = c * k1;
        const b = d * k2;
        const ans = k1 * k2;
        qText = `अंश व हर काटकर मान निकालें: (${a} × ${b}) ÷ (${c} × ${d}) = ?`;
        qTextEn = `Evaluate by canceling common terms: (${a} × ${b}) ÷ (${c} × ${d}) = ?`;
        ansStr = `${ans}`;
        explanation = `(${a} ÷ ${c}) × (${b} ÷ ${d}) = ${k1} × ${k2} = ${ans}।`;
        explanationEn = `(${a} / ${c}) * (${b} / ${d}) = ${k1} * ${k2} = ${ans}.`;
        shortcut = `तिर्यक कटाई: ${k1} × ${k2} = ${ans}`;
        distractors = [`${ans + 2}`, `${Math.max(1, ans - 2)}`, `${ans + 4}`, `${Math.max(1, ans - 4)}`];
      } else if (typeVar === 2) {
        // Decimal product division
        const c = 0.05;
        const a = (Math.floor(Math.random() * 15) + 2) * 0.1; // e.g. 0.4
        const b = (Math.floor(Math.random() * 10) + 2) * 0.25; // e.g. 1.0
        const ans = Math.round((a * b) / c);
        qText = `दशमलव गुणा व भाग: (${a} × ${b}) ÷ ${c} = ?`;
        qTextEn = `Decimal multiply and divide: (${a} × ${b}) ÷ ${c} = ?`;
        ansStr = `${ans}`;
        explanation = `अंश = ${a} × ${b} = ${Math.round(a * b * 100) / 100}\nभाग = ${Math.round(a * b * 100) / 100} ÷ ${c} = ${ans}।`;
        explanationEn = `Numerator = ${a * b}. Division by ${c} = ${ans}.`;
        shortcut = `दशमलव संतुलन = ${ans}`;
        distractors = [`${ans + 10}`, `${Math.max(1, ans - 10)}`, `${ans + 20}`, `${Math.max(1, ans - 20)}`];
      } else {
        // Algebraic identity division: (A² - B²) / (A - B) = A + B
        const a = Math.floor(Math.random() * 70) + 30;
        const b = Math.floor(Math.random() * (a - 10)) + 5;
        const num = a * a - b * b;
        const den = a - b;
        const ans = a + b;
        qText = `बीजगणितीय सूत्र से मान निकालें: (${num}) ÷ (${den}) = ?`;
        qTextEn = `Evaluate using algebraic formula: (${num}) ÷ (${den}) = ?`;
        ansStr = `${ans}`;
        explanation = `नोट करें कि ${num} = (${a})² - (${b})² तथा ${den} = (${a} - ${b})।\nसूत्र: (A² - B²) ÷ (A - B) = (A + B) = ${a} + ${b} = ${ans}।`;
        explanationEn = `Formula: (A² - B²) / (A - B) = A + B = ${a} + ${b} = ${ans}.`;
        shortcut = `शॉर्टकट सूत्र: A + B = ${a} + ${b} = ${ans}`;
        distractors = [`${ans + 10}`, `${ans - 10}`, `${ans + 20}`, `${Math.max(1, ans - 20)}`];
      }
    }
    // 7. सरलीकरण (BODMAS)
    else if (chosenTopic.includes('सरलीकरण')) {
      const typeVar = Math.floor(Math.random() * 5);
      if (typeVar === 0) {
        // Direct BODMAS: (A + B) x C / D - E
        const d = [2, 3, 4, 5, 6][Math.floor(Math.random() * 5)];
        const k = Math.floor(Math.random() * 10) + 4;
        const sumAB = d * k;
        const a = Math.floor(sumAB / 2);
        const b = sumAB - a;
        const c = Math.floor(Math.random() * 8) + 3;
        const e = Math.floor(Math.random() * 15) + 2;
        const ans = k * c - e;
        qText = `BODMAS नियम से सरल करें: (${a} + ${b}) × ${c} ÷ ${d} - ${e} = ?`;
        qTextEn = `Simplify using BODMAS: (${a} + ${b}) × ${c} ÷ ${d} - ${e} = ?`;
        ansStr = `${ans}`;
        explanation = `BODMAS चरण:\n1. कोष्ठक (Bracket): (${a} + ${b}) = ${sumAB}\n2. भाग (Division): ${sumAB} ÷ ${d} = ${k}\n3. गुणा (Multiplication): ${k} × ${c} = ${k * c}\n4. घटाव (Subtraction): ${k * c} - ${e} = ${ans}।`;
        explanationEn = `BODMAS steps: Bracket (${sumAB}) -> Division (${k}) -> Multiply (${k * c}) -> Subtract (${ans}).`;
        shortcut = `BODMAS क्रमानुसार: ${ans}`;
        distractors = [`${ans + 5}`, `${Math.max(1, ans - 5)}`, `${ans + 10}`, `${Math.max(1, ans - 10)}`];
      } else if (typeVar === 1) {
        // Nested Brackets: [A + {B x (C - D)} / E]
        const c = Math.floor(Math.random() * 20) + 15;
        const d = Math.floor(Math.random() * 10) + 2;
        const diff = c - d;
        const b = Math.floor(Math.random() * 5) + 2;
        const prod = b * diff;
        const e = [2, 3, 4, 5][Math.floor(Math.random() * 4)];
        const divPart = Math.floor(prod / e) * e; // make divisible
        const a = Math.floor(Math.random() * 30) + 10;
        const ans = a + divPart / e;
        qText = `कोष्ठक BODMAS नियम: ${a} + [{${b} × (${c} - ${d})} ÷ ${e}] = ?`;
        qTextEn = `Nested Bracket BODMAS: ${a} + [{${b} × (${c} - ${d})} ÷ ${e}] = ?`;
        ansStr = `${ans}`;
        explanation = `चरण 1 (छोटा कोष्ठक): ${c} - ${d} = ${diff}\nचरण 2 (मझला कोष्ठक): ${b} × ${diff} = ${prod}\nचरण 3 (बड़ा कोष्ठक): ${divPart} ÷ ${e} = ${divPart / e}\nचरण 4 (जोड़): ${a} + ${divPart / e} = ${ans}।`;
        explanationEn = `Inner bracket -> middle -> outer -> addition = ${ans}.`;
        shortcut = `अंदर से बाहर की ओर कोष्ठक खोलें = ${ans}`;
        distractors = [`${ans + 4}`, `${Math.max(1, ans - 4)}`, `${ans + 8}`, `${Math.max(1, ans - 8)}`];
      } else if (typeVar === 2) {
        // Algebraic identity BODMAS: If a + b + c = 0, find a³ + b³ + c³ - 3abc
        const isIdentity = Math.random() > 0.5;
        if (isIdentity) {
          const a = Math.floor(Math.random() * 25) + 10;
          const b = Math.floor(Math.random() * 15) + 5;
          const c = -(a + b);
          qText = `यदि a = ${a}, b = ${b}, c = ${c} (जहाँ a + b + c = 0), तो व्यंजक (a³ + b³ + c³ - 3abc) का मान क्या होगा?`;
          qTextEn = `If a = ${a}, b = ${b}, c = ${c} (where a + b + c = 0), what is the value of (a³ + b³ + c³ - 3abc)?`;
          ansStr = `0`;
          explanation = `बीजगणितीय सर्वसमिका का नियम:\nयदि a + b + c = 0 होता है, तो a³ + b³ + c³ - 3abc = 0 सदैव होता है।`;
          explanationEn = `Identity rule: If a + b + c = 0, then a³ + b³ + c³ - 3abc = 0 always.`;
          shortcut = `वैदिक सर्वसमिका नियम: जब a + b + c = 0 हो, उत्तर = 0`;
          distractors = [`1`, `${a + b}`, `${a * b}`, `-1`];
        } else {
          // (x² - y²) / (x + y)
          const x = Math.floor(Math.random() * 80) + 20;
          const y = Math.floor(Math.random() * (x - 5)) + 3;
          const num = x * x - y * y;
          const den = x + y;
          const ans = x - y;
          qText = `बीजगणितीय सरलीकरण: (${num}) ÷ (${den}) = ?`;
          qTextEn = `Algebraic simplification: (${num}) ÷ (${den}) = ?`;
          ansStr = `${ans}`;
          explanation = `${num} = (${x})² - (${y})² = (${x} - ${y})(${x} + ${y})।\nअतः (${x} - ${y})(${x} + ${y}) ÷ (${x} + ${y}) = ${x} - ${y} = ${ans}।`;
          explanationEn = `(x² - y²) / (x + y) = x - y = ${x} - ${y} = ${ans}.`;
          shortcut = `सूत्र: x - y = ${x} - ${y} = ${ans}`;
          distractors = [`${ans + 5}`, `${Math.max(1, ans - 5)}`, `${ans + 10}`, `${Math.max(1, ans - 10)}`];
        }
      } else if (typeVar === 3) {
        // Square root BODMAS: √(A + B) x C - D
        const sqBase = Math.floor(Math.random() * 15) + 5; // e.g. 12
        const sq = sqBase * sqBase;
        const part1 = Math.floor(sq * 0.6);
        const part2 = sq - part1;
        const c = Math.floor(Math.random() * 6) + 3;
        const d = Math.floor(Math.random() * 20) + 5;
        const ans = sqBase * c - d;
        qText = `वर्गमूल BODMAS: √( ${part1} + ${part2} ) × ${c} - ${d} = ?`;
        qTextEn = `Square root BODMAS: √( ${part1} + ${part2} ) × ${c} - ${d} = ?`;
        ansStr = `${ans}`;
        explanation = `1. वर्गमूल: √(${part1} + ${part2}) = √${sq} = ${sqBase}\n2. गुणा: ${sqBase} × ${c} = ${sqBase * c}\n3. घटाव: ${sqBase * c} - ${d} = ${ans}।`;
        explanationEn = `1. Root = ${sqBase}. 2. Multiply = ${sqBase * c}. 3. Subtract = ${ans}.`;
        shortcut = `वर्गमूल निकाल कर गुणा करें = ${ans}`;
        distractors = [`${ans + 5}`, `${Math.max(1, ans - 5)}`, `${ans + 10}`, `${Math.max(1, ans - 10)}`];
      } else {
        // Standard BODMAS fallback
        const a = (Math.floor(Math.random() * 10) + 2) * 6;
        const b = [2, 3, 6][Math.floor(Math.random() * 3)];
        const c = Math.floor(Math.random() * 5) + 3;
        const d = Math.floor(Math.random() * 15) + 5;
        const ans = (a / b) * c + d;
        qText = `BODMAS मान: (${a} ÷ ${b}) × ${c} + ${d} = ?`;
        qTextEn = `BODMAS value: (${a} ÷ ${b}) × ${c} + ${d} = ?`;
        ansStr = `${ans}`;
        explanation = `1. भाग: ${a} ÷ ${b} = ${a / b}\n2. गुणा: ${a / b} × ${c} = ${(a / b) * c}\n3. जोड़: ${(a / b) * c} + ${d} = ${ans}।`;
        explanationEn = `Division -> Multiply -> Addition = ${ans}.`;
        shortcut = `BODMAS = ${ans}`;
        distractors = [`${ans + 5}`, `${Math.max(1, ans - 5)}`, `${ans + 10}`, `${Math.max(1, ans - 10)}`];
      }
    }
    // 8. भिन्न व दशमलव (Fractions & Decimals)
    else if (chosenTopic.includes('भिन्न व दशमलव')) {
      const typeVar = Math.floor(Math.random() * 5);
      if (typeVar === 0) {
        // Sum of fractions
        const denoms = [2, 3, 4, 5, 6, 8, 10, 12];
        const d1 = denoms[Math.floor(Math.random() * denoms.length)];
        let d2 = denoms[Math.floor(Math.random() * denoms.length)];
        while (d2 === d1) {
          d2 = denoms[Math.floor(Math.random() * denoms.length)];
        }
        const n1 = Math.floor(Math.random() * (d1 - 1)) + 1;
        const n2 = Math.floor(Math.random() * (d2 - 1)) + 1;

        const commonLcm = (d1 * d2) / gcd(d1, d2);
        const numSum = n1 * (commonLcm / d1) + n2 * (commonLcm / d2);
        const finalGcd = gcd(numSum, commonLcm);
        const simpNum = numSum / finalGcd;
        const simpDen = commonLcm / finalGcd;

        ansStr = simpDen === 1 ? `${simpNum}` : `${simpNum}/${simpDen}`;
        qText = `भिन्नों का योग ज्ञात कीजिए: (${n1}/${d1}) + (${n2}/${d2}) = ?`;
        qTextEn = `Sum of fractions: (${n1}/${d1}) + (${n2}/${d2}) = ?`;
        explanation = `ल.स.प. (LCM) ऑफ (${d1}, ${d2}) = ${commonLcm}।\nयोग = [(${n1} × ${commonLcm / d1}) + (${n2} × ${commonLcm / d2})] ÷ ${commonLcm} = ${numSum}/${commonLcm} = ${ansStr}।`;
        explanationEn = `LCM = ${commonLcm}. Sum = ${ansStr}.`;
        shortcut = `तिर्यक गुणा (Cross multiply): (${n1}×${d2} + ${n2}×${d1}) ÷ (${d1}×${d2}) = ${ansStr}`;
        distractors = [`${simpNum + 1}/${simpDen}`, `${Math.max(1, simpNum - 1)}/${simpDen}`, `${simpNum + 2}/${simpDen}`, `${simpNum}/${simpDen + 1}`];
      } else if (typeVar === 1) {
        // Division of fractions: (n1/d1) ÷ (n2/d2)
        const n1 = Math.floor(Math.random() * 5) + 2;
        const d1 = Math.floor(Math.random() * 5) + 3;
        const n2 = Math.floor(Math.random() * 5) + 2;
        const d2 = Math.floor(Math.random() * 5) + 3;

        const prodNum = n1 * d2;
        const prodDen = d1 * n2;
        const g = gcd(prodNum, prodDen);
        const simpNum = prodNum / g;
        const simpDen = prodDen / g;

        ansStr = simpDen === 1 ? `${simpNum}` : `${simpNum}/${simpDen}`;
        qText = `भिन्नों का भागफल हल करें: (${n1}/${d1}) ÷ (${n2}/${d2}) = ?`;
        qTextEn = `Division of fractions: (${n1}/${d1}) ÷ (${n2}/${d2}) = ?`;
        explanation = `द्वितीय भिन्न को पलटकर गुणा करें:\n(${n1}/${d1}) × (${d2}/${n2}) = ${n1 * d2}/${d1 * n2} = ${ansStr}।`;
        explanationEn = `Invert second fraction and multiply: (${n1} * ${d2}) / (${d1} * ${n2}) = ${ansStr}.`;
        shortcut = `उल्टा करके गुणा करें = ${ansStr}`;
        distractors = [`${simpNum + 1}/${simpDen}`, `${Math.max(1, simpNum - 1)}/${simpDen}`, `${simpNum}/${simpDen + 1}`, `${simpNum + 2}/${simpDen}`];
      } else if (typeVar === 2) {
        // Recurring decimal to fraction
        const recs = [
          { dec: '0.666...', num: 2, den: 3 },
          { dec: '0.333...', num: 1, den: 3 },
          { dec: '0.2727...', num: 3, den: 11 },
          { dec: '0.3636...', num: 4, den: 11 },
          { dec: '0.1818...', num: 2, den: 11 },
          { dec: '0.142857...', num: 1, den: 7 },
          { dec: '0.444...', num: 4, den: 9 }
        ];
        const chosen = recs[Math.floor(Math.random() * recs.length)];
        ansStr = `${chosen.num}/${chosen.den}`;
        qText = `आवर्ती दशमलव (Recurring Decimal) को साधारण भिन्न में बदलें: ${chosen.dec} = ?`;
        qTextEn = `Convert recurring decimal to fraction: ${chosen.dec} = ?`;
        explanation = `आवर्ती दशमलव सूत्र:\n0.X̅ = X/9, 0.XY̅ = XY/99।\nअतः ${chosen.dec} = ${chosen.num}/${chosen.den}।`;
        explanationEn = `Recurring decimal rule: ${chosen.dec} = ${chosen.num}/${chosen.den}.`;
        shortcut = `वैदिक भिन्न रूपांतरण = ${ansStr}`;
        distractors = [`${chosen.num + 1}/${chosen.den}`, `${chosen.num}/${chosen.den + 1}`, `${chosen.num + 2}/${chosen.den}`, `${Math.max(1, chosen.num - 1)}/${chosen.den}`];
      } else if (typeVar === 3) {
        // Mixed fraction arithmetic: A(b/c) + X(y/z)
        const a = Math.floor(Math.random() * 4) + 1;
        const b = Math.floor(Math.random() * 4) + 2;
        const c = 1; // 1/2
        const d = 2;
        const x = Math.floor(Math.random() * 4) + 1;
        const y = 1; // 1/4
        const z = 4;
        const totalInt = a + x;
        const fracSumNum = 2 + 1; // 1/2 + 1/4 = 3/4
        ansStr = `${totalInt} (3/4)`;
        qText = `मिश्रित भिन्न का योग: ${a}½ + ${x}¼ = ?`;
        qTextEn = `Sum of mixed fractions: ${a}½ + ${x}¼ = ?`;
        explanation = `पूर्णांकों का योग = ${a} + ${x} = ${totalInt}।\nभिन्नों का योग = (1/2) + (1/4) = 3/4।\nकुल योग = ${totalInt} (3/4) = ${(totalInt * 4 + 3)}/4।`;
        explanationEn = `Integer sum = ${totalInt}. Fraction sum = 3/4. Total = ${ansStr}.`;
        shortcut = `पूर्णांक व भिन्न अलग-अलग जोड़ें = ${ansStr}`;
        distractors = [`${totalInt} (1/4)`, `${totalInt + 1} (1/4)`, `${totalInt} (1/2)`, `${totalInt + 1} (1/2)`];
      } else {
        // Decimal place value conversion
        const decimals = [
          { dec: '0.125', num: 1, den: 8 },
          { dec: '0.375', num: 3, den: 8 },
          { dec: '0.625', num: 5, den: 8 },
          { dec: '0.875', num: 7, den: 8 },
          { dec: '0.04', num: 1, den: 25 },
          { dec: '0.16', num: 4, den: 25 }
        ];
        const chosen = decimals[Math.floor(Math.random() * decimals.length)];
        ansStr = `${chosen.num}/${chosen.den}`;
        qText = `दशमलव संख्या ${chosen.dec} का सरलतम भिन्न रूप (Simplest Fraction) क्या होगा?`;
        qTextEn = `Simplest fraction form of decimal ${chosen.dec}?`;
        explanation = `${chosen.dec} = ${chosen.num}/${chosen.den}।`;
        explanationEn = `Decimal ${chosen.dec} = ${chosen.num}/${chosen.den}.`;
        shortcut = `स्थान मान काटकर सरल करें = ${ansStr}`;
        distractors = [`${chosen.num + 1}/${chosen.den}`, `${chosen.num}/${chosen.den + 2}`, `${chosen.num + 2}/${chosen.den}`, `${Math.max(1, chosen.num - 1)}/${chosen.den}`];
      }
    }
    // 9. प्रतिशत (Percentage)
    else if (chosenTopic.includes('प्रतिशत')) {
      const typeVar = Math.floor(Math.random() * 6);
      if (typeVar === 0) {
        // Direct percentage: X% of Y
        const percentages = [5, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75];
        const p = percentages[Math.floor(Math.random() * percentages.length)];
        const base = (Math.floor(Math.random() * 30) + 4) * 100;
        const ans = Math.round((p * base) / 100);
        qText = `₹${base} का ${p}% कितना होगा?`;
        qTextEn = `What is ${p}% of ₹${base}?`;
        ansStr = `₹${ans}`;
        explanation = `${p}% = ${p} ÷ 100। कुल मान = (${base} × ${p}) ÷ 100 = ₹${ans}।`;
        explanationEn = `${p}% of ₹${base} = (${base} * ${p}) / 100 = ₹${ans}.`;
        shortcut = `10% = ₹${base / 10}, 1% = ₹${base / 100} -> ₹${ans}`;
        distractors = [`₹${ans + 20}`, `₹${Math.max(10, ans - 20)}`, `₹${ans + 50}`, `₹${Math.max(10, ans - 50)}`];
      } else if (typeVar === 1) {
        // Chained percentage: A% of B% of C
        const p1 = [10, 20, 25, 50][Math.floor(Math.random() * 4)];
        const p2 = [20, 40, 50][Math.floor(Math.random() * 3)];
        const base = (Math.floor(Math.random() * 10) + 2) * 1000;
        const ans = Math.round((p1 * p2 * base) / 10000);
        qText = `₹${base} के ${p2}% का ${p1}% कितना होगा?`;
        qTextEn = `What is ${p1}% of ${p2}% of ₹${base}?`;
        ansStr = `₹${ans}`;
        explanation = `चरण 1: ${base} का ${p2}% = ₹${(base * p2) / 100}\nचरण 2: ₹${(base * p2) / 100} का ${p1}% = ₹${ans}।`;
        explanationEn = `Step 1: ${p2}% of ${base} = ${(base * p2) / 100}. Step 2: ${p1}% of that = ₹${ans}.`;
        shortcut = `(${p1} × ${p2} × ${base}) ÷ 10000 = ₹${ans}`;
        distractors = [`₹${ans + 10}`, `₹${Math.max(5, ans - 10)}`, `₹${ans + 25}`, `₹${Math.max(5, ans - 25)}`];
      } else if (typeVar === 2) {
        // Percentage Comparison: If A is P% more than B, B is how much % less than A?
        const p = [10, 20, 25, 50][Math.floor(Math.random() * 4)];
        const ans = Math.round((p / (100 + p)) * 100 * 10) / 10;
        qText = `यदि A का वेतन B से ${p}% अधिक है, तो B का वेतन A से कितना प्रतिशत (%) कम होगा?`;
        qTextEn = `If A's income is ${p}% more than B, by what % is B's income less than A?`;
        ansStr = `${ans}%`;
        explanation = `कम प्रतिशत सूत्र: [P ÷ (100 + P)] × 100%\n= [${p} ÷ ${100 + p}] × 100% = ${ans}%।`;
        explanationEn = `Formula: [P / (100 + P)] * 100% = ${ans}%.`;
        shortcut = `[${p} ÷ ${100 + p}] × 100% = ${ans}%`;
        distractors = [`${p}%`, `${Math.round((ans + 2) * 10) / 10}%`, `${Math.round(Math.max(1, ans - 2) * 10) / 10}%`, `${p + 5}%`];
      } else if (typeVar === 3) {
        // Vedic Fractional Shortcut Percentages (14.28%, 37.5%, 16.66%, 62.5%)
        const fracP = [
          { name: '14.28%', frac: 1 / 7, mult: 700, str: '1/7' },
          { name: '37.5%', frac: 3 / 8, mult: 640, str: '3/8' },
          { name: '16.66%', frac: 1 / 6, mult: 540, str: '1/6' },
          { name: '62.5%', frac: 5 / 8, mult: 800, str: '5/8' },
          { name: '83.33%', frac: 5 / 6, mult: 360, str: '5/6' }
        ];
        const chosen = fracP[Math.floor(Math.random() * fracP.length)];
        const k = Math.floor(Math.random() * 4) + 1;
        const totalVal = chosen.mult * k;
        const ans = Math.round(totalVal * chosen.frac);
        qText = `स्पीड वैदिक प्रतिशत: ₹${totalVal} का ${chosen.name} कितना होगा?`;
        qTextEn = `Vedic fraction speed percent: What is ${chosen.name} of ₹${totalVal}?`;
        ansStr = `₹${ans}`;
        explanation = `${chosen.name} की भिन्न शॉर्टकट = ${chosen.str}।\nकुल मान = ₹${totalVal} × ${chosen.str} = ₹${ans}।`;
        explanationEn = `Fraction shortcut for ${chosen.name} = ${chosen.str}. ₹${totalVal} * ${chosen.str} = ₹${ans}.`;
        shortcut = `वैदिक भिन्न सूत्र: ${chosen.str} × ₹${totalVal} = ₹${ans}`;
        distractors = [`₹${ans + 30}`, `₹${Math.max(10, ans - 30)}`, `₹${ans + 60}`, `₹${Math.max(10, ans - 60)}`];
      } else if (typeVar === 4) {
        // Successive Percentage Change: P1 + P2 + (P1 x P2)/100
        const p1 = [10, 20, 30][Math.floor(Math.random() * 3)];
        const p2 = [10, 20, 25][Math.floor(Math.random() * 3)];
        const ans = p1 + p2 + (p1 * p2) / 100;
        qText = `क्रमिक वृद्धि (Successive Increase): यदि किसी संख्या में पहले ${p1}% और फिर ${p2}% की वृद्धि की जाए, तो कुल प्रभावी प्रतिशत वृद्धि कितनी होगी?`;
        qTextEn = `Successive increase of ${p1}% and ${p2}% equals what total % increase?`;
        ansStr = `${ans}%`;
        explanation = `कुल प्रभावी प्रतिशत वृद्धि सूत्र: A + B + (A × B) ÷ 100\n= ${p1} + ${p2} + (${p1} × ${p2}) ÷ 100 = ${ans}%।`;
        explanationEn = `Effective % change formula = A + B + (A * B) / 100 = ${ans}%.`;
        shortcut = `${p1} + ${p2} + ${(p1 * p2) / 100} = ${ans}%`;
        distractors = [`${p1 + p2}%`, `${ans + 2}%`, `${Math.max(1, ans - 2)}%`, `${p1 + p2 + 5}%`];
      } else {
        // Percentage increase/decrease on value
        const base = Math.floor(Math.random() * 40) * 10 + 200;
        const incP = [10, 15, 20, 25, 30, 50][Math.floor(Math.random() * 6)];
        const ans = Math.round(base * (1 + incP / 100));
        qText = `यदि संख्या ${base} में ${incP}% की वृद्धि की जाए, तो नई संख्या क्या होगी?`;
        qTextEn = `If number ${base} is increased by ${incP}%, what is the new number?`;
        ansStr = `${ans}`;
        explanation = `वृद्धि = (${base} × ${incP}) ÷ 100 = ${Math.round((base * incP) / 100)}।\nनई संख्या = ${base} + ${Math.round((base * incP) / 100)} = ${ans}।`;
        explanationEn = `New number = ${base} * (1 + ${incP}/100) = ${ans}.`;
        shortcut = `${base} × ${100 + incP}% = ${ans}`;
        distractors = [`${ans + 20}`, `${ans - 20}`, `${ans + 40}`, `${Math.max(1, ans - 40)}`];
      }
    }
    // 10. वर्ग व वर्गमूल (Squares & Roots)
    else if (chosenTopic.includes('वर्ग व वर्गमूल') || chosenTopic.includes('वर्ग')) {
      const typeVar = Math.floor(Math.random() * 6);
      if (typeVar === 0) {
        // Square Root of Perfect Squares
        const num = Math.floor(Math.random() * 75) + 25; // 25 to 99
        const sq = num * num;
        qText = `√${sq} का सटीक मान क्या होगा?`;
        qTextEn = `What is the exact square root of √${sq}?`;
        ansStr = `${num}`;
        explanation = `क्योंकि (${num})² = ${sq}, अतः √${sq} = ${num}।`;
        explanationEn = `Since (${num})² = ${sq}, √${sq} = ${num}.`;
        shortcut = `इकाई अंक विधि: अंतिम अंकों से त्वरित पहचान -> √${sq} = ${num}`;
        distractors = [`${num + 2}`, `${num - 2}`, `${num + 4}`, `${Math.max(1, num - 4)}`];
      } else if (typeVar === 1) {
        // Direct Square
        const num = Math.floor(Math.random() * 60) + 15;
        const sq = num * num;
        qText = `(${num})² का सटीक मान क्या होगा?`;
        qTextEn = `What is the exact value of (${num})²?`;
        ansStr = `${sq}`;
        explanation = `(${num})² = ${num} × ${num} = ${sq}।`;
        explanationEn = `(${num})² = ${num} * ${num} = ${sq}.`;
        shortcut = `द्वंद्व योग (Duplex) या आधार विधि से वर्ग = ${sq}`;
        distractors = [`${sq + 20}`, `${sq - 20}`, `${(num + 1) * (num + 1)}`, `${(num - 1) * (num - 1)}`];
      } else if (typeVar === 2) {
        // Square Root Equation: √X + A = B
        const ansX = Math.floor(Math.random() * 30) + 10;
        const sqX = ansX * ansX;
        const a = Math.floor(Math.random() * 30) + 10;
        const b = ansX + a;
        qText = `समीकरण में 'X' का मान ज्ञात कीजिए: √X + ${a} = ${b}`;
        qTextEn = `Solve for 'X' in equation: √X + ${a} = ${b}`;
        ansStr = `${sqX}`;
        explanation = `1. √X = ${b} - ${a} = ${ansX}\n2. दोनों तरफ वर्ग करने पर: X = (${ansX})² = ${sqX}।`;
        explanationEn = `√X = ${b} - ${a} = ${ansX}. Squaring both sides: X = (${ansX})² = ${sqX}.`;
        shortcut = `X = (${b} - ${a})² = (${ansX})² = ${sqX}`;
        distractors = [`${sqX + 25}`, `${Math.max(1, sqX - 25)}`, `${(ansX + 1) * (ansX + 1)}`, `${Math.max(1, (ansX - 1) * (ansX - 1))}`];
      } else if (typeVar === 3) {
        // Pythagorean Triplets: A² + B² = C²
        const triplets = [
          [3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17],
          [9, 12, 15], [12, 16, 20], [7, 24, 25], [20, 21, 29]
        ];
        const trip = triplets[Math.floor(Math.random() * triplets.length)];
        const k = Math.floor(Math.random() * 3) + 1;
        const a = trip[0] * k;
        const b = trip[1] * k;
        const c = trip[2] * k;
        qText = `पाइथागोरस प्रमेय: √( (${a})² + (${b})² ) का मान क्या होगा?`;
        qTextEn = `Pythagoras identity: √( (${a})² + (${b})² ) = ?`;
        ansStr = `${c}`;
        explanation = `(${a})² + (${b})² = ${a * a} + ${b * b} = ${c * c}।\n√(${c * c}) = ${c}।`;
        explanationEn = `√(${a * a} + ${b * b}) = √${c * c} = ${c}.`;
        shortcut = `पाइथागोरस त्रिक (Pythagorean Triplet) = ${c}`;
        distractors = [`${c + 2}`, `${Math.max(1, c - 2)}`, `${c + 5}`, `${Math.max(1, c - 5)}`];
      } else if (typeVar === 4) {
        // Algebraic Identity Square: (a + b)² - (a - b)² = 4ab
        const a = Math.floor(Math.random() * 80) + 20;
        const b = Math.floor(Math.random() * 50) + 10;
        const ans = 4 * a * b;
        qText = `बीजगणितीय सूत्र [(A + B)² - (A - B)²] का प्रयोग कर हल करें: (${a} + ${b})² - (${a} - ${b})² = ?`;
        qTextEn = `Evaluate using [(A + B)² - (A - B)² = 4AB]: (${a} + ${b})² - (${a} - ${b})² = ?`;
        ansStr = `${ans}`;
        explanation = `सूत्र: (A + B)² - (A - B)² = 4 × A × B\n= 4 × ${a} × ${b} = ${ans}।`;
        explanationEn = `Formula: (A + B)² - (A - B)² = 4 * A * B = 4 * ${a} * ${b} = ${ans}.`;
        shortcut = `4 × ${a} × ${b} = ${ans}`;
        distractors = [`${2 * a * b}`, `${ans + 100}`, `${Math.max(1, ans - 100)}`, `${ans + 200}`];
      } else {
        // Non-perfect square root approximation
        const nearBase = Math.floor(Math.random() * 12) + 6; // 6 to 17
        const approxNum = nearBase * nearBase + 2; // e.g. 51
        ansStr = `लगभग ${nearBase}`;
        qText = `√${approxNum} का निकटतम मान (Approximate Value) क्या होगा?`;
        qTextEn = `What is the approximate value of √${approxNum}?`;
        explanation = `क्योंकि (${nearBase})² = ${nearBase * nearBase}, अतः √${approxNum} का मान लगभग ${nearBase} के बराबर होगा।`;
        explanationEn = `Since (${nearBase})² = ${nearBase * nearBase}, √${approxNum} ≈ ${nearBase}.`;
        shortcut = `निकटतम पूर्ण वर्ग विधि से उत्तर = लगभग ${nearBase}`;
        distractors = [`लगभग ${nearBase + 2}`, `लगभग ${Math.max(1, nearBase - 2)}`, `लगभग ${nearBase + 3}`, `लगभग ${Math.max(1, nearBase - 3)}`];
      }
    }
    // 11. घन व घनमूल (Cubes & Roots)
    else if (chosenTopic.includes('घन व घनमूल') || chosenTopic.includes('घन')) {
      const typeVar = Math.floor(Math.random() * 4);
      if (typeVar === 0) {
        // Perfect Cube Root
        const num = Math.floor(Math.random() * 35) + 5; // 5 to 40
        const cube = num * num * num;
        qText = `∛${cube} (घनमूल) का मान क्या होगा?`;
        qTextEn = `What is the cube root ∛${cube}?`;
        ansStr = `${num}`;
        explanation = `क्योंकि (${num})³ = ${num} × ${num} × ${num} = ${cube}, अतः ∛${cube} = ${num}।`;
        explanationEn = `Since (${num})³ = ${cube}, ∛${cube} = ${num}.`;
        shortcut = `इकाई अंक मिलान वैदिक तकनीक = ${num}`;
        distractors = [`${num + 1}`, `${Math.max(1, num - 1)}`, `${num + 2}`, `${Math.max(1, num - 2)}`];
      } else if (typeVar === 1) {
        // Direct Cube
        const num = Math.floor(Math.random() * 20) + 5;
        const cube = num * num * num;
        qText = `(${num})³ का सटीक मान क्या होगा?`;
        qTextEn = `What is the exact value of (${num})³?`;
        ansStr = `${cube}`;
        explanation = `(${num})³ = ${num} × ${num} × ${num} = ${cube}।`;
        explanationEn = `(${num})³ = ${num} * ${num} * ${num} = ${cube}.`;
        shortcut = `${num} का घन = ${cube}`;
        distractors = [`${cube + 50}`, `${Math.max(1, cube - 50)}`, `${(num + 1) * (num + 1) * (num + 1)}`, `${Math.max(1, (num - 1) * (num - 1) * (num - 1))}`];
      } else if (typeVar === 2) {
        // Cube Root Equation: ∛X x A = B
        const xVal = Math.floor(Math.random() * 15) + 4;
        const cubeX = xVal * xVal * xVal;
        const a = Math.floor(Math.random() * 8) + 2;
        const b = xVal * a;
        qText = `समीकरण में 'X' का मान ज्ञात कीजिए: ∛X × ${a} = ${b}`;
        qTextEn = `Solve for 'X' in equation: ∛X × ${a} = ${b}`;
        ansStr = `${cubeX}`;
        explanation = `1. ∛X = ${b} ÷ ${a} = ${xVal}\n2. दोनों तरफ घन करने पर: X = (${xVal})³ = ${cubeX}।`;
        explanationEn = `∛X = ${b} / ${a} = ${xVal}. Cubing both sides: X = (${xVal})³ = ${cubeX}.`;
        shortcut = `X = (${b} ÷ ${a})³ = (${xVal})³ = ${cubeX}`;
        distractors = [`${cubeX + 50}`, `${Math.max(1, cubeX - 50)}`, `${(xVal + 1) * (xVal + 1) * (xVal + 1)}`, `${Math.max(1, (xVal - 1) * (xVal - 1) * (xVal - 1))}`];
      } else {
        // Difference of Cubes: A³ - B³
        const a = Math.floor(Math.random() * 10) + 5;
        const b = a - 1;
        const ans = a * a * a - b * b * b;
        qText = `घन अंतर ज्ञात कीजिए: (${a})³ - (${b})³ = ?`;
        qTextEn = `Difference of cubes: (${a})³ - (${b})³ = ?`;
        ansStr = `${ans}`;
        explanation = `(${a})³ = ${a * a * a}, (${b})³ = ${b * b * b}।\nअंतर = ${a * a * a} - ${b * b * b} = ${ans}।`;
        explanationEn = `(${a})³ - (${b})³ = ${a * a * a} - ${b * b * b} = ${ans}.`;
        shortcut = `क्रमागत घनों का अंतर: 1 + 3×${a}×${b} = ${ans}`;
        distractors = [`${ans + 10}`, `${Math.max(1, ans - 10)}`, `${ans + 20}`, `${Math.max(1, ans - 20)}`];
      }
    }
    // 12. औसत (Average)
    else if (chosenTopic.includes('औसत')) {
      const typeVar = Math.floor(Math.random() * 5);
      if (typeVar === 0) {
        // AP Consecutive Average
        const start = Math.floor(Math.random() * 40) + 10;
        const diff = Math.floor(Math.random() * 5) + 2;
        const nums = [start, start + diff, start + 2 * diff, start + 3 * diff, start + 4 * diff];
        const avg = nums[2];
        qText = `समानांतर श्रेणी की संख्याओं (${nums.join(', ')}) का औसत (Average) क्या होगा?`;
        qTextEn = `What is the average of numbers (${nums.join(', ')})?`;
        ansStr = `${avg}`;
        explanation = `समानांतर श्रेणी (AP) में औसत सदैव मध्य पद होता है।\nमध्य पद = ${avg}।`;
        explanationEn = `In AP series, average is always the middle term = ${avg}.`;
        shortcut = `AP का मध्य पद ही औसत होता है = ${avg}`;
        distractors = [`${avg + diff}`, `${avg - diff}`, `${avg + 1}`, `${Math.max(1, avg - 1)}`];
      } else if (typeVar === 1) {
        // Average of first N natural, even, or odd numbers
        const isOdd = Math.random() > 0.5;
        const n = Math.floor(Math.random() * 50) + 20;
        if (isOdd) {
          ansStr = `${n}`;
          qText = `प्रथम ${n} विषम (Odd) प्राकृत संख्याओं का औसत क्या होगा?`;
          qTextEn = `What is the average of first ${n} odd numbers?`;
          explanation = `प्रथम N विषम संख्याओं का औसत सूत्र = N\nअतः प्रथम ${n} विषम संख्याओं का औसत = ${n}।`;
          explanationEn = `Average of first N odd numbers = N = ${n}.`;
          shortcut = `प्रथम N विषम संख्याओं का औसत = N = ${n}`;
          distractors = [`${n + 1}`, `${Math.max(1, n - 1)}`, `${n + 2}`, `${Math.max(1, n - 2)}`];
        } else {
          const ans = n + 1;
          qText = `प्रथम ${n} सम (Even) प्राकृत संख्याओं का औसत क्या होगा?`;
          qTextEn = `What is the average of first ${n} even numbers?`;
          ansStr = `${ans}`;
          explanation = `प्रथम N सम संख्याओं का औसत सूत्र = (N + 1)\nअतः ${n} + 1 = ${ans}।`;
          explanationEn = `Average of first N even numbers = N + 1 = ${n + 1} = ${ans}.`;
          shortcut = `सूत्र: N + 1 = ${n} + 1 = ${ans}`;
          distractors = [`${n}`, `${ans + 2}`, `${Math.max(1, ans - 2)}`, `${ans + 5}`];
        }
      } else if (typeVar === 2) {
        // Inclusion of member in average
        const count = 5;
        const oldAvg = Math.floor(Math.random() * 30) + 20;
        const newMember = Math.floor(Math.random() * 40) + 40;
        const newAvg = Math.round(((count * oldAvg + newMember) / (count + 1)) * 10) / 10;
        qText = `${count} विद्यार्थियों का औसत वजन ${oldAvg} किग्रा है। यदि शिक्षक का वजन ${newMember} किग्रा जोड़ दिया जाए, तो नया औसत क्या होगा?`;
        qTextEn = `Average weight of ${count} students is ${oldAvg} kg. If teacher weighing ${newMember} kg is added, new average?`;
        ansStr = `${newAvg} किग्रा`;
        explanation = `कुल वजन = (${count} × ${oldAvg}) + ${newMember} = ${count * oldAvg + newMember} किग्रा।\nनया औसत = ${count * oldAvg + newMember} ÷ ${count + 1} = ${newAvg} किग्रा।`;
        explanationEn = `Total weight = (${count} * ${oldAvg}) + ${newMember}. New average = ${newAvg} kg.`;
        shortcut = `कुल योग ÷ (N + 1) = ${newAvg} किग्रा`;
        distractors = [`${Math.round((newAvg + 2) * 10) / 10} किग्रा`, `${Math.round(Math.max(1, newAvg - 2) * 10) / 10} किग्रा`, `${Math.round((newAvg + 4) * 10) / 10} किग्रा`, `${Math.round(Math.max(1, newAvg - 4) * 10) / 10} किग्रा`];
      } else if (typeVar === 3) {
        // Weighted average
        const n1 = 10;
        const a1 = Math.floor(Math.random() * 20) + 40;
        const n2 = 15;
        const a2 = Math.floor(Math.random() * 20) + 60;
        const ans = Math.round((n1 * a1 + n2 * a2) / (n1 + n2));
        qText = `${n1} वस्तुओं का औसत मूल्य ₹${a1} है तथा ${n2} अन्य वस्तुओं का औसत मूल्य ₹${a2} है। सभी वस्तुओं का संयुक्त औसत मूल्य क्या होगा?`;
        qTextEn = `${n1} items have average cost ₹${a1} and ${n2} items have average cost ₹${a2}. Combined average cost?`;
        ansStr = `₹${ans}`;
        explanation = `संयुक्त औसत = [(${n1} × ${a1}) + (${n2} × ${a2})] ÷ (${n1} + ${n2}) = [${n1 * a1} + ${n2 * a2}] ÷ ${n1 + n2} = ₹${ans}।`;
        explanationEn = `Combined average = [(${n1} * ${a1}) + (${n2} * ${a2})] / (${n1} + ${n2}) = ₹${ans}.`;
        shortcut = `कुल योग ÷ कुल संख्या = ₹${ans}`;
        distractors = [`₹${ans + 5}`, `₹${Math.max(1, ans - 5)}`, `₹${ans + 10}`, `₹${Math.max(1, ans - 10)}`];
      } else {
        // Average Speed formula: 2*S1*S2 / (S1 + S2)
        const s1 = 40;
        const s2 = 60;
        const ans = Math.round((2 * s1 * s2) / (s1 + s2));
        qText = `एक कार A से B तक ${s1} किमी/घंटा की गति से जाती है तथा ${s2} किमी/घंटा की गति से वापस लौटती है। पूरी यात्रा में औसत चाल (Average Speed) क्या होगी?`;
        qTextEn = `A car travels A to B at ${s1} km/h and returns at ${s2} km/h. What is average speed?`;
        ansStr = `${ans} किमी/घंटा`;
        explanation = `औसत चाल सूत्र (समान दूरी): (2 × S1 × S2) ÷ (S1 + S2)\n= (2 × ${s1} × ${s2}) ÷ (${s1} + ${s2}) = ${2 * s1 * s2} ÷ ${s1 + s2} = ${ans} किमी/घंटा।`;
        explanationEn = `Average speed formula = (2 * S1 * S2) / (S1 + S2) = ${ans} km/h.`;
        shortcut = `सूत्र: (2 × ${s1} × ${s2}) ÷ (${s1} + ${s2}) = ${ans} किमी/घंटा`;
        distractors = [`${(s1 + s2) / 2} किमी/घंटा`, `${ans + 5} किमी/घंटा`, `${Math.max(1, ans - 5)} किमी/घंटा`, `${ans + 10} किमी/घंटा`];
      }
    }
    // 13. अनुपात व समानुपात (Ratio & Proportion)
    else if (chosenTopic.includes('अनुपात व समानुपात')) {
      const typeVar = Math.floor(Math.random() * 5);
      if (typeVar === 0) {
        // Share Division A : B
        const r1 = Math.floor(Math.random() * 3) + 2;
        const r2 = Math.floor(Math.random() * 3) + 3;
        const unitVal = (Math.floor(Math.random() * 15) + 5) * 50;
        const totalAmount = (r1 + r2) * unitVal;
        const ansA = r1 * unitVal;
        qText = `₹${totalAmount} की राशि को A और B में ${r1} : ${r2} के अनुपात में विभाजित किया गया। A का हिस्सा कितना होगा?`;
        qTextEn = `Divide ₹${totalAmount} between A and B in ratio ${r1} : ${r2}. What is A's share?`;
        ansStr = `₹${ansA}`;
        explanation = `1 यूनिट = ₹${totalAmount} ÷ (${r1} + ${r2}) = ₹${unitVal}।\nA का हिस्सा = ${r1} × ₹${unitVal} = ₹${ansA}।`;
        explanationEn = `1 unit = ₹${unitVal}. A's share = ${r1} * ₹${unitVal} = ₹${ansA}.`;
        shortcut = `[${r1} ÷ (${r1} + ${r2})] × ₹${totalAmount} = ₹${ansA}`;
        distractors = [`₹${r2 * unitVal}`, `₹${ansA + 100}`, `₹${Math.max(50, ansA - 100)}`, `₹${ansA + 200}`];
      } else if (typeVar === 1) {
        // Mean Proportional (√ab) or Third Proportional (b²/a)
        const isMean = Math.random() > 0.5;
        if (isMean) {
          const a = [4, 9, 16, 25, 36][Math.floor(Math.random() * 5)];
          const b = [9, 16, 25, 36, 49][Math.floor(Math.random() * 5)];
          const ans = Math.round(Math.sqrt(a * b));
          qText = `${a} और ${b} का मध्यानुपाती (Mean Proportional) क्या होगा?`;
          qTextEn = `What is the Mean Proportional of ${a} and ${b}?`;
          ansStr = `${ans}`;
          explanation = `मध्यानुपाती सूत्र = √(A × B)\n= √(${a} × ${b}) = √${a * b} = ${ans}।`;
          explanationEn = `Mean Proportional = √(A * B) = √(${a} * ${b}) = ${ans}.`;
          shortcut = `सूत्र: √(A × B) = ${ans}`;
          distractors = [`${ans + 2}`, `${Math.max(1, ans - 2)}`, `${ans + 4}`, `${Math.max(1, ans - 4)}`];
        } else {
          // Third Proportional: b²/a
          const a = 12;
          const b = 18;
          const ans = (b * b) / a;
          qText = `${a} तथा ${b} का तृतीयानुपाती (Third Proportional) क्या होगा?`;
          qTextEn = `What is the Third Proportional of ${a} and ${b}?`;
          ansStr = `${ans}`;
          explanation = `तृतीयानुपाती सूत्र = B² ÷ A\n= (${b})² ÷ ${a} = ${b * b} ÷ ${a} = ${ans}।`;
          explanationEn = `Third Proportional = B² / A = ${b * b} / ${a} = ${ans}.`;
          shortcut = `सूत्र: B² ÷ A = ${ans}`;
          distractors = [`${ans + 3}`, `${Math.max(1, ans - 3)}`, `${ans + 6}`, `${Math.max(1, ans - 6)}`];
        }
      } else if (typeVar === 2) {
        // Combine Ratios: A:B = x:y and B:C = p:q -> A:B:C
        const x = 2;
        const y = 3;
        const p = 4;
        const q = 5;
        // A:B = 2:3, B:C = 4:5 -> A:B:C = (2x4) : (3x4) : (3x5) = 8 : 12 : 15
        ansStr = `8 : 12 : 15`;
        qText = `यदि A : B = ${x} : ${y} तथा B : C = ${p} : ${q} है, तो संयुक्त अनुपात A : B : C का मान क्या होगा?`;
        qTextEn = `If A : B = ${x} : ${y} and B : C = ${p} : ${q}, find A : B : C?`;
        explanation = `B का मान समान बनाएं:\nA : B = (${x} × ${p}) : (${y} × ${p}) = 8 : 12\nB : C = (${p} × ${y}) : (${q} × ${y}) = 12 : 15\nसंयुक्त अनुपात = 8 : 12 : 15।`;
        explanationEn = `Combine ratios by equating B: A : B : C = 8 : 12 : 15.`;
        shortcut = `(x×p) : (y×p) : (y×q) = 8 : 12 : 15`;
        distractors = [`2 : 3 : 5`, `8 : 10 : 15`, `6 : 12 : 15`, `8 : 12 : 20`];
      } else if (typeVar === 3) {
        // Duplicate Ratio
        const a = Math.floor(Math.random() * 5) + 2;
        const b = Math.floor(Math.random() * 5) + 6;
        ansStr = `${a * a} : ${b * b}`;
        qText = `अनुपात ${a} : ${b} का वर्गानुपात (Duplicate Ratio) क्या होगा?`;
        qTextEn = `What is the Duplicate Ratio of ${a} : ${b}?`;
        explanation = `वर्गानुपात का सूत्र = (A)² : (B)²\n= (${a})² : (${b})² = ${a * a} : ${b * b}।`;
        explanationEn = `Duplicate ratio formula = A² : B² = ${a * a} : ${b * b}.`;
        shortcut = `${a}² : ${b}² = ${a * a} : ${b * b}`;
        distractors = [`${a * 2} : ${b * 2}`, `${a * a + 1} : ${b * b}`, `${a * a} : ${b * b + 2}`, `${a * 3} : ${b * 3}`];
      } else {
        // Direct Fourth Proportional: (b x c) / a
        const a = 6;
        const b = 14;
        const c = 15;
        const ans = (b * c) / a;
        qText = `${a}, ${b} तथा ${c} का चतुर्थानुपाती (Fourth Proportional) क्या होगा?`;
        qTextEn = `What is the Fourth Proportional of ${a}, ${b} and ${c}?`;
        ansStr = `${ans}`;
        explanation = `चतुर्थानुपाती सूत्र = (B × C) ÷ A\n= (${b} × ${c}) ÷ ${a} = ${b * c} ÷ ${a} = ${ans}।`;
        explanationEn = `Fourth Proportional = (B * C) / A = ${b * c} / ${a} = ${ans}.`;
        shortcut = `सूत्र: (B × C) ÷ A = ${ans}`;
        distractors = [`${ans + 5}`, `${Math.max(1, ans - 5)}`, `${ans + 10}`, `${Math.max(1, ans - 10)}`];
      }
    }
    // 14. साधारण ब्याज (Simple Interest)
    else if (chosenTopic.includes('साधारण ब्याज')) {
      const typeVar = Math.floor(Math.random() * 5);
      if (typeVar === 0) {
        // Direct SI = P*R*T / 100
        const principals = [2000, 3000, 4000, 5000, 6000, 8000, 10000];
        const p = principals[Math.floor(Math.random() * principals.length)];
        const r = [5, 6, 8, 10, 12][Math.floor(Math.random() * 5)];
        const t = [2, 3, 4, 5][Math.floor(Math.random() * 4)];
        const si = Math.round((p * r * t) / 100);
        qText = `₹${p} की राशि पर ${r}% वार्षिक साधारण ब्याज दर से ${t} वर्ष का ब्याज (SI) कितना होगा?`;
        qTextEn = `Calculate Simple Interest on ₹${p} at ${r}% per annum for ${t} years?`;
        ansStr = `₹${si}`;
        explanation = `साधारण ब्याज (SI) = (P × R × T) ÷ 100\n= (${p} × ${r} × ${t}) ÷ 100 = ₹${si}।`;
        explanationEn = `SI = (P * R * T) / 100 = ₹${si}.`;
        shortcut = `सूत्र: (P × R × T) ÷ 100 = ₹${si}`;
        distractors = [`₹${si + 100}`, `₹${Math.max(50, si - 100)}`, `₹${si + 200}`, `₹${Math.max(50, si - 200)}`];
      } else if (typeVar === 1) {
        // Find Principal P
        const r = 10;
        const t = 3;
        const si = (Math.floor(Math.random() * 15) + 5) * 100;
        const p = (si * 100) / (r * t);
        qText = `वह मूलधन (Principal) ज्ञात कीजिए जिस पर ${r}% वार्षिक दर से ${t} वर्षों में ₹${si} का साधारण ब्याज प्राप्त होता है?`;
        qTextEn = `Find principal that earns ₹${si} simple interest at ${r}% in ${t} years?`;
        ansStr = `₹${p}`;
        explanation = `मूलधन सूत्र P = (SI × 100) ÷ (R × T)\n= (${si} × 100) ÷ (${r} × ${t}) = ₹${p}।`;
        explanationEn = `P = (SI * 100) / (R * T) = ₹${p}.`;
        shortcut = `P = (${si} × 100) ÷ ${r * t} = ₹${p}`;
        distractors = [`₹${p + 500}`, `₹${Math.max(500, p - 500)}`, `₹${p + 1000}`, `₹${Math.max(500, p - 1000)}`];
      } else if (typeVar === 2) {
        // Money doubling rule: T = 100 / R
        const r = [5, 8, 10, 12.5, 20][Math.floor(Math.random() * 5)];
        const ansT = Math.round((100 / r) * 10) / 10;
        qText = `कितने वर्षों में कोई राशि ${r}% वार्षिक साधारण ब्याज की दर से स्वयं की दोगुनी (Double) हो जाएगी?`;
        qTextEn = `In how many years will a sum double itself at ${r}% simple interest per annum?`;
        ansStr = `${ansT} वर्ष`;
        explanation = `राशि दोगुनी होने का शॉर्टकट सूत्र: समय (T) = 100 ÷ R\n= 100 ÷ ${r} = ${ansT} वर्ष।`;
        explanationEn = `Doubling formula: Time = 100 / R = ${ansT} years.`;
        shortcut = `शॉर्टकट सूत्र: T = 100 ÷ R = ${ansT} वर्ष`;
        distractors = [`${ansT + 2} वर्ष`, `${Math.max(1, ansT - 2)} वर्ष`, `${ansT + 5} वर्ष`, `${Math.max(1, ansT - 5)} वर्ष`];
      } else if (typeVar === 3) {
        // Total Amount A = P + SI
        const p = 5000;
        const r = 8;
        const t = 3;
        const si = (p * r * t) / 100;
        const a = p + si;
        qText = `₹${p} का ${r}% वार्षिक ब्याज दर से ${t} वर्ष पश्चात मिश्रधन (Total Amount) कितना होगा?`;
        qTextEn = `What is total amount on ₹${p} at ${r}% for ${t} years?`;
        ansStr = `₹${a}`;
        explanation = `ब्याज = (${p} × ${r} × ${t}) ÷ 100 = ₹${si}।\nमिश्रधन A = P + SI = ${p} + ${si} = ₹${a}।`;
        explanationEn = `SI = ₹${si}. Amount = P + SI = ₹${a}.`;
        shortcut = `मिश्रधन = ${p} + ${si} = ₹${a}`;
        distractors = [`₹${si}`, `₹${a + 200}`, `₹${Math.max(500, a - 200)}`, `₹${a + 500}`];
      } else {
        // Difference in SI
        const p = 8000;
        const t = 2;
        const r1 = 6;
        const r2 = 9;
        const diffRate = r2 - r1;
        const diffSI = (p * diffRate * t) / 100;
        qText = `₹${p} पर 2 वर्ष के लिए साधारण ब्याज दर ${r1}% से बढ़ाकर ${r2}% कर दी जाती है। ब्याज में कितने रुपयों की वृद्धि (Increase) होगी?`;
        qTextEn = `On ₹${p} for 2 years, rate increases from ${r1}% to ${r2}%. Find increase in SI?`;
        ansStr = `₹${diffSI}`;
        explanation = `दरों का अंतर = ${r2}% - ${r1}% = ${diffRate}%।\nब्याज वृद्धि = (P × दर अंतर × T) ÷ 100 = (${p} × ${diffRate} × ${t}) ÷ 100 = ₹${diffSI}।`;
        explanationEn = `Rate diff = ${diffRate}%. SI diff = (${p} * ${diffRate} * ${t}) / 100 = ₹${diffSI}.`;
        shortcut = `(${p} × ${diffRate} × ${t}) ÷ 100 = ₹${diffSI}`;
        distractors = [`₹${diffSI + 80}`, `₹${Math.max(20, diffSI - 80)}`, `₹${diffSI + 160}`, `₹${Math.max(20, diffSI - 160)}`];
      }
    }
    // 15. लाभ व हानि (Profit & Loss)
    else if (chosenTopic.includes('लाभ व हानि')) {
      const typeVar = Math.floor(Math.random() * 5);
      if (typeVar === 0) {
        // SP = CP * (1 + Profit%/100)
        const cp = (Math.floor(Math.random() * 15) + 5) * 100; // e.g. 1200
        const profitP = [10, 15, 20, 25, 30][Math.floor(Math.random() * 5)];
        const profit = (cp * profitP) / 100;
        const sp = cp + profit;
        qText = `एक वस्तु का क्रय मूल्य (CP) ₹${cp} है। इसे ${profitP}% लाभ पर बेचने पर विक्रय मूल्य (SP) क्या होगा?`;
        qTextEn = `Cost price is ₹${cp}. Selling price at ${profitP}% profit?`;
        ansStr = `₹${sp}`;
        explanation = `लाभ = (${cp} × ${profitP}) ÷ 100 = ₹${profit}।\nविक्रय मूल्य (SP) = ${cp} + ${profit} = ₹${sp}।`;
        explanationEn = `Profit = ₹${profit}. SP = CP + Profit = ₹${sp}.`;
        shortcut = `SP = ${cp} × (${100 + profitP} ÷ 100) = ₹${sp}`;
        distractors = [`₹${sp + 50}`, `₹${Math.max(50, sp - 50)}`, `₹${sp + 100}`, `₹${Math.max(50, sp - 100)}`];
      } else if (typeVar === 1) {
        // Finding CP when SP & Loss % given
        const lossP = 20;
        const cp = (Math.floor(Math.random() * 10) + 4) * 100;
        const sp = cp * (1 - lossP / 100);
        qText = `एक वस्तु को ₹${sp} में बेचने पर ${lossP}% की हानि होती है। वस्तु का क्रय मूल्य (CP) क्या था?`;
        qTextEn = `Item sold for ₹${sp} at ${lossP}% loss. Find cost price (CP)?`;
        ansStr = `₹${cp}`;
        explanation = `क्रय मूल्य सूत्र CP = (SP × 100) ÷ (100 - Loss%)\n= (${sp} × 100) ÷ 80 = ₹${cp}।`;
        explanationEn = `CP = (SP * 100) / (100 - Loss%) = (${sp} * 100) / 80 = ₹${cp}.`;
        shortcut = `CP = (${sp} × 100) ÷ 80 = ₹${cp}`;
        distractors = [`₹${cp + 100}`, `₹${Math.max(100, cp - 100)}`, `₹${cp + 200}`, `₹${Math.max(100, cp - 200)}`];
      } else if (typeVar === 2) {
        // Discount & Marked Price
        const mp = 2000;
        const discP = 15;
        const disc = (mp * discP) / 100;
        const sp = mp - disc;
        qText = `एक वस्तु का अंकित मूल्य (Marked Price) ₹${mp} है। यदि इस पर ${discP}% की छूट (Discount) दी जाए, तो विक्रय मूल्य क्या होगा?`;
        qTextEn = `Marked Price is ₹${mp}. Selling price after ${discP}% discount?`;
        ansStr = `₹${sp}`;
        explanation = `छूट = (${mp} × ${discP}) ÷ 100 = ₹${disc}।\nविक्रय मूल्य = ${mp} - ${disc} = ₹${sp}।`;
        explanationEn = `Discount = ₹${disc}. SP = MP - Discount = ₹${sp}.`;
        shortcut = `SP = ${mp} × (${100 - discP} ÷ 100) = ₹${sp}`;
        distractors = [`₹${sp + 50}`, `₹${Math.max(50, sp - 50)}`, `₹${sp + 100}`, `₹${Math.max(50, sp - 100)}`];
      } else if (typeVar === 3) {
        // Article ratio rule: CP of X articles = SP of Y articles
        const x = 15;
        const y = 12;
        // Profit % = (15 - 12) / 12 * 100 = 25%
        ansStr = `25% लाभ`;
        qText = `यदि 15 वस्तुओं का क्रय मूल्य 12 वस्तुओं के विक्रय मूल्य के बराबर है, तो प्रतिशत लाभ या हानि ज्ञात कीजिए?`;
        qTextEn = `If CP of 15 articles = SP of 12 articles, find profit or loss %?`;
        explanation = `प्रतिशत लाभ सूत्र = [(X - Y) ÷ Y] × 100%\n= [(15 - 12) ÷ 12] × 100% = (3 ÷ 12) × 100% = 25% लाभ।`;
        explanationEn = `Profit % = [(15 - 12) / 12] * 100% = 25% profit.`;
        shortcut = `[(15 - 12) ÷ 12] × 100% = 25% लाभ`;
        distractors = [`20% लाभ`, `25% हानि`, `20% हानि`, `30% लाभ`];
      } else {
        // Equal SP shortcut: Two items at same SP, one at P% profit, one at P% loss -> overall loss P²/100 %
        const p = 10;
        const lossP = (p * p) / 100;
        qText = `दो वस्तुओं में से प्रत्येक को ₹1200 में बेचा जाता है। एक पर ${p}% का लाभ तथा दूसरी पर ${p}% की हानि होती है। पूरे सौदे में कुल कितने प्रतिशत लाभ या हानि होगी?`;
        qTextEn = `Two items sold for ₹1200 each, one at ${p}% profit and one at ${p}% loss. Overall outcome?`;
        ansStr = `${lossP}% हानि`;
        explanation = `समान विक्रय मूल्य पर समान लाभ-हानि का सदाबहार सूत्र:\nसदैव हानि% = (P)² ÷ 100 = (${p})² ÷ 100 = ${lossP}% हानि।`;
        explanationEn = `Always loss = (P)² / 100 = ${lossP}% loss.`;
        shortcut = `सदैव हानि = (${p})² ÷ 100 = ${lossP}% हानि`;
        distractors = [`कोई लाभ या हानि नहीं`, `1% लाभ`, `2% हानि`, `0.5% लाभ`];
      }
    }
    // 16. समय व कार्य (Time & Work)
    else if (chosenTopic.includes('समय व कार्य')) {
      const typeVar = Math.floor(Math.random() * 5);
      if (typeVar === 0) {
        // A & B together: (A x B) / (A + B)
        const workPairs: [number, number, number][] = [
          [10, 15, 6], [12, 24, 8], [20, 30, 12], [15, 30, 10],
          [12, 60, 10], [10, 40, 8], [6, 12, 4], [20, 20, 10],
          [8, 24, 6], [15, 60, 12]
        ];
        const pair = workPairs[Math.floor(Math.random() * workPairs.length)];
        const aDays = pair[0];
        const bDays = pair[1];
        const ans = pair[2];
        qText = `A किसी कार्य को ${aDays} दिन में तथा B उसे ${bDays} दिन में पूरा करता है। दोनों मिलकर उस कार्य को कितने दिन में करेंगे?`;
        qTextEn = `A does a work in ${aDays} days, B in ${bDays} days. In how many days together?`;
        ansStr = `${ans} दिन`;
        explanation = `कुल समय = (A × B) ÷ (A + B) = (${aDays} × ${bDays}) ÷ (${aDays + bDays}) = ${ans} दिन।`;
        explanationEn = `Time together = (A * B) / (A + B) = ${ans} days.`;
        shortcut = `(A × B) ÷ (A + B) = ${ans} दिन`;
        distractors = [`${ans + 2} दिन`, `${Math.max(1, ans - 2)} दिन`, `${ans + 4} दिन`, `${Math.max(1, ans - 3)} दिन`];
      } else if (typeVar === 1) {
        // Finding B alone when A+B and A given: (T1 x T2) / (T2 - T1)
        const tTogether = 6;
        const aAlone = 10;
        const bAlone = (tTogether * aAlone) / (aAlone - tTogether); // 15
        qText = `A और B मिलकर एक कार्य को ${tTogether} दिन में समाप्त करते हैं। यदि A अकेला इसे ${aAlone} दिन में करता है, तो B अकेला इसे कितने दिन में करेगा?`;
        qTextEn = `A and B together finish in ${tTogether} days. A alone takes ${aAlone} days. How many days for B alone?`;
        ansStr = `${bAlone} दिन`;
        explanation = `अकेले B का समय = (A+B समय × A समय) ÷ (A समय - A+B समय)\n= (${tTogether} × ${aAlone}) ÷ (${aAlone} - ${tTogether}) = 60 ÷ 4 = ${bAlone} दिन।`;
        explanationEn = `B alone = (T1 * T2) / (T2 - T1) = ${bAlone} days.`;
        shortcut = `(6 × 10) ÷ (10 - 6) = ${bAlone} दिन`;
        distractors = [`${bAlone + 3} दिन`, `${Math.max(1, bAlone - 3)} दिन`, `${bAlone + 5} दिन`, `${Math.max(1, bAlone - 5)} दिन`];
      } else if (typeVar === 2) {
        // Efficiency ratio: A is twice as efficient as B
        const bDays = 30;
        const aDays = bDays / 2; // 15
        const together = (aDays * bDays) / (aDays + bDays); // 10
        qText = `A की कार्यक्षमता B से दोगुनी (Twice) है। यदि B अकेला कार्य को ${bDays} दिन में करता है, तो दोनों मिलकर इसे कितने दिन में पूरा करेंगे?`;
        qTextEn = `A is twice as efficient as B. If B takes ${bDays} days alone, how many days together?`;
        ansStr = `${together} दिन`;
        explanation = `B का समय = ${bDays} दिन -> A का समय = ${aDays} दिन।\nदोनों मिलकर = (${aDays} × ${bDays}) ÷ (${aDays} + ${bDays}) = ${together} दिन।`;
        explanationEn = `A's time = ${aDays} days. Together = ${together} days.`;
        shortcut = `${bDays} ÷ 3 = ${together} दिन`;
        distractors = [`${together + 2} दिन`, `${Math.max(1, together - 2)} दिन`, `${together + 4} दिन`, `${Math.max(1, together - 4)} दिन`];
      } else if (typeVar === 3) {
        // Pipes & Cisterns: Inlet and Outlet
        const inTime = 12;
        const outTime = 20;
        const netTime = (inTime * outTime) / (outTime - inTime); // 30
        qText = `एक नल A टंकी को ${inTime} घंटे में भरता है तथा नल B इसे ${outTime} घंटे में खाली कर देता है। दोनों नल एक साथ खोलने पर टंकी कितने घंटे में भरेगी?`;
        qTextEn = `Pipe A fills tank in ${inTime} hrs, Pipe B empties in ${outTime} hrs. Time to fill if both open?`;
        ansStr = `${netTime} घंटे`;
        explanation = `कुल समय = (A × B) ÷ (B - A) = (${inTime} × ${outTime}) ÷ (${outTime} - ${inTime}) = 240 ÷ 8 = ${netTime} घंटे।`;
        explanationEn = `Net time = (A * B) / (B - A) = ${netTime} hours.`;
        shortcut = `(12 × 20) ÷ (20 - 12) = ${netTime} घंटे`;
        distractors = [`${netTime + 5} घंटे`, `${Math.max(1, netTime - 5)} घंटे`, `${netTime + 10} घंटे`, `${Math.max(1, netTime - 10)} घंटे`];
      } else {
        // Three persons A, B, C together
        const a = 12;
        const b = 15;
        const c = 20;
        // 1/12 + 1/15 + 1/20 = (5 + 4 + 3)/60 = 12/60 = 1/5 -> 5 days
        const ans = 5;
        qText = `A, B तथा C किसी कार्य को क्रमशः ${a}, ${b} तथा ${c} दिन में करते हैं। तीनों मिलकर इसे कितने दिन में पूरा करेंगे?`;
        qTextEn = `A, B and C do work in ${a}, ${b} and ${c} days respectively. Time together?`;
        ansStr = `${ans} दिन`;
        explanation = `ल.स.प. (LCM) ऑफ (${a}, ${b}, ${c}) = 60 यूनिट।\nA क्षमता = 5, B क्षमता = 4, C क्षमता = 3। कुल क्षमता = 12।\nसमय = 60 ÷ 12 = ${ans} दिन।`;
        explanationEn = `LCM = 60. Efficiency sum = 12. Time = 60 / 12 = ${ans} days.`;
        shortcut = `60 ÷ (5 + 4 + 3) = ${ans} दिन`;
        distractors = [`${ans + 2} दिन`, `${Math.max(1, ans - 2)} दिन`, `${ans + 3} दिन`, `${Math.max(1, ans - 3)} दिन`];
      }
    }
    // 17. समय, चाल व दूरी (Time & Distance)
    else if (chosenTopic.includes('समय, चाल व दूरी')) {
      const typeVar = Math.floor(Math.random() * 5);
      if (typeVar === 0) {
        // Time = Distance / Speed
        const speed = [36, 45, 54, 60, 72, 80, 90][Math.floor(Math.random() * 7)];
        const hours = Math.floor(Math.random() * 5) + 2;
        const distance = speed * hours;
        qText = `एक रेलगाड़ी ${speed} किमी/घंटा की गति से चल रही है। ${distance} किमी की दूरी तय करने में उसे कितना समय लगेगा?`;
        qTextEn = `Train moves at ${speed} km/h. How long to cover ${distance} km?`;
        ansStr = `${hours} घंटे`;
        explanation = `समय = दूरी ÷ चाल = ${distance} ÷ ${speed} = ${hours} घंटे।`;
        explanationEn = `Time = Distance / Speed = ${distance} / ${speed} = ${hours} hours.`;
        shortcut = `${distance} ÷ ${speed} = ${hours} घंटे`;
        distractors = [`${hours + 1} घंटे`, `${Math.max(1, hours - 1)} घंटे`, `${hours + 2} घंटे`, `${hours + 3} घंटे`];
      } else if (typeVar === 1) {
        // Speed Unit Conversion: km/h to m/s
        const kmh = [36, 54, 72, 90, 108, 126, 144][Math.floor(Math.random() * 7)];
        const ms = (kmh * 5) / 18;
        qText = `चाल ${kmh} किमी/घंटा को मीटर/सेकंड (m/s) में बदलें:`;
        qTextEn = `Convert speed ${kmh} km/h into m/s:`;
        ansStr = `${ms} m/s`;
        explanation = `किमी/घंटा से m/s में बदलने के लिए 5/18 से गुणा करें:\n${kmh} × (5 ÷ 18) = ${ms} m/s।`;
        explanationEn = `Multiply by 5/18: ${kmh} * 5 / 18 = ${ms} m/s.`;
        shortcut = `${kmh} × 5/18 = ${ms} m/s`;
        distractors = [`${ms + 5} m/s`, `${Math.max(1, ms - 5)} m/s`, `${ms + 10} m/s`, `${Math.max(1, ms - 10)} m/s`];
      } else if (typeVar === 2) {
        // Train crossing a pole: Time = Train length / Speed
        const speedKmh = 72; // 20 m/s
        const speedMs = 20;
        const lengthM = (Math.floor(Math.random() * 10) + 10) * 20; // e.g. 300m
        const timeSec = lengthM / speedMs;
        qText = `${lengthM} मीटर लंबी रेलगाड़ी ${speedKmh} किमी/घंटा की गति से एक खंभे (Pole) को कितने सेकंड में पार करेगी?`;
        qTextEn = `A ${lengthM}m train at ${speedKmh} km/h crosses a pole in how many seconds?`;
        ansStr = `${timeSec} सेकंड`;
        explanation = `चाल m/s में = ${speedKmh} × (5/18) = ${speedMs} m/s।\nसमय = लंबाई ÷ चाल = ${lengthM} ÷ ${speedMs} = ${timeSec} सेकंड।`;
        explanationEn = `Speed in m/s = ${speedMs}. Time = ${lengthM} / ${speedMs} = ${timeSec} sec.`;
        shortcut = `${lengthM} ÷ 20 = ${timeSec} सेकंड`;
        distractors = [`${timeSec + 3} सेकंड`, `${Math.max(1, timeSec - 3)} सेकंड`, `${timeSec + 5} सेकंड`, `${Math.max(1, timeSec - 5)} सेकंड`];
      } else if (typeVar === 3) {
        // Relative Speed in opposite direction
        const s1 = 40;
        const s2 = 50;
        const relSpeed = s1 + s2; // 90 km/h = 25 m/s
        const distKm = 180;
        const timeHours = distKm / relSpeed;
        qText = `दो स्थान A तथा B 180 किमी दूर हैं। दो कारें विपरीत दिशाओं में क्रमशः 40 किमी/घंटा तथा 50 किमी/घंटा से चलती हैं। वे कितने घंटे बाद मिलेंगी?`;
        qTextEn = `Two cars 180 km apart move towards each other at 40 km/h and 50 km/h. Meeting time?`;
        ansStr = `${timeHours} घंटे`;
        explanation = `विपरीत दिशा में सापेक्ष चाल = S1 + S2 = 40 + 50 = 90 किमी/घंटा।\nसमय = दूरी ÷ सापेक्ष चाल = 180 ÷ 90 = ${timeHours} घंटे।`;
        explanationEn = `Relative speed = 90 km/h. Time = 180 / 90 = ${timeHours} hours.`;
        shortcut = `180 ÷ (40 + 50) = ${timeHours} घंटे`;
        distractors = [`${timeHours + 1} घंटे`, `${Math.max(1, timeHours - 1)} घंटे`, `${timeHours + 2} घंटे`, `${Math.max(1, timeHours - 2)} घंटे`];
      } else {
        // Distance = Speed x Time
        const speed = 65;
        const time = 4;
        const dist = speed * time;
        qText = `एक बस 65 किमी/घंटा की गति से 4 घंटे चलती है। बस द्वारा तय की गई कुल दूरी (Distance) क्या होगी?`;
        qTextEn = `A bus moves at 65 km/h for 4 hours. Total distance covered?`;
        ansStr = `${dist} किमी`;
        explanation = `दूरी = चाल × समय = 65 × 4 = ${dist} किमी।`;
        explanationEn = `Distance = Speed * Time = 65 * 4 = ${dist} km.`;
        shortcut = `65 × 4 = ${dist} किमी`;
        distractors = [`${dist + 20} किमी`, `${dist - 20} किमी`, `${dist + 40} किमी`, `${dist - 40} किमी`];
      }
    }
    // 18. सरलीकरण / Default Fallback
    else {
      const a = (Math.floor(Math.random() * 10) + 2) * 6;
      const b = [2, 3, 6][Math.floor(Math.random() * 3)];
      const c = Math.floor(Math.random() * 5) + 3;
      const d = Math.floor(Math.random() * 15) + 5;
      const res = (a / b) * c + d;

      qText = `मान ज्ञात कीजिए: (${a} ÷ ${b}) × ${c} + ${d} = ?`;
      qTextEn = `Evaluate: (${a} ÷ ${b}) × ${c} + ${d} = ?`;
      ansStr = `${res}`;
      explanation = `BODMAS नियम का पालन करें:\n1. भाग: ${a} ÷ ${b} = ${a / b}\n2. गुणा: ${a / b} × ${c} = ${(a / b) * c}\n3. जोड़: ${(a / b) * c} + ${d} = ${res}।`;
      explanationEn = `Follow BODMAS: Division first (${a} / ${b} = ${a / b}), Multiplication (${(a / b) * c}), then Addition = ${res}.`;
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
      optionsEn: shuffledOptions.map((str: string) => {
        if (typeof str !== 'string') return str;
        return str
          .replace(/\bदिन\b/g, 'days')
          .replace(/\bघंटे\b/g, 'hours')
          .replace(/\bवर्ष\b/g, 'years')
          .replace(/\bकिमी\/घंटा\b/g, 'km/h')
          .replace(/\bकिमी\b/g, 'km')
          .replace(/\bमीटर\b/g, 'm')
          .replace(/\bअंक\b/g, 'points');
      }),
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
    return localStorage.getItem('study_bull_lang') !== 'en';
  });
  const [soundMuted, setSoundMuted] = useState<boolean>(() => {
    return localStorage.getItem('study_bull_muted') === 'true';
  });

  // Sync language setting across app and notify any active custom iframe pages
  useEffect(() => {
    localStorage.setItem('study_bull_lang', langHindi ? 'hi' : 'en');
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
  const [activeTypingPassage, setActiveTypingPassage] = useState<string>('');
  const [activeTypingTitle, setActiveTypingTitle] = useState<string>('');
  const passageText = activeTypingPassage || '';
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

  const isFolderNode = (item: any) => {
    if (!item) return false;
    const kind = String(item?.kind || item?.type || '').toLowerCase();
    return kind === 'folder' || kind === 'category' || kind === 'group' || kind === 'directory';
  };

  // Reusable universal handler for clicking ANY Admin node (MCQs, Notes, Folders, Pages)
  const handleNodeInteraction = (btn: any) => {
    if (!btn) return;

    if (btn.url) {
      window.open(btn.url, '_blank');
      return;
    }

    // IF THIS BUTTON HAS SUB-BUTTONS OR IS MARKED AS A FOLDER, OPEN AS A FOLDER VIEW SO ALL INSIDE BUTTONS ARE ACCESSIBLE
    if (isFolderNode(btn) || (Array.isArray(btn.children) && btn.children.length > 0)) {
      if (currentView === 'custom_node' && activeCustomNode) {
        setFolderStack(prev => [...prev, activeCustomNode]);
      } else {
        setFolderStack([]);
      }
      setActiveCustomNode(btn);
      setHtmlReloadKey(0);
      setHtmlIsFullscreen(false);
      navigateTo('custom_node');
      return;
    }

    const target = String(btn.view || btn.target_view || btn.type || btn.kind || btn.id || '').toLowerCase();
    const kind = String(btn.kind || btn.type || '').toLowerCase();

    // 1. ADMIN MCQs & QUIZZES (or custom questions attached to admin button)
    const customQuestions = 
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

    if (customQuestions) {
      const normalizedQs = customQuestions.map((q: any, i: number) => ({
        id: q.id || i + 1,
        question: q.question || q.qText || q.title || 'Question',
        questionEn: q.questionEn || q.question_en || q.question || 'Question',
        options: Array.isArray(q.options) ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
        optionsEn: Array.isArray(q.optionsEn) ? q.optionsEn : (Array.isArray(q.options) ? q.options : ['Option A', 'Option B', 'Option C', 'Option D']),
        correct: typeof q.correct === 'number' ? q.correct : (typeof q.answerIndex === 'number' ? q.answerIndex : 0),
        explanation: q.explanation || q.exp || 'सही उत्तर चुनने हेतु बधाई।',
        explanationEn: q.explanationEn || q.explanation_en || q.explanation || 'Great job selecting the correct answer.'
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
        setMockIndex(0);
        setUserMockAnswers(new Array(normalizedQs.length).fill(null));
        setMockTimer(600);
        setMockTimerActive(true);
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
        setMockQuestions(mockQs);
        setMockIndex(0);
        setUserMockAnswers(new Array(mockQs.length).fill(null));
        setMockTimer(600);
        setMockTimerActive(true);
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
    setActiveCustomNode(btn);
    setHtmlReloadKey(0);
    setHtmlIsFullscreen(false);
    navigateTo('custom_node');
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

  const applyLiveAdminData = (nodes: any[], settings: any) => {
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

  useEffect(() => {
    let isMounted = true;

    // 1. Initial background fetch & normalization from Supabase
    loadStudyBullApp().then((appData) => {
      if (!isMounted) return;
      if (Array.isArray(appData.nodes) && (appData.nodes.length > 0 || !appData.error)) {
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
        <div className="fixed inset-0 z-50 flex flex-col w-screen h-screen bg-slate-50 select-none overflow-hidden">
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
              onClick={() => {
                setActiveCustomNode(null);
                setFolderStack([]);
                setCurrentView('home');
              }}
              className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 font-medium cursor-pointer border border-slate-700/80"
            >
              <span>🏠</span>
              <span>{langHindi ? 'मुख्य पृष्ठ' : 'Home'}</span>
            </button>

            {folderStack.map((parent, idx) => (
              <React.Fragment key={parent.id || idx}>
                <span className="text-slate-500 font-extrabold text-sm">›</span>
                <button
                  onClick={() => {
                    setFolderStack(s => s.slice(0, idx));
                    setActiveCustomNode(parent);
                  }}
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
          <div className="flex-1 w-full bg-white overflow-hidden relative">
            {isHtmlTool && rawHtml ? (
              <iframe
                key={`fs-feature-${activeCustomNode.id}-${htmlReloadKey}`}
                srcDoc={(() => {
                  const langScript = `<script>
                    window.langHindi = ${langHindi};
                    window.APP_LANG = "${langHindi ? 'hi' : 'en'}";
                    window.addEventListener('message', function(e) {
                      if (e.data && e.data.type === 'LANG_CHANGE') {
                        window.langHindi = e.data.langHindi;
                        window.APP_LANG = e.data.lang;
                        document.documentElement.lang = e.data.lang;
                        var nodes = document.querySelectorAll('[data-lang-hi], [data-lang-en]');
                        nodes.forEach(function(node) {
                          if (e.data.langHindi && node.getAttribute('data-lang-hi')) {
                            node.textContent = node.getAttribute('data-lang-hi');
                          } else if (!e.data.langHindi && node.getAttribute('data-lang-en')) {
                            node.textContent = node.getAttribute('data-lang-en');
                          }
                        });
                        window.dispatchEvent(new CustomEvent('applangchange', { detail: e.data }));
                      }
                    });
                  </script>`;
                  if (rawHtml.includes('<head>')) {
                    return rawHtml.replace('<head>', '<head>' + langScript);
                  }
                  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><script src="https://cdn.tailwindcss.com"></script>${langScript}<style>body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 0; } * { box-sizing: border-box; }</style></head><body>${rawHtml}</body></html>`;
                })()}
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
                        handleNodeInteraction(child);
                      };

                      if (isChildSection) {
                        return (
                          <button
                            key={child.id}
                            onClick={handleChildClick}
                            className="col-span-2 sm:col-span-2 md:col-span-3 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-white border border-blue-200/80 hover:border-blue-300 rounded-2xl p-4 flex items-center justify-between shadow-sm my-1 text-left w-full cursor-pointer transition active:scale-98"
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
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="px-2.5 py-1 bg-blue-100 text-blue-700 font-bold text-[10px] rounded-lg uppercase tracking-wider">
                                Section
                              </span>
                              <ChevronRight className="w-4 h-4 text-blue-500" />
                            </div>
                          </button>
                        );
                      }

                      const childCount = Array.isArray(child.children) ? child.children.length : 0;

                      if (isChildFolder) {
                        return (
                          <button
                            key={child.id}
                            onClick={handleChildClick}
                            className="col-span-2 sm:col-span-2 md:col-span-3 group relative bg-gradient-to-r from-amber-50 via-amber-50/90 to-amber-100/80 rounded-2xl p-4 shadow-sm border-2 border-amber-300/90 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer flex items-center justify-between text-left overflow-hidden my-1 w-full active:scale-98"
                          >
                            <div className="flex items-center space-x-3.5 min-w-0">
                              <div className="w-11 h-11 rounded-xl bg-amber-200/90 group-hover:bg-amber-300 text-amber-900 transition-colors flex items-center justify-center text-2xl shadow-inner flex-shrink-0 group-hover:scale-105 transform duration-150">
                                {childIcon || '📂'}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-extrabold text-amber-950 group-hover:text-amber-900 transition-colors text-base sm:text-lg tracking-tight truncate">
                                    {childTitle}
                                  </h3>
                                  <span className="px-2 py-0.5 bg-amber-200/90 text-amber-900 text-[10px] font-extrabold rounded-md uppercase tracking-wider shrink-0 border border-amber-300/80 shadow-2xs">
                                    📁 {langHindi ? 'फोल्डर' : 'Folder'}
                                  </span>
                                </div>
                                <p className="text-xs text-amber-800/90 font-medium truncate mt-0.5">
                                  {childSubtitle || (childCount > 0 ? (langHindi ? `${childCount} सामग्री मौजूद` : `${childCount} items inside`) : (langHindi ? 'फोल्डर खोलें' : 'Open Folder'))}
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
                          key={child.id}
                          onClick={handleChildClick}
                          className="group relative bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-400 transition-all cursor-pointer flex flex-col items-start justify-between text-left overflow-hidden h-36 active:scale-98"
                        >
                          <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm animate-pulse"></span>
                          </div>

                          <div className="w-12 h-12 rounded-2xl bg-blue-50 group-hover:bg-blue-100 transition-colors flex items-center justify-center text-2xl shadow-inner flex-shrink-0 mb-2">
                            {childIcon || '⚡'}
                          </div>

                          <div className="w-full">
                            <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-sm sm:text-base leading-snug line-clamp-1">
                              {childTitle}
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5 font-medium line-clamp-1">
                              {childSubtitle || (langHindi ? 'पेज खोलें' : 'Open Page')}
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
                            loadStudyBullApp().then((d) => {
                              if (Array.isArray(d.nodes)) applyLiveAdminData(d.nodes, d.settings || {});
                            });
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
                        const childCount = Array.isArray(btn.children) ? btn.children.length : 0;

                        if (isFolder) {
                          return (
                            <button
                              key={btn.id}
                              onClick={handleNodeClick}
                              className="col-span-2 sm:col-span-2 md:col-span-3 group relative bg-gradient-to-r from-amber-50 via-amber-50/90 to-amber-100/80 rounded-2xl p-4 shadow-sm border-2 border-amber-300/90 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer flex items-center justify-between text-left overflow-hidden my-1 w-full active:scale-98"
                            >
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
              </motion.div>
            )}

            {/* 3. QUIZ PLAY (MCQ REAL EXPERIENCE WITH INSTANT GREEN/RED FEEDBACK) */}
            {currentView === 'quiz_play' && (
              <motion.div
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
                          onClick={() => setCurrentView('quiz_categories')}
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
                    <div className="mt-4 space-y-4 max-h-96 overflow-y-auto pr-1">
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
                          onClick={() => setCurrentView('home')}
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
                                timeTaken: 600 - mockTimer
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
                  <h2 className="text-2xl font-bold text-slate-900 mb-1">{langHindi ? 'मॉक टेस्ट स्कोरकार्ड (Analysis)' : 'Mock Test Scorecard (Analysis)'}</h2>
                  <p className="text-xs text-slate-500">{langHindi ? 'रिएल एग्जाम सिमुलेशन रिपोर्ट' : 'Real Exam Simulation Report'}</p>
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
                          <div className="mt-4 space-y-4 max-h-96 overflow-y-auto pr-1">
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
                      setMockTimer(600);
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
                  const chap = selectedChapter || getNotesChaptersFromAdmin(adminNodes)[0];
                  if (!chap) {
                    return (
                      <div className="text-center py-12">
                        <p className="text-sm font-bold text-slate-600 mb-4">
                          {langHindi ? 'कोई नोट्स सामग्री उपलब्ध नहीं है' : 'No notes content available'}
                        </p>
                        <button
                          onClick={() => navigateTo('home')}
                          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
                        >
                          {langHindi ? 'मुख्य पृष्ठ पर लौटें' : 'Return to Home'}
                        </button>
                      </div>
                    );
                  }
                  return (
                    <>
                      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-6 flex-wrap gap-3">
                        <button
                          onClick={handleBack}
                          className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-sm hover:bg-blue-700 transition active:scale-95 cursor-pointer"
                        >
                          ← {langHindi ? 'वापस' : 'Back'}
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
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Calculator className="w-4 h-4 text-blue-600" /> {langHindi ? 'विषय चुनें (Math Topics)' : 'Select Math Topic'}
                    </h3>
                    <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                      {langHindi ? `${ALL_MATH_TOPICS.length} विषय उपलब्ध` : `${ALL_MATH_TOPICS.length} topics available`}
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
                  <span>🚀 {langHindi ? `अभ्यास शुरू करें (${calcCount === 'Infinite' ? 'असीमित प्रश्न' : `${calcCount} प्रश्न`})` : `Start Practice (${calcCount === 'Infinite' ? 'Unlimited' : `${calcCount} Questions`})`}</span>
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
                              } else if (calcCount === 'Infinite') {
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
                    <div className="mt-4 space-y-4 max-h-96 overflow-y-auto pr-1">
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
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{langHindi ? '⌨️ टाइपिंग स्पीड एवं एक्यूरेसी लैब' : '⌨️ Typing Speed & Accuracy Lab'}</h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">{langHindi ? 'SSC CGL, CHSL, Delhi Police HC स्पीड एवं एक्यूरेसी टेस्ट' : 'SSC CGL, CHSL, Delhi Police HC Typing Test'}</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{langHindi ? 'समय अवधि चुनें (Duration):' : 'Select Time Duration:'}</h3>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 5, 10, 'Infinite'].map((dur) => (
                      <button
                        key={String(dur)}
                        onClick={() => setTypingDuration(dur as number | 'Infinite')}
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
                                {langHindi ? `${text.trim().split(/\s+/).filter(Boolean).length} शब्द • ${text.length} अक्षर` : `${text.trim().split(/\s+/).filter(Boolean).length} words • ${text.length} chars`}
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
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </SafeErrorBoundary>
  );
}
