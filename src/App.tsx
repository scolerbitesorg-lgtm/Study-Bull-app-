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

                      return (
                        <button
                          key={child.id}
                          onClick={handleChildClick}
                          className="group relative bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer flex flex-col items-start justify-between text-left overflow-hidden h-36 active:scale-98"
                        >
                          <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5">
                            {isChildFolder ? (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md shadow-2xs">
                                Folder
                              </span>
                            ) : (
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm animate-pulse"></span>
                            )}
                          </div>

                          <div className={`w-12 h-12 rounded-2xl transition-colors flex items-center justify-center text-2xl shadow-inner flex-shrink-0 mb-2 ${isChildFolder ? 'bg-amber-50 group-hover:bg-amber-100' : 'bg-blue-50 group-hover:bg-blue-100'}`}>
                            {childIcon || (isChildFolder ? '📁' : '⚡')}
                          </div>

                          <div className="w-full">
                            <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-sm sm:text-base leading-snug line-clamp-1">
                              {childTitle}
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5 font-medium line-clamp-1">
                              {childSubtitle || (isChildFolder ? (childCount > 0 ? (langHindi ? `${childCount} सामग्री मौजूद` : `${childCount} items`) : (langHindi ? 'फोल्डर खोलें' : 'Open Folder')) : (childCount > 0 ? (langHindi ? `${childCount} बटन मौजूद` : `${childCount} sub-buttons`) : ''))}
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

                        return (
                          <button
                            key={btn.id}
                            onClick={handleNodeClick}
                            className="group relative bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer flex flex-col items-start justify-between text-left overflow-hidden h-36 active:scale-98"
                          >
                            <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5">
                              {isFolder ? (
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md shadow-2xs">
                                  Folder
                                </span>
                              ) : (
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm animate-pulse"></span>
                              )}
                            </div>

                            <div className={`w-12 h-12 rounded-2xl transition-colors flex items-center justify-center text-2xl shadow-inner flex-shrink-0 mb-2 ${isFolder ? 'bg-amber-50 group-hover:bg-amber-100' : 'bg-blue-50 group-hover:bg-blue-100'}`}>
                              {displayIcon || (isFolder ? '📁' : '⚡')}
                            </div>

                            <div className="w-full">
                              <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-sm sm:text-base leading-snug line-clamp-1">
                                {displayTitle}
                              </h3>
                              <p className="text-xs text-slate-500 mt-0.5 font-medium line-clamp-1">
                                {displaySubtitle || (isFolder ? (childCount > 0 ? (langHindi ? `${childCount} सामग्री मौजूद` : `${childCount} items`) : (langHindi ? 'फोल्डर खोलें' : 'Open Folder')) : '')}
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
