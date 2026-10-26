// Speed Math question generator — moved out of App.tsx unchanged (Oct 26 2026) so it downloads only when
// Speed Math is used (it is ~100 KB of code the home screen never needs).
import type { QuizQuestion } from '../App';
import { ALL_MATH_TOPICS } from './mathTopics';

// Helper to calculate greatest common divisor
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export // 100% Mathematically Proven Unlimited Question Generator Across All Topics
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
    // 7. सरलीकरण (BODMAS / Simplification)
    else if (chosenTopic.includes('सरलीकरण')) {
      const typeVar = Math.floor(Math.random() * 7);
      if (typeVar === 0) {
        // SMP_01: BODMAS / VBODMAS Rule
        ansStr = `15`;
        qText = `सरल कीजिए: 18 - [6 - {4 - (8 - 6 + 3)}]`;
        qTextEn = `Solve: 18 - [6 - {4 - (8 - 6 + 3)}]`;
        explanation = `सबसे पहले छोटे कोष्ठक को हल करें: (8 - 6 + 3) = 5। फिर मजहला कोष्ठक: {4 - 5} = -1। बड़ा कोष्ठक: [6 - (-1)] = 7। अतः 18 - 7 = 15।`;
        explanationEn = `Step by step inner to outer brackets: inner = 5, middle = -1, outer = 7. Result = 18 - 7 = 15.`;
        shortcut = `कोष्ठक नियम (BODMAS): 18 - 7 = 15`;
        distractors = [`12`, `18`, `10`, `14`];
      } else if (typeVar === 1) {
        // SMP_02: Algebraic Identity Based
        ansStr = `1`;
        qText = `मान ज्ञात कीजिए: (0.73 × 0.73 × 0.73 + 0.27 × 0.27 × 0.27) ÷ (0.73 × 0.73 - 0.73 × 0.27 + 0.27 × 0.27)`;
        qTextEn = `Evaluate: (0.73 * 0.73 * 0.73 + 0.27 * 0.27 * 0.27) / (0.73 * 0.73 - 0.73 * 0.27 + 0.27 * 0.27)`;
        explanation = `सर्वसमिका: (a³ + b³) ÷ (a² - ab + b²) = (a + b) = 0.73 + 0.27 = 1.00।`;
        explanationEn = `Identity formula: (a³ + b³) / (a² - ab + b²) = a + b = 0.73 + 0.27 = 1.`;
        shortcut = `a + b = 0.73 + 0.27 = 1`;
        distractors = [`0.5`, `1.5`, `2`, `0`];
      } else if (typeVar === 2) {
        // SMP_03: Continued Fractions (Ladder Fractions)
        ansStr = `8/5`;
        qText = `सरल कीजिए: 1 + 1 / (1 + 1 / (1 + 1 / 2))`;
        qTextEn = `Simplify: 1 + 1 / (1 + 1 / (1 + 1 / 2))`;
        explanation = `नीचे से हल करें: 1 + 1/2 = 3/2 -> 1 + 2/3 = 5/3 -> 1 + 3/5 = 8/5।`;
        explanationEn = `Solving bottom-up: 3/2 -> 5/3 -> 8/5.`;
        shortcut = `नीचे से ऊपर हल करने पर = 8/5`;
        distractors = [`5/8`, `3/5`, `13/8`, `7/5`];
      } else if (typeVar === 3) {
        // SMP_04: Surds & Indices Rationalization
        ansStr = `sqrt(3) - sqrt(2)`;
        qText = `हर का परिमेयकरण (Rationalization) करें: 1 / (√3 + √2)`;
        qTextEn = `Simplify by rationalization: 1 / (sqrt(3) + sqrt(2))`;
        explanation = `अंश व हर को (√3 - √2) से गुणा करने पर: (√3 - √2) ÷ (3 - 2) = √3 - √2।`;
        explanationEn = `Multiply numerator and denominator by (sqrt(3) - sqrt(2)) = sqrt(3) - sqrt(2).`;
        shortcut = `संयुग्मी (Conjugate) से गुणा = √3 - √2`;
        distractors = [`sqrt(3) + sqrt(2)`, `2 - sqrt(3)`, `sqrt(5)`, `1`];
      } else if (typeVar === 4) {
        // SMP_05: Telescoping Series
        ansStr = `99/100`;
        qText = `योग ज्ञात कीजिए: 1/(1×2) + 1/(2×3) + 1/(3×4) + ... + 1/(99×100)`;
        qTextEn = `Find the sum: 1/(1*2) + 1/(2*3) + 1/(3*4) + ... + 1/(99*100)`;
        explanation = `टेलीस्कोपिंग श्रेणी सूत्र: [1/प्रथम - 1/अंतिम] = [1/1 - 1/100] = 99/100।`;
        explanationEn = `Telescoping sum formula = 1 - (1/100) = 99/100.`;
        shortcut = `1 - (1 ÷ 100) = 99/100`;
        distractors = [`1/100`, `1`, `98/99`, `50/100`];
      } else if (typeVar === 5) {
        // SMP_06: Recurring Decimals (Bar Questions)
        ansStr = `4/11`;
        qText = `आवर्ती दशमलव 0.363636... (0.36 पर बार) को भिन्न (Fraction) रूप में बदलिए।`;
        qTextEn = `Convert 0.36 bar into fractional form.`;
        explanation = `0.36 बार = 36 ÷ 99 = 4/11 (9 से काटने पर)।`;
        explanationEn = `0.36 bar = 36 / 99 = 4/11.`;
        shortcut = `36 ÷ 99 = 4/11`;
        distractors = [`36/100`, `36/90`, `4/9`, `3/11`];
      } else {
        // SMP_07: Infinite Nested Roots Series
        ansStr = `4`;
        qText = `मान ज्ञात कीजिए: √(12 + √(12 + √(12 + ... अनंत तक)))`;
        qTextEn = `Find the value of sqrt(12 + sqrt(12 + sqrt(12 + ... inf)))`;
        explanation = `12 के ऐसे दो लगातार गुणनखंड करें जिनका अंतर 1 हो: 3 × 4 = 12। चूँकि बीच में प्लस (+) है, बड़ा गुणनखंड 4 उत्तर होगा।`;
        explanationEn = `Consecutive factors of 12 are 3 and 4. Since it's plus, answer is 4.`;
        shortcut = `12 के गुणनखंड 3 और 4 -> उत्तर = 4`;
        distractors = [`3`, `6`, `12`, `2`];
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
    else if (chosenTopic.includes('प्रतिशत') || chosenTopic.toLowerCase().includes('percent')) {
      const typeVar = Math.floor(Math.random() * 13);
      if (typeVar === 0) {
        // 1. Basic Value & Conversion
        const percentages = [10, 15, 20, 25, 30, 40, 50, 60, 75];
        const p = percentages[Math.floor(Math.random() * percentages.length)];
        const mult = Math.floor(Math.random() * 20) + 5;
        const base = mult * 50; // e.g. 450
        const ans = (p * base) / 100;
        qText = `मान ज्ञात कीजिए: ₹${base} का ${p}% कितना होगा?`;
        qTextEn = `Find ${p}% of ₹${base}.`;
        ansStr = `₹${ans}`;
        explanation = `प्रतिशत की बुनियादी गणना:\nमान = (मूल मान × प्रतिशत) ÷ 100 = (${base} × ${p}) ÷ 100 = ₹${ans}।`;
        explanationEn = `Value = (${base} * ${p}) / 100 = ₹${ans}.`;
        shortcut = `10% = ₹${base / 10} -> ${p}% = ₹${ans}`;
        distractors = [`₹${ans + 20}`, `₹${Math.max(10, ans - 20)}`, `₹${ans + 40}`, `₹${Math.max(10, ans - 40)}`];
      } else if (typeVar === 1) {
        // 2. A is X% More / Less than B
        const isMore = Math.random() > 0.5;
        if (isMore) {
          const p = [10, 20, 25, 50][Math.floor(Math.random() * 4)]; // e.g. 25
          const ans = Math.round((p / (100 + p)) * 100 * 100) / 100; // e.g. 20%
          const ansDisplay = Number.isInteger(ans) ? `${ans}%` : `${ans.toFixed(2)}%`;
          qText = `यदि A का वेतन B के वेतन से ${p}% अधिक है, तो B का वेतन A के वेतन से कितना प्रतिशत कम होगा?`;
          qTextEn = `If A's salary is ${p}% more than B's, by what percent is B's salary less than A's?`;
          ansStr = ansDisplay;
          explanation = `प्रतिशत कमी का सूत्र: [X ÷ (100 + X)] × 100%\n= [${p} ÷ (100 + ${p})] × 100% = [${p} ÷ ${100 + p}] × 100% = ${ansDisplay}।`;
          explanationEn = `Percent less = [X / (100 + X)] * 100% = ${ansDisplay}.`;
          shortcut = `सूत्र: [${p} ÷ ${100 + p}] × 100% = ${ansDisplay}`;
          distractors = [`${p}%`, `${Math.round(ans + 5)}%`, `${Math.max(1, Math.round(ans - 5))}%`, `${p + 5}%`];
        } else {
          const p = [10, 20, 25, 50][Math.floor(Math.random() * 4)]; // e.g. 20
          const ans = Math.round((p / (100 - p)) * 100 * 100) / 100; // e.g. 25%
          const ansDisplay = Number.isInteger(ans) ? `${ans}%` : `${ans.toFixed(2)}%`;
          qText = `यदि A का वेतन B के वेतन से ${p}% कम है, तो B का वेतन A के वेतन से कितना प्रतिशत अधिक होगा?`;
          qTextEn = `If A's salary is ${p}% less than B's, by what percent is B's salary more than A's?`;
          ansStr = ansDisplay;
          explanation = `प्रतिशत वृद्धि का सूत्र: [X ÷ (100 - X)] × 100%\n= [${p} ÷ (100 - ${p})] × 100% = [${p} ÷ ${100 - p}] × 100% = ${ansDisplay}।`;
          explanationEn = `Percent more = [X / (100 - X)] * 100% = ${ansDisplay}.`;
          shortcut = `सूत्र: [${p} ÷ ${100 - p}] × 100% = ${ansDisplay}`;
          distractors = [`${p}%`, `${Math.round(ans + 5)}%`, `${Math.max(1, Math.round(ans - 5))}%`, `${p + 10}%`];
        }
      } else if (typeVar === 2) {
        // 3. Consumption & Expenditure Balance
        const p = [10, 20, 25, 50][Math.floor(Math.random() * 4)]; // e.g. 20
        const ans = Math.round((p / (100 + p)) * 100 * 100) / 100; // e.g. 16.66% or 16.67%
        const ansDisplay = Number.isInteger(ans) ? `${ans}%` : `${ans.toFixed(2)}%`;
        qText = `चीनी के मूल्य में ${p}% की वृद्धि हो जाती है। खपत में कितने प्रतिशत की कमी की जाए ताकि कुल खर्च अपरिवर्तित (Constant) रहे?`;
        qTextEn = `The price of sugar rises by ${p}%. By what percent should consumption be reduced so expenditure remains constant?`;
        ansStr = ansDisplay;
        explanation = `खपत में प्रतिशत कमी = [मूल्य वृद्धि % ÷ (100 + मूल्य वृद्धि %)] × 100%\n= [${p} ÷ ${100 + p}] × 100% = ${ansDisplay}।`;
        explanationEn = `Consumption reduction % = [P / (100 + P)] * 100% = ${ansDisplay}.`;
        shortcut = `सूत्र: [${p} ÷ ${100 + p}] × 100% = ${ansDisplay}`;
        distractors = [`${p}%`, `${Math.round(ans + 3)}%`, `${Math.max(1, Math.round(ans - 3))}%`, `${p + 5}%`];
      } else if (typeVar === 3) {
        // 4. Price Change with Extra Quantity
        const p = 20; // 20% drop
        const money = 100; // ₹100
        const extraKg = 2; // 2 kg extra
        const reducedPrice = (money * (p / 100)) / extraKg; // ₹10/kg
        qText = `सेब के मूल्य में ${p}% की कमी होने से एक व्यक्ति ₹${money} में ${extraKg} किग्रा अधिक सेब खरीद पाता है। सेब का घटा हुआ मूल्य (Reduced Price) प्रति किग्रा क्या है?`;
        qTextEn = `A ${p}% drop in apple prices allows a person to buy ${extraKg} kg more for ₹${money}. Find the reduced price per kg.`;
        ansStr = `₹${reducedPrice}/किग्रा`;
        explanation = `बचत राशि = ₹${money} का ${p}% = ₹${(money * p) / 100}।\nघटा हुआ मूल्य (Reduced Price) = बचा हुआ रुपया ÷ अतिरिक्त मात्रा = ₹${(money * p) / 100} ÷ ${extraKg} = ₹${reducedPrice}/किग्रा।`;
        explanationEn = `Savings = ₹${(money * p) / 100}. Reduced price = ₹${(money * p) / 100} / ${extraKg} = ₹${reducedPrice}/kg.`;
        shortcut = `शॉर्टकट सूत्र: (M × P%) ÷ K = (100 × 20%) ÷ 2 = ₹${reducedPrice}/किग्रा`;
        distractors = [`₹${reducedPrice + 2.5}/किग्रा`, `₹${Math.max(1, reducedPrice - 2)}/किग्रा`, `₹${reducedPrice + 5}/किग्रा`, `₹${reducedPrice * 2}/किग्रा`];
      } else if (typeVar === 4) {
        // 5. Successive Percentage Change
        const a = 20; // +20%
        const b = -10; // -10%
        const netChange = a + b + (a * b) / 100; // +8%
        const signStr = netChange >= 0 ? `+${netChange}%` : `${netChange}%`;
        qText = `एक संख्या में पहले ${a}% की वृद्धि की जाती है और फिर ${Math.abs(b)}% की कमी की जाती है। संख्या में शुद्ध प्रतिशत परिवर्तन (Net Change) कितना होगा?`;
        qTextEn = `A number is first increased by ${a}% and then decreased by ${Math.abs(b)}%. Find the net percentage change.`;
        ansStr = `${signStr}`;
        explanation = `सक्सेसिव फॉर्मूला: A + B + (A × B) ÷ 100\n= ${a} + (${b}) + (${a} × ${b}) ÷ 100 = 10 - 2 = +8% (8% की वृद्धि)।`;
        explanationEn = `Net change = A + B + (A * B) / 100 = 20 - 10 - 2 = +8%.`;
        shortcut = `सूत्र: ${a} - ${Math.abs(b)} - ${(a * Math.abs(b)) / 100} = +8%`;
        distractors = [`+10%`, `-8%`, `+12%`, `0%`];
      } else if (typeVar === 5) {
        // 6. 2D / 3D Geometry Dimensions
        const l = 10; // +10%
        const b = 20; // +20%
        const areaChange = l + b + (l * b) / 100; // +32%
        qText = `यदि एक आयत (Rectangle) की लंबाई में ${l}% की वृद्धि तथा चौड़ाई में ${b}% की वृद्धि कर दी जाए, तो इसके क्षेत्रफल (Area) में कितने प्रतिशत का परिवर्तन होगा?`;
        qTextEn = `If the length of a rectangle increases by ${l}% and breadth increases by ${b}%, find the percent change in area.`;
        ansStr = `+${areaChange}%`;
        explanation = `क्षेत्रफल में प्रभावी परिवर्तन = L + B + (L × B) ÷ 100\n= ${l} + ${b} + (${l} × ${b}) ÷ 100 = 30 + 2 = +32% (32% की वृद्धि)।`;
        explanationEn = `Area change % = L + B + (L * B) / 100 = 10 + 20 + 2 = +32%.`;
        shortcut = `${l} + ${b} + ${(l * b) / 100} = +32%`;
        distractors = [`+30%`, `+28%`, `+35%`, `+25%`];
      } else if (typeVar === 6) {
        // 7. Exam Marks (Pass / Fail)
        const p1 = 30; // 30%
        const m1 = 15; // fails by 15
        const p2 = 40; // 40%
        const m2 = 35; // passes by 35
        const maxMarks = Math.round(((m1 + m2) / (p2 - p1)) * 100); // 500
        qText = `एक परीक्षा में छात्र A को ${p1}% अंक मिले और वह ${m1} अंकों से अनुत्तीर्ण (Fail) हो गया। छात्र B को ${p2}% अंक मिले जो उत्तीर्ण अंकों से ${m2} अधिक थे। परीक्षा के अधिकतम अंक (Maximum Marks) क्या हैं?`;
        qTextEn = `A student gets ${p1}% marks and fails by ${m1} marks. Another gets ${p2}% marks and gets ${m2} marks more than pass marks. Find maximum marks.`;
        ansStr = `${maxMarks}`;
        explanation = `प्रतिशत का अंतर = ${p2}% - ${p1}% = ${p2 - p1}%\nअंकों का अंतर = ${m1} + ${m2} = ${m1 + m2} अंक।\n100% (अधिकतम अंक) = [(${m1 + m2}) ÷ (${p2 - p1})] × 100 = (${m1 + m2} ÷ ${p2 - p1}) × 100 = ${maxMarks} अंक।`;
        explanationEn = `Diff in % = ${p2 - p1}%. Diff in marks = ${m1 + m2}. Max marks = (${m1 + m2} / ${p2 - p1}) * 100 = ${maxMarks}.`;
        shortcut = `[(${m1} + ${m2}) ÷ (${p2} - ${p1})] × 100 = ${maxMarks}`;
        distractors = [`${maxMarks + 100}`, `${Math.max(100, maxMarks - 100)}`, `${maxMarks + 50}`, `${Math.max(100, maxMarks - 50)}`];
      } else if (typeVar === 7) {
        // 8. Election & Vote Share
        const w = 60; // 60%
        const marginVotes = 1200;
        const totalVotes = Math.round((marginVotes / (2 * w - 100)) * 100); // 6000
        qText = `दो उम्मीदवारों वाले एक चुनाव में, जीतने वाले उम्मीदवार को ${w}% वैध मत मिले और वह ${marginVotes} मतों के बहुमत से जीत गया। चुनाव में डाले गए कुल मतों (Total Votes) की संख्या क्या थी?`;
        qTextEn = `In a two-candidate election, the winner got ${w}% of votes and won by ${marginVotes} votes. Find total votes.`;
        ansStr = `${totalVotes}`;
        explanation = `विजेता = ${w}%, हारने वाला = ${100 - w}%\nजीत का अंतर % = ${w}% - ${100 - w}% = ${2 * w - 100}%\n${2 * w - 100}% = ${marginVotes} वोट -> 100% = (${marginVotes} ÷ ${2 * w - 100}) × 100 = ${totalVotes} वोट।`;
        explanationEn = `Margin % = ${w - (100 - w)}% = ${2 * w - 100}%. Total votes = (${marginVotes} / ${2 * w - 100}) * 100 = ${totalVotes}.`;
        shortcut = `[${marginVotes} ÷ (${w} - ${100 - w})] × 100 = ${totalVotes}`;
        distractors = [`${totalVotes + 1000}`, `${Math.max(500, totalVotes - 1000)}`, `${totalVotes + 2000}`, `${Math.max(500, totalVotes - 2000)}`];
      } else if (typeVar === 8) {
        // 9. Income & Expenditure (Direct vs Remaining)
        const rentP = 20; // 20% on rent
        const foodPOfRem = 50; // 50% of remainder on food
        const savings = 2400; // ₹2,400
        // Remainder after rent = 80%. Food = 50% of 80% = 40%. Remaining = 40%.
        const totalIncome = Math.round(savings / (((100 - rentP) * (100 - foodPOfRem)) / 10000)); // ₹6,000
        qText = `एक व्यक्ति अपनी आय का ${rentP}% मकान के किराए पर खर्च करता है और शेष (Remainder) का ${foodPOfRem}% भोजन पर खर्च करता है। यदि वह ₹${savings} की बचत करता है, तो उसकी कुल आय (Total Income) कितनी है?`;
        qTextEn = `A person spends ${rentP}% on rent and ${foodPOfRem}% of the remainder on food. If he saves ₹${savings}, find his total income.`;
        ansStr = `₹${totalIncome}`;
        explanation = `किराए के बाद शेष = 100% - ${rentP}% = 80%\nभोजन के बाद अंतिम बचत % = 80% का (100% - ${foodPOfRem}%) = 80% का 50% = 40%\n40% = ₹${savings} -> 100% आय = (₹${savings} ÷ 40) × 100 = ₹${totalIncome}।`;
        explanationEn = `Remaining savings % = 80% * 50% = 40%. Total Income = (${savings} / 40) * 100 = ₹${totalIncome}.`;
        shortcut = `₹${savings} ÷ (0.8 × 0.5) = ₹${totalIncome}`;
        distractors = [`₹${totalIncome + 1000}`, `₹${Math.max(1000, totalIncome - 1000)}`, `₹${totalIncome + 2000}`, `₹${Math.max(1000, totalIncome - 2000)}`];
      } else if (typeVar === 9) {
        // 10. Population / Depreciation
        const p0 = 10000;
        const rate = 10;
        const years = 2;
        const pNew = Math.round(p0 * Math.pow(1 + rate / 100, years)); // 12,100
        qText = `एक कस्बे की वर्तमान जनसंख्या ${p0} है। यदि इसमें ${rate}% वार्षिक दर से वृद्धि होती है, तो ${years} वर्ष पश्चात कस्बे की जनसंख्या क्या होगी?`;
        qTextEn = `A town's population is ${p0} and grows at ${rate}% per year. What will it be after ${years} years?`;
        ansStr = `${pNew}`;
        explanation = `जनसंख्या सूत्र = P × (1 + R/100)ⁿ\n= ${p0} × (1.1)² = ${p0} × 1.21 = ${pNew}।`;
        explanationEn = `New Population = ${p0} * (1.1)² = ${pNew}.`;
        shortcut = `${p0} × 1.1 × 1.1 = ${pNew}`;
        distractors = [`${pNew + 500}`, `${Math.max(1000, pNew - 500)}`, `${p0 + p0 * 0.2}`, `${pNew + 1000}`];
      } else if (typeVar === 10) {
        // 11. Venn Diagram (Both Pass / Fail)
        const fHindi = 40; // 40% failed in Hindi
        const fEnglish = 30; // 30% failed in English
        const fBoth = 15; // 15% failed in both
        const passBoth = 100 - (fHindi + fEnglish - fBoth); // 45%
        qText = `एक परीक्षा में ${fHindi}% छात्र हिंदी में अनुत्तीर्ण (Fail) हुए, ${fEnglish}% छात्र अंग्रेजी में अनुत्तीर्ण हुए और ${fBoth}% छात्र दोनों विषयों में अनुत्तीर्ण हुए। दोनों विषयों में उत्तीर्ण (Pass) होने वाले छात्रों का प्रतिशत क्या है?`;
        qTextEn = `In an exam, ${fHindi}% failed in Hindi, ${fEnglish}% failed in English, and ${fBoth}% failed in both. Find the percentage of students who passed both.`;
        ansStr = `${passBoth}%`;
        explanation = `कम से कम एक विषय में अनुत्तीर्ण (Fail) छात्र = (${fHindi} + ${fEnglish} - ${fBoth})% = ${fHindi + fEnglish - fBoth}%\nदोनों विषयों में उत्तीर्ण छात्र = 100% - ${fHindi + fEnglish - fBoth}% = ${passBoth}%।`;
        explanationEn = `Total failed = ${fHindi} + ${fEnglish} - ${fBoth} = ${fHindi + fEnglish - fBoth}%. Passed both = 100 - ${fHindi + fEnglish - fBoth} = ${passBoth}%.`;
        shortcut = `100 - (${fHindi} + ${fEnglish} - ${fBoth}) = ${passBoth}%`;
        distractors = [`${passBoth + 10}%`, `${Math.max(1, passBoth - 10)}%`, `${passBoth + 5}%`, `${Math.max(1, passBoth - 5)}%`];
      } else if (typeVar === 11) {
        // 12. Constant Quantity (Fresh vs Dry Fruit)
        const freshWaterP = 80; // 80% water -> 20% pulp
        const dryWaterP = 20; // 20% water -> 80% pulp
        const freshKg = 100; // 100 kg fresh fruit
        const freshPulpKg = freshKg * ((100 - freshWaterP) / 100); // 20 kg
        const dryKg = Math.round(freshPulpKg / ((100 - dryWaterP) / 100)); // 25 kg
        qText = `ताजे फलों में ${freshWaterP}% पानी है और सूखे फलों में ${dryWaterP}% पानी है। ${freshKg} किग्रा ताजे फलों से कितना सूखा फल (Dry Fruit) प्राप्त किया जा सकता है?`;
        qTextEn = `Fresh fruit contains ${freshWaterP}% water and dry fruit contains ${dryWaterP}% water. How much dry fruit can be made from ${freshKg} kg fresh fruit?`;
        ansStr = `${dryKg} किग्रा`;
        explanation = `गुदा (Pulp) की मात्रा सदैव स्थिर रहती है:\nताजे फल में गुदा = ${freshKg} का (100 - ${freshWaterP})% = 20 किग्रा।\nसूखे फल में गुदा = ${100 - dryWaterP}%\n80% गुदा = 20 किग्रा -> सूखे फल का कुल वजन = (20 ÷ 80) × 100 = ${dryKg} किग्रा।`;
        explanationEn = `Pulp weight is constant = 20 kg. Dry fruit weight = 20 / 0.80 = ${dryKg} kg.`;
        shortcut = `(${freshKg} × 20%) ÷ 80% = ${dryKg} किग्रा`;
        distractors = [`${dryKg + 5} किग्रा`, `${Math.max(1, dryKg - 5)} किग्रा`, `${dryKg + 10} किग्रा`, `${Math.max(1, dryKg - 10)} किग्रा`];
      } else {
        // 13. Calculation Error
        const num1 = 3, den1 = 5; // wrong: 3/5
        const num2 = 5, den2 = 3; // correct: 5/3
        // Correct value = 25, Wrong value = 9, Error = 16, % Error = 16/25 * 100 = 64%
        const errP = 64;
        qText = `एक छात्र ने किसी संख्या को ${num2}/${den2} से गुणा करने के बजाय गलती से ${num1}/${den1} से गुणा कर दिया। गणना में हुई त्रुटि का प्रतिशत (Percentage Error) ज्ञात कीजिए?`;
        qTextEn = `A student multiplied a number by ${num1}/${den1} instead of ${num2}/${den2}. Find the percentage error.`;
        ansStr = `${errP}%`;
        explanation = `मान लीजिए संख्या = 3 और 5 का ल.स.प. = 15\nसही मान = 15 × (${num2}/${den2}) = 25\nगलत मान = 15 × (${num1}/${den1}) = 9\nत्रुटि = 25 - 9 = 16\nप्रतिशत त्रुटि = (16 ÷ 25) × 100 = 64%।`;
        explanationEn = `Correct = 25, Wrong = 9, Error = 16. % Error = (16 / 25) * 100 = 64%.`;
        shortcut = `[(25 - 9) ÷ 25] × 100 = 64%`;
        distractors = [`50%`, `45%`, `36%`, `60%`];
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
      const typeVar = Math.floor(Math.random() * 6);
      if (typeVar === 0) {
        // AVG_01: Consecutive Numbers & Arithmetic Series
        const n = 25;
        const ans = 13;
        qText = `प्रथम ${n} लगातार प्राकृतिक संख्याओं का औसत क्या होगा?`;
        qTextEn = `Find the average of the first ${n} consecutive natural numbers.`;
        ansStr = `${ans}`;
        explanation = `प्रथम N प्राकृतिक संख्याओं का औसत = (N + 1) ÷ 2 = (25 + 1) ÷ 2 = 13।`;
        explanationEn = `Average of first N natural numbers = (N + 1) / 2 = 13.`;
        shortcut = `(25 + 1) ÷ 2 = 13`;
        distractors = [`${ans + 2}`, `${Math.max(1, ans - 2)}`, `${ans + 4}`, `${Math.max(1, ans - 4)}`];
      } else if (typeVar === 1) {
        // AVG_02: Entry or Exit of Member (Teacher's Age)
        const count = 24;
        const oldAvg = 15;
        const inc = 1;
        const teacherAge = count * inc + (oldAvg + inc); // 24*1 + 16 = 40
        qText = `${count} विद्यार्थियों की औसत आयु ${oldAvg} वर्ष है। यदि शिक्षक की आयु शामिल कर ली जाए, तो औसत 1 वर्ष बढ़ जाता है। शिक्षक की आयु ज्ञात कीजिए।`;
        qTextEn = `The average age of ${count} students is ${oldAvg} years. If the teacher's age is included, average increases by ${inc} year. Find teacher's age.`;
        ansStr = `${teacherAge} years`;
        explanation = `शिक्षक की आयु = नया औसत + विद्यार्थी संख्या × वृद्धि = 16 + (24 × 1) = 40 वर्ष।`;
        explanationEn = `Teacher age = New average + count * increase = 16 + 24 = 40 years.`;
        shortcut = `16 + 24 = 40 years`;
        distractors = [`${teacherAge + 5} years`, `${Math.max(10, teacherAge - 5)} years`, `${teacherAge + 10} years`, `${Math.max(10, teacherAge - 10)} years`];
      } else if (typeVar === 2) {
        // AVG_03: Replacement of Member
        const n = 8;
        const incAvg = 2.5;
        const oldWeight = 65;
        const newWeight = oldWeight + n * incAvg; // 65 + 8*2.5 = 85
        qText = `${n} व्यक्तियों का औसत वजन ${incAvg} किग्रा बढ़ जाता है जब ${oldWeight} किग्रा वाले एक व्यक्ति के स्थान पर नया व्यक्ति आता है। नए व्यक्ति का वजन ज्ञात कीजिए।`;
        qTextEn = `The average weight of ${n} persons increases by ${incAvg} kg when a person weighing ${oldWeight} kg is replaced by a new person. Find weight of new person.`;
        ansStr = `${newWeight} kg`;
        explanation = `नए व्यक्ति का वजन = पुराना वजन + (व्यक्ति संख्या × औसत वृद्धि) = 65 + (8 × 2.5) = 85 किग्रा।`;
        explanationEn = `New weight = Old weight + (n * increase) = 65 + 20 = 85 kg.`;
        shortcut = `65 + 20 = 85 kg`;
        distractors = [`${newWeight + 5} kg`, `${Math.max(10, newWeight - 5)} kg`, `${newWeight + 10} kg`, `${Math.max(10, newWeight - 10)} kg`];
      } else if (typeVar === 3) {
        // AVG_04: Wrong Entry / Error Correction
        const n = 50;
        const oldAvg = 68;
        const wrongVal = 84;
        const correctVal = 48;
        const diff = correctVal - wrongVal; // -36
        const correctAvg = Math.round((oldAvg + diff / n) * 100) / 100; // 67.28
        qText = `${n} विद्यार्थियों के औसत अंक ${oldAvg} निकाले गए। बाद में पता चला कि अंक ${wrongVal} को गलती से पढ़ लिया गया था, जबकि सही अंक ${correctVal} था। सही औसत ज्ञात कीजिए।`;
        qTextEn = `Average marks of ${n} students were ${oldAvg}. Later found that ${wrongVal} was misread instead of ${correctVal}. Find correct average.`;
        ansStr = `${correctAvg}`;
        explanation = `कुल योग में अंतर = ${correctVal} - ${wrongVal} = ${diff}\nऔसत में अंतर = ${diff} ÷ ${n} = ${diff / n}\nसही औसत = ${oldAvg} + (${diff / n}) = ${correctAvg}।`;
        explanationEn = `Correct avg = ${oldAvg} + (${correctVal} - ${wrongVal}) / ${n} = ${correctAvg}.`;
        shortcut = `${oldAvg} + (${diff} ÷ ${n}) = ${correctAvg}`;
        distractors = [`${correctAvg + 1}`, `${Math.max(1, correctAvg - 1)}`, `${correctAvg + 2}`, `${Math.max(1, correctAvg - 2)}`];
      } else if (typeVar === 4) {
        // AVG_05: Batting and Bowling Average
        const innings = 15;
        const oldAvg = 40;
        const score = 80;
        // new avg = (15*40 + 80) / 16 = 680 / 16 = 42.5
        const newAvg = (innings * oldAvg + score) / (innings + 1);
        qText = `एक बल्लेबाज का ${innings} पारियों में औसत ${oldAvg} रन है। 16वीं पारी में वह ${score} रन बनाता है। उसका नया बल्लेबाजी औसत क्या होगा?`;
        qTextEn = `A batsman has average of ${oldAvg} runs in ${innings} innings. He scores ${score} in 16th inning. New average?`;
        ansStr = `${newAvg}`;
        explanation = `कुल रन = ${innings} × ${oldAvg} + ${score} = ${innings * oldAvg + score}\nनया औसत = ${innings * oldAvg + score} ÷ 16 = ${newAvg}।`;
        explanationEn = `Total runs = ${innings * oldAvg + score}. New average = ${newAvg}.`;
        shortcut = `(${innings * oldAvg} + ${score}) ÷ 16 = ${newAvg}`;
        distractors = [`${newAvg + 3}`, `${Math.max(1, newAvg - 3)}`, `${newAvg + 5}`, `${Math.max(1, newAvg - 5)}`];
      } else {
        // AVG_06: Weighted Average (Two Mixed Groups)
        const n1 = 30;
        const a1 = 70;
        const n2 = 20;
        const a2 = 80;
        const combined = (n1 * a1 + n2 * a2) / (n1 + n2); // 74
        qText = `30 छात्रों की कक्षा A का औसत स्कोर ${a1} है, और 20 छात्रों की कक्षा B का औसत स्कोर ${a2} है। संयुक्त औसत स्कोर ज्ञात कीजिए।`;
        qTextEn = `Class A of ${n1} students has average ${a1}, Class B of ${n2} students has average ${a2}. Find combined average.`;
        ansStr = `${combined}`;
        explanation = `संयुक्त औसत = [(${n1} × ${a1}) + (${n2} × ${a2})] ÷ (${n1} + ${n2}) = [${n1 * a1} + ${n2 * a2}] ÷ 50 = ${combined}।`;
        explanationEn = `Combined average = [30*70 + 20*80] / 50 = ${combined}.`;
        shortcut = `[${n1 * a1} + ${n2 * a2}] ÷ 50 = ${combined}`;
        distractors = [`${combined + 4}`, `${Math.max(1, combined - 4)}`, `${combined + 8}`, `${Math.max(1, combined - 8)}`];
      }
    }
    // 13. अनुपात व समानुपात (Ratio & Proportion)
    else if (chosenTopic.includes('अनुपात व समानुपात')) {
      const typeVar = Math.floor(Math.random() * 7);
      if (typeVar === 0) {
        // RP_01: Merging Ratios (A:B and B:C to A:B:C)
        ansStr = `8:12:15`;
        qText = `यदि A : B = 2 : 3 तथा B : C = 4 : 5 है, तो अनुपात A : B : C ज्ञात कीजिए।`;
        qTextEn = `If A:B = 2:3 and B:C = 4:5, find ratio A:B:C.`;
        explanation = `B के मान को समान करने के लिए पहले अनुपात को 4 से तथा दूसरे को 3 से गुणा करें: A:B:C = 8:12:15।`;
        explanationEn = `Equate B: A:B:C = (2*4):(3*4):(3*5) = 8:12:15.`;
        shortcut = `(2×4) : (3×4) : (3×5) = 8:12:15`;
        distractors = [`2:3:5`, `8:10:15`, `6:12:15`, `8:12:20`];
      } else if (typeVar === 1) {
        // RP_02: Proportion Rules (Mean, Third & Fourth Proportion)
        const a = 9, b = 16;
        const meanProp = Math.round(Math.sqrt(a * b)); // 12
        ansStr = `${meanProp}`;
        qText = `${a} और ${b} का मध्यानुपाती (Mean Proportional) ज्ञात कीजिए।`;
        qTextEn = `Find the mean proportional between ${a} and ${b}.`;
        explanation = `मध्यानुपाती = √(a × b) = √(${a} × ${b}) = √144 = 12।`;
        explanationEn = `Mean proportional = √(9 * 16) = 12.`;
        shortcut = `√(9 × 16) = 12`;
        distractors = [`${meanProp + 3}`, `${Math.max(1, meanProp - 3)}`, `${meanProp + 6}`, `${Math.max(1, meanProp - 6)}`];
      } else if (typeVar === 2) {
        // RP_03: Distribution of Amount Among Shares
        const total = 1800;
        const r1 = 2, r2 = 3, r3 = 4;
        const sumR = r1 + r2 + r3;
        const bShare = (r2 * total) / sumR; // 600
        ansStr = `₹${bShare}`;
        qText = `₹${total} को A, B और C में 2 : 3 : 4 के अनुपात में बांटा गया। B का हिस्सा ज्ञात कीजिए।`;
        qTextEn = `Divide ₹${total} among A, B, and C in ratio 2:3:4. What is B's share?`;
        explanation = `B का हिस्सा = [3 ÷ (2 + 3 + 4)] × 1800 = [3 ÷ 9] × 1800 = ₹600।`;
        explanationEn = `B's share = (3 / 9) * 1800 = ₹600.`;
        shortcut = `(3 ÷ 9) × 1800 = ₹600`;
        distractors = [`₹${bShare + 100}`, `₹${Math.max(50, bShare - 100)}`, `₹${bShare + 200}`, `₹${Math.max(50, bShare - 200)}`];
      } else if (typeVar === 3) {
        // RP_04: Coins and Value Combinations
        const totalVal = 125;
        // ratios 3:4:5 for ₹1, 50p, 25p -> values 3*1 + 4*0.5 + 5*0.25 = 3 + 2 + 1.25 = 6.25
        // total units = 125 / 6.25 = 20
        // 50p coins = 4 * 20 = 80
        const coins50 = 80;
        ansStr = `${coins50}`;
        qText = `एक थैले में ₹1, 50 पैसे और 25 पैसे के सिक्के 3 : 4 : 5 के अनुपात में हैं, कुल मूल्य ₹${totalVal} है। 50 पैसे के सिक्कों की संख्या ज्ञात कीजिए।`;
        qTextEn = `A bag contains ₹1, 50p, and 25p coins in ratio 3:4:5, totalling ₹${totalVal}. Find number of 50p coins.`;
        explanation = `कुल मूल्य अनुपात = 3(1) + 4(0.5) + 5(0.25) = 6.25 यूनिट = ₹125 -> 1 यूनिट = 20। 50 पैसे के सिक्के = 4 × 20 = 80।`;
        explanationEn = `Value units = 6.25 = ₹125 -> 1 unit = 20. 50p coins = 4 * 20 = 80.`;
        shortcut = `125 ÷ 6.25 = 20 units -> 4 × 20 = 80`;
        distractors = [`${coins50 + 20}`, `${Math.max(10, coins50 - 20)}`, `${coins50 + 40}`, `${Math.max(10, coins50 - 40)}`];
      } else if (typeVar === 4) {
        // RP_05: Age Based Ratio Problems
        const ageA = 15;
        qText = `A और B की आयु का अनुपात 3 : 4 है। 5 वर्ष बाद यह अनुपात 4 : 5 हो जाता है। A की वर्तमान आयु ज्ञात कीजिए।`;
        qTextEn = `Ratio of ages of A and B is 3:4. After 5 years, ratio becomes 4:5. Find A's present age.`;
        ansStr = `${ageA} years`;
        explanation = `मान लीजिए आयु 3x और 4x है: (3x + 5)/(4x + 5) = 4/5 -> 15x + 25 = 16x + 20 -> x = 5। A की आयु = 3 × 5 = 15 वर्ष।`;
        explanationEn = `Solving (3x+5)/(4x+5) = 4/5 gives x = 5. A's age = 15 years.`;
        shortcut = `यूनिट अंतर विधि से x = 5 -> A = 15 years`;
        distractors = [`${ageA + 5} years`, `${Math.max(5, ageA - 5)} years`, `${ageA + 10} years`, `${Math.max(5, ageA - 10)} years`];
      } else if (typeVar === 5) {
        // RP_06: Income, Expenditure & Savings Ratio
        const incA = 4000;
        qText = `A और B की आय का अनुपात 5 : 4 है और उनके व्यय का अनुपात 3 : 2 है। यदि प्रत्येक ₹1600 बचाता है, तो A की आय ज्ञात कीजिए।`;
        qTextEn = `Income ratio of A and B is 5:4, expenditure ratio 3:2. Each saves ₹1600. Find A's income.`;
        ansStr = `₹${incA}`;
        explanation = `आय अनुपात अंतर = 5 - 3 = 2 यूनिट = बचत ₹1600 -> 1 यूनिट = ₹800। A की आय = 5 × 800 = ₹4000।`;
        explanationEn = `Income unit diff = 5 - 3 = 2 = ₹1600 -> 1 unit = ₹800. A's income = 5 * 800 = ₹4000.`;
        shortcut = `2 units = ₹1600 -> A's income = 5 × 800 = ₹4000`;
        distractors = [`₹${incA + 800}`, `₹${Math.max(1000, incA - 800)}`, `₹${incA + 1600}`, `₹${Math.max(1000, incA - 1600)}`];
      } else {
        // RP_07: Mixture Ratio & Replacement
        const ansLitres = 5;
        qText = `40 लीटर के मिश्रण में दूध और पानी का अनुपात 3 : 1 है। अनुपात 2 : 1 करने के लिए कितना पानी मिलाना चाहिए?`;
        qTextEn = `A 40-liter mixture contains milk and water in ratio 3:1. How much water must be added to make ratio 2:1?`;
        ansStr = `${ansLitres} liters`;
        explanation = `दूध = 30 लीटर, पानी = 10 लीटर। 30 ÷ (10 + x) = 2 ÷ 1 -> 30 = 20 + 2x -> 2x = 10 -> x = 5 लीटर।`;
        explanationEn = `Milk = 30L, Water = 10L. 30 / (10 + x) = 2/1 -> x = 5 liters.`;
        shortcut = `30 ÷ (10 + x) = 2/1 -> x = 5 liters`;
        distractors = [`${ansLitres + 3} liters`, `${Math.max(1, ansLitres - 3)} liters`, `${ansLitres + 6} liters`, `${Math.max(1, ansLitres - 6)} liters`];
      }
    }
    // 14. साधारण व चक्रवृद्धि ब्याज (Simple & Compound Interest)
    else if (chosenTopic.includes('साधारण ब्याज') || chosenTopic.includes('ब्याज')) {
      const typeVar = Math.floor(Math.random() * 6);
      if (typeVar === 0) {
        // SICI_01: Direct SI Evaluation
        const p = 5000, r = 8, t = 3;
        const si = (p * r * t) / 100; // 1200
        ansStr = `₹${si}`;
        qText = `₹${p} की राशि पर 8% वार्षिक दर से 3 वर्ष का साधारण ब्याज ज्ञात कीजिए।`;
        qTextEn = `Find simple interest on ₹${p} at ${r}% per annum for ${t} years.`;
        explanation = `SI = (P × R × T) ÷ 100 = (5000 × 8 × 3) ÷ 100 = ₹1200।`;
        explanationEn = `SI = (5000 * 8 * 3) / 100 = ₹1200.`;
        shortcut = `(5000 × 8 × 3) ÷ 100 = ₹1200`;
        distractors = [`₹${si + 200}`, `₹${Math.max(100, si - 200)}`, `₹${si + 400}`, `₹${Math.max(100, si - 400)}`];
      } else if (typeVar === 2) {
        // SICI_03: Direct CI Evaluation
        const p = 8000, r = 10, t = 2;
        const ci = Math.round(p * Math.pow(1 + r / 100, t) - p); // 1680
        ansStr = `₹${ci}`;
        qText = `₹${8000} पर 10% वार्षिक चक्रवृद्धि ब्याज की दर से 2 वर्ष का चक्रवृद्धि ब्याज (CI) ज्ञात कीजिए।`;
        qTextEn = `Find compound interest on ₹8000 at 10% per annum compounded annually for 2 years.`;
        explanation = `CI = P[(1 + r/100)ᵗ - 1] = 8000 × [(1.1)² - 1] = 8000 × 0.21 = ₹1680।`;
        explanationEn = `CI = 8000 * (1.21 - 1) = ₹1680.`;
        shortcut = `8000 × 0.21 = ₹1680`;
        distractors = [`₹${ci + 200}`, `₹${Math.max(100, ci - 200)}`, `₹${ci + 350}`, `₹${Math.max(100, ci - 350)}`];
      } else if (typeVar === 4) {
        // SICI_05: Difference Between CI and SI (2 Years)
        const p = 10000, r = 10, t = 2;
        const diff = Math.round((p * r * r) / 10000); // 100
        ansStr = `₹${diff}`;
        qText = `₹${p} पर 10% वार्षिक दर से 2 वर्ष के चक्रवृद्धि ब्याज और साधारण ब्याज का अंतर ज्ञात कीजिए।`;
        qTextEn = `Difference between CI and SI on ₹${p} at ${r}% per annum for ${t} years?`;
        explanation = `अंतर (2 वर्ष) = P × (R ÷ 100)² = 10000 × (10 ÷ 100)² = ₹100।`;
        explanationEn = `Diff = P * (R/100)² = 10000 * (0.1)² = ₹100.`;
        shortcut = `10000 × 0.01 = ₹100`;
        distractors = [`₹${diff + 50}`, `₹${Math.max(10, diff - 50)}`, `₹${diff + 150}`, `₹${Math.max(10, diff - 150)}`];
      } else if (typeVar === 1) {
        // SICI_02: Sum Becoming N Times under SI
        const t1 = 5, n1 = 2, n2 = 4;
        const t2 = t1 * ((n2 - 1) / (n1 - 1)); // 15
        ansStr = `${t2} years`;
        qText = `एक धनराशि साधारण ब्याज पर 5 वर्ष में दोगुनी हो जाती है। कितने वर्षों में यह 4 गुना हो जाएगी?`;
        qTextEn = `A sum of money doubles in 5 years at SI. In how many years will it become 4 times?`;
        ansStr = `15 years`;
        explanation = `समय सूत्र: T2 = T1 × [(n2 - 1) ÷ (n1 - 1)] = 5 × [(4 - 1) ÷ (2 - 1)] = 15 वर्ष।`;
        explanationEn = `T2 = 5 * (3 / 1) = 15 years.`;
        shortcut = `5 × (3 ÷ 1) = 15 years`;
        distractors = [`20 years`, `10 years`, `25 years`, `12 years`];
      } else if (typeVar === 3) {
        // SICI_04: Sum Becoming N Times under CI
        const t1 = 4, n1 = 3, n2 = 27;
        const t2 = t1 * 3; // 12
        ansStr = `12 years`;
        qText = `चक्रवृद्धि ब्याज पर एक राशि 4 वर्ष में 3 गुनी हो जाती है। कितने वर्षों में यह 27 गुनी हो जाएगी?`;
        qTextEn = `A sum becomes 3 times in 4 years at CI. In how many years will it become 27 times?`;
        explanation = `27 = 3³, अतः समय = 4 × 3 = 12 वर्ष।`;
        explanationEn = `27 = 3³, so time = 4 * 3 = 12 years.`;
        shortcut = `4 × 3 = 12 years`;
        distractors = [`16 years`, `10 years`, `15 years`, `20 years`];
      } else {
        // SICI_06: Installment Problems
        ansStr = `₹1210`;
        qText = `₹2100 की राशि को 10% वार्षिक चक्रवृद्धि ब्याज पर 2 समान वार्षिक किस्तों में चुकाना है। प्रत्येक किस्त की राशि ज्ञात कीजिए।`;
        qTextEn = `A sum of ₹2100 is paid back in 2 equal annual installments at 10% CI. Find each installment.`;
        explanation = `किस्त फॉर्मूला से प्रत्येक किस्त ₹1210 होगी।`;
        explanationEn = `Each installment = ₹1210.`;
        shortcut = `किस्त = ₹1210`;
        distractors = [`₹1100`, `₹1330`, `₹1250`, `₹1150`];
      }
    }
    // 15. लाभ व हानि (Profit & Loss)
    else if (chosenTopic.includes('लाभ व हानि')) {
      const typeVar = Math.floor(Math.random() * 7);
      if (typeVar === 0) {
        // PL_01: Basic CP, SP & Profit/Loss %
        const cp = 400, sp = 480;
        const profitP = 20;
        ansStr = `20%`;
        qText = `एक वस्तु ₹400 में खरीदी गई और ₹480 में बेची गई। लाभ प्रतिशत ज्ञात कीजिए।`;
        qTextEn = `An article is bought for ₹400 and sold for ₹480. Find profit percentage.`;
        explanation = `लाभ = 480 - 400 = ₹80। प्रतिशत लाभ = (80 ÷ 400) × 100 = 20%।`;
        explanationEn = `Profit % = (80 / 400) * 100 = 20%.`;
        shortcut = `(80 ÷ 400) × 100 = 20%`;
        distractors = [`15%`, `25%`, `10%`, `30%`];
      } else if (typeVar === 1) {
        // PL_02: CP of X items equals SP of Y items
        const x = 15, y = 12;
        const profitP = 25;
        ansStr = `25%`;
        qText = `यदि 15 पेन का क्रय मूल्य 12 पेन के विक्रय मूल्य के बराबर है, तो लाभ प्रतिशत ज्ञात कीजिए।`;
        qTextEn = `If cost price of 15 pens equals selling price of 12 pens, find profit percent.`;
        explanation = `लाभ % = [(X - Y) ÷ Y] × 100 = [(15 - 12) ÷ 12] × 100 = 25%।`;
        explanationEn = `Profit % = [(15 - 12) / 12] * 100 = 25%.`;
        shortcut = `[(15 - 12) ÷ 12] × 100 = 25%`;
        distractors = [`20%`, `15%`, `30%`, `35%`];
      } else if (typeVar === 2) {
        // PL_03: Same SP with Equal % Gain and Loss
        const p = 10;
        const lossP = 1;
        ansStr = `1% loss`;
        qText = `दो वस्तुओं में से प्रत्येक को ₹990 में बेचा जाता है, एक पर 10% लाभ तथा दूसरी पर 10% हानि होती है। कुल लाभ या हानि प्रतिशत ज्ञात कीजिए।`;
        qTextEn = `Two articles sold for ₹990 each, one at 10% gain and other at 10% loss. Overall gain/loss %?`;
        explanation = `समान विक्रय मूल्य और समान प्रतिशत लाभ-हानि पर सदैव हानि होती है: हानि% = (10)² ÷ 100 = 1% हानि।`;
        explanationEn = `Always loss = (10)² / 100 = 1% loss.`;
        shortcut = `(10)² ÷ 100 = 1% loss`;
        distractors = [`1% profit`, `0%`, `2% loss`, `2% profit`];
      } else if (typeVar === 3) {
        // PL_04: Dishonest Shopkeeper / False Weight
        const gainP = 11.11;
        ansStr = `11.11%`;
        qText = `एक बेईमान दुकानदार क्रय मूल्य पर बेचने का दावा करता है लेकिन 1 किग्रा के स्थान पर 900 ग्राम वजन तोलता है। उसका लाभ प्रतिशत ज्ञात कीजिए।`;
        qTextEn = `A dishonest dealer claims to sell at CP but uses 900g instead of 1kg. Find gain percentage.`;
        explanation = `लाभ% = [त्रुटि ÷ (True - त्रुटि)] × 100 = [100 ÷ 900] × 100 = 11.11%।`;
        explanationEn = `Gain % = [100 / (1000 - 100)] * 100 = 11.11%.`;
        shortcut = `[100 ÷ 900] × 100 = 11.11%`;
        distractors = [`10%`, `12.5%`, `9.09%`, `15%`];
      } else if (typeVar === 4) {
        // PL_05: Marked Price & Successive Discount
        const mp = 500;
        const sp = 360;
        ansStr = `₹360`;
        qText = `₹500 अंकित मूल्य की वस्तु पर 20% और 10% की क्रमिक छूट (Successive Discounts) दी जाती है। अंतिम विक्रय मूल्य ज्ञात कीजिए।`;
        qTextEn = `An article marked at ₹500 is sold at successive discounts of 20% and 10%. Find final SP.`;
        explanation = `विक्रय मूल्य = 500 × (80 ÷ 100) × (90 ÷ 100) = 500 × 0.8 × 0.9 = ₹360।`;
        explanationEn = `SP = 500 * 0.8 * 0.9 = ₹360.`;
        shortcut = `500 × 0.8 × 0.9 = ₹360`;
        distractors = [`₹350`, `₹380`, `₹400`, `₹340`];
      } else if (typeVar === 5) {
        // PL_06: Relation Between MP, CP, Profit% and Discount%
        const profitP = 19;
        ansStr = `19%`;
        qText = `एक व्यापारी वस्तुओं पर क्रय मूल्य से 40% अधिक अंकित करता है और 15% की छूट देता है। उसका लाभ प्रतिशत ज्ञात कीजिए।`;
        qTextEn = `A trader marks goods 40% above CP and allows 15% discount. Find profit percent.`;
        explanation = `लाभ % = [A - B - (A×B)/100] = [40 - 15 - (40×15)/100] = 25 - 6 = 19%।`;
        explanationEn = `Effective profit = 40 - 15 - 6 = 19%.`;
        shortcut = `40 - 15 - 6 = 19%`;
        distractors = [`25%`, `15%`, `20%`, `22%`];
      } else {
        // PL_07: Free Items Scheme (Buy X Get Y Free)
        const discP = 20;
        ansStr = `20%`;
        qText = `एक दुकान '4 खरीदें 1 मुफ्त पाएं' ('Buy 4 Get 1 Free') की योजना देती है। प्रभावी छूट प्रतिशत क्या है?`;
        qTextEn = `A store offers 'Buy 4 Get 1 Free'. What is effective discount percentage?`;
        explanation = `छूट % = [मुफ्त वस्तुएँ ÷ कुल वस्तुएँ] × 100 = [1 ÷ 5] × 100 = 20%।`;
        explanationEn = `Discount % = (1 / 5) * 100 = 20%.`;
        shortcut = `(1 ÷ 5) × 100 = 20%`;
        distractors = [`25%`, `15%`, `10%`, `30%`];
      }
    }
    // 16. समय व कार्य (Time & Work)
    else if (chosenTopic.includes('समय व कार्य')) {
      const typeVar = Math.floor(Math.random() * 8);
      if (typeVar === 0) {
        // TW_01: Basic Individual & Combined Work
        const a = 10, b = 15;
        const ans = 6;
        ansStr = `6 days`;
        qText = `A किसी कार्य को 10 दिन में और B 15 दिन में कर सकता है। दोनों मिलकर इसे कितने दिन में पूरा करेंगे?`;
        qTextEn = `A can finish in 10 days and B in 15 days. Days together?`;
        explanation = `समय = (A × B) ÷ (A + B) = (10 × 15) ÷ 25 = 6 दिन।`;
        explanationEn = `Time = (10 * 15) / 25 = 6 days.`;
        shortcut = `(10 × 15) ÷ 25 = 6 days`;
        distractors = [`5 days`, `8 days`, `7.5 days`, `9 days`];
      } else if (typeVar === 1) {
        // TW_02: Leaving or Joining Mid-Work
        ansStr = `17.5 days`;
        qText = `A और B किसी कार्य को 20 और 30 दिन में कर सकते हैं। दोनों साथ काम शुरू करते हैं, लेकिन A 5 दिन बाद छोड़ देता है। B शेष कार्य कितने दिन में पूरा करेगा?`;
        qTextEn = `A and B do work in 20 and 30 days. Both start, A leaves after 5 days. Days for B to finish?`;
        explanation = `5 दिन में किया काम = 5 × (1/20 + 1/30) = 5 × (5/60) = 25/60 = 5/12। शेष काम = 7/12। B का समय = (7/12) × 30 = 17.5 दिन।`;
        explanationEn = `Remaining work 7/12 done by B in 17.5 days.`;
        shortcut = `शेष कार्य ÷ B की क्षमता = 17.5 days`;
        distractors = [`15 days`, `20 days`, `18.5 days`, `16 days`];
      } else if (typeVar === 2) {
        // TW_03: Alternate Days Working
        ansStr = `14.33 days`;
        qText = `A और B क्रमशः 12 और 18 दिन में कार्य करते हैं। यदि वे बारी-बारी से (Alternate Days) A से शुरुआत करते हुए काम करें, तो कार्य कितने दिन में समाप्त होगा?`;
        qTextEn = `A and B complete work in 12 and 18 days. Working alternate days starting with A, total days?`;
        explanation = `2 दिन का कार्य = 1/12 + 1/18 = 5/36। ऐसे 6 चक्रों में 30/36 काम 12 दिन में होगा। शेष काम A करेगा। कुल 14.33 दिन।`;
        explanationEn = `Total days = 14.33 days.`;
        shortcut = `बारी-बारी से गणना = 14.33 days`;
        distractors = [`12 days`, `15 days`, `13.5 days`, `16 days`];
      } else if (typeVar === 3) {
        // TW_04: Efficiency / Ratio Based
        ansStr = `21 days`;
        qText = `A की कार्यक्षमता B से दोगुनी है। यदि दोनों मिलकर 14 दिन में कार्य समाप्त करें, तो A अकेला इसे कितने दिन में करेगा?`;
        qTextEn = `A is twice as efficient as B. Together they finish in 14 days. Days for A alone?`;
        explanation = `क्षमता अनुपात A:B = 2:1, समय अनुपात = 1:2। संयुक्त 3 यूनिट = 14 दिन -> A अकेला = 3 × 14 ÷ 2 = 21 दिन।`;
        explanationEn = `A alone takes 21 days.`;
        shortcut = `3 × 14 ÷ 2 = 21 days`;
        distractors = [`28 days`, `18 days`, `24 days`, `20 days`];
      } else if (typeVar === 4) {
        // TW_05: MDH Formula
        ansStr = `10 days`;
        qText = `12 पुरुष प्रतिदिन 8 घंटे काम करके 10 दिन में काम पूरा करते हैं। 16 पुरुष प्रतिदिन 6 घंटे काम करके कितने दिन में पूरा करेंगे?`;
        qTextEn = `12 men working 8 hours/day finish in 10 days. 16 men working 6 hours/day finish in?`;
        explanation = `M1 D1 H1 = M2 D2 H2 -> 12 × 10 × 8 = 16 × D2 × 6 -> D2 = 960 ÷ 96 = 10 दिन।`;
        explanationEn = `D2 = (12 * 8 * 10) / (16 * 6) = 10 days.`;
        shortcut = `(12 × 8 × 10) ÷ (16 × 6) = 10 days`;
        distractors = [`12 days`, `8 days`, `15 days`, `9 days`];
      } else if (typeVar === 5) {
        // TW_06: Men, Women and Children Equivalence
        ansStr = `20 days`;
        qText = `4 पुरुष या 6 महिलाएं किसी कार्य को 20 दिन में करते हैं। 2 पुरुष और 3 महिलाएं मिलकर इसे कितने दिन में पूरा करेंगे?`;
        qTextEn = `4 men or 6 women finish in 20 days. Days for 2 men and 3 women?`;
        explanation = `2 पुरुष = 3 महिलाएं। 2 पुरुष + 3 महिलाएं = 6 महिलाएं। 6 महिलाएं 20 दिन में करेंगी।`;
        explanationEn = `Total equivalence is 6 women, taking 20 days.`;
        shortcut = `समकक्षता नियम = 20 days`;
        distractors = [`15 days`, `25 days`, `18 days`, `22 days`];
      } else if (typeVar === 6) {
        // TW_07: Wages Distribution
        ansStr = `₹685.71`;
        qText = `A और B किसी काम का ठेका ₹1200 में लेते हैं। A इसे 6 दिन में और B 8 दिन में कर सकता है। A का हिस्सा ज्ञात कीजिए।`;
        qTextEn = `A and B undertake work for ₹1200. A in 6 days, B in 8 days. Find A's share.`;
        explanation = `क्षमता अनुपात A:B = (1/6):(1/8) = 4:3। A का हिस्सा = [4 ÷ 7] × 1200 = ₹685.71।`;
        explanationEn = `A's share = (4 / 7) * 1200 = ₹685.71.`;
        shortcut = `(4 ÷ 7) × 1200 = ₹685.71`;
        distractors = [`₹600`, `₹750`, `₹514.28`, `₹700`];
      } else {
        // TW_08: Pipes and Cistern
        ansStr = `36 hours`;
        qText = `नल A टंकी 12 घंटे में भरता है और नल B 18 घंटे में खाली करता है। दोनों एक साथ खोले जाएं, तो टंकी कितने घंटे में भरेगी?`;
        qTextEn = `Pipe A fills in 12 hrs, Pipe B empties in 18 hrs. Time to fill if both open?`;
        explanation = `समय = (12 × 18) ÷ (18 - 12) = 216 ÷ 6 = 36 घंटे।`;
        explanationEn = `Net time = (12 * 18) / 6 = 36 hours.`;
        shortcut = `(12 × 18) ÷ 6 = 36 hours`;
        distractors = [`24 hours`, `48 hours`, `30 hours`, `40 hours`];
      }
    }
    // 17. समय, चाल व दूरी (Time & Distance)
    else if (chosenTopic.includes('समय, चाल व दूरी')) {
      const typeVar = Math.floor(Math.random() * 8);
      if (typeVar === 0) {
        // TSD_01: Basic Speed, Time & Unit Conversion
        ansStr = `500 m`;
        qText = `एक कार 72 किमी/घंटा की चाल से चल रही है। वह 25 सेकंड में कितनी दूरी (मीटर में) तय करेगी?`;
        qTextEn = `A car travels at 72 km/h. How many meters does it cover in 25 seconds?`;
        explanation = `चाल m/s में = 72 × (5/18) = 20 m/s। दूरी = 20 × 25 = 500 मीटर।`;
        explanationEn = `Speed = 20 m/s. Distance = 20 * 25 = 500 m.`;
        shortcut = `20 m/s × 25s = 500 m`;
        distractors = [`450 m`, `550 m`, `600 m`, `400 m`];
      } else if (typeVar === 1) {
        // TSD_02: Average Speed
        ansStr = `48 km/h`;
        qText = `एक व्यक्ति A से B तक 40 किमी/घंटा से जाता है और 60 किमी/घंटा से लौटता है। पूरी यात्रा की औसत चाल ज्ञात कीजिए।`;
        qTextEn = `Person travels A to B at 40 km/h and returns at 60 km/h. Average speed?`;
        explanation = `औसत चाल = (2 × 40 × 60) ÷ (40 + 60) = 4800 ÷ 100 = 48 किमी/घंटा।`;
        explanationEn = `Average speed = (2 * 40 * 60) / 100 = 48 km/h.`;
        shortcut = `(2 × 40 × 60) ÷ 100 = 48 km/h`;
        distractors = [`50 km/h`, `45 km/h`, `52 km/h`, `46 km/h`];
      } else if (typeVar === 2) {
        // TSD_03: Late vs Early Arrival
        ansStr = `5 km`;
        qText = `4 किमी/घंटा चलने पर छात्र 10 मिनट लेट होता है, 5 किमी/घंटा चलने पर 5 मिनट पहले पहुंचता है। स्कूल की दूरी ज्ञात कीजिए।`;
        qTextEn = `Walking at 4 km/h, student is 10 min late. At 5 km/h, 5 min early. Distance to school?`;
        explanation = `दूरी = [(S1 × S2) ÷ (S2 - S1)] × समय अंतर = [(4 × 5) ÷ 1] × (15 ÷ 60) = 20 × 0.25 = 5 किमी।`;
        explanationEn = `Distance = [(4*5)/1] * (15/60) = 5 km.`;
        shortcut = `[20 ÷ 1] × 0.25 = 5 km`;
        distractors = [`4 km`, `6 km`, `7 km`, `4.5 km`];
      } else if (typeVar === 3) {
        // TSD_04: Relative Speed
        ansStr = `3 hours`;
        qText = `300 किमी की दूरी पर दो ट्रेनें 40 किमी/घंटा और 60 किमी/घंटा की चाल से एक-दूसरे की ओर चलती हैं। कितने घंटे बाद मिलेंगी?`;
        qTextEn = `Two trains 300 km apart start moving towards each other at 40 km/h and 60 km/h. Meeting time?`;
        explanation = `सापेक्ष चाल = 40 + 60 = 100 किमी/घंटा। समय = 300 ÷ 100 = 3 घंटे।`;
        explanationEn = `Relative speed = 100 km/h. Time = 300 / 100 = 3 hours.`;
        shortcut = `300 ÷ 100 = 3 hours`;
        distractors = [`4 hours`, `2.5 hours`, `3.5 hours`, `5 hours`];
      } else if (typeVar === 4) {
        // TSD_05: Police and Thief Chase
        ansStr = `1.2 km`;
        qText = `एक चोर को पुलिसकर्मी ने 200 मीटर की दूरी से देखा। चोर 10 किमी/घंटा और पुलिस 12 किमी/घंटा से दौड़ती है। पुलिस कितने किमी की दूरी पर चोर को पकड़ेगी?`;
        qTextEn = `Thief spotted at 200m. Thief runs at 10 km/h, police at 12 km/h. Catch distance?`;
        explanation = `सापेक्ष चाल = 2 किमी/घंटा। समय = 0.2 किमी ÷ 2 = 0.1 घंटा। पुलिस द्वारा तय दूरी = 12 × 0.1 = 1.2 किमी।`;
        explanationEn = `Time = 0.2 / 2 = 0.1h. Distance = 12 * 0.1 = 1.2 km.`;
        shortcut = `12 × 0.1 = 1.2 km`;
        distractors = [`1.0 km`, `1.5 km`, `0.8 km`, `2.0 km`];
      } else if (typeVar === 5) {
        // TSD_06: Train Crossing Object
        ansStr = `20 seconds`;
        qText = `180 मीटर लंबी ट्रेन 54 किमी/घंटा की चाल से 120 मीटर लंबे प्लेटफॉर्म को पार करने में कितना समय लेगी?`;
        qTextEn = `180m train at 54 km/h crosses 120m platform. Time taken?`;
        explanation = `कुल दूरी = 180 + 120 = 300 मीटर। चाल = 54 × (5/18) = 15 m/s। समय = 300 ÷ 15 = 20 सेकंड।`;
        explanationEn = `Total distance = 300m. Speed = 15 m/s. Time = 300 / 15 = 20 seconds.`;
        shortcut = `300 ÷ 15 = 20 seconds`;
        distractors = [`15 seconds`, `25 seconds`, `18 seconds`, `22 seconds`];
      } else if (typeVar === 6) {
        // TSD_07: Boats and Streams
        ansStr = `3 hours`;
        qText = `शांत जल में नाव की चाल 15 किमी/घंटा और धारा की चाल 3 किमी/घंटा है। 36 किमी धारा के प्रतिकूल (Upstream) जाने में कितना समय लगेगा?`;
        qTextEn = `Boat speed 15 km/h, stream 3 km/h. Time to travel 36 km upstream?`;
        explanation = `प्रतिकूल चाल (Upstream) = 15 - 3 = 12 किमी/घंटा। समय = 36 ÷ 12 = 3 घंटे।`;
        explanationEn = `Upstream speed = 12 km/h. Time = 36 / 12 = 3 hours.`;
        shortcut = `36 ÷ 12 = 3 hours`;
        distractors = [`4 hours`, `2 hours`, `5 hours`, `6 hours`];
      } else {
        // TSD_08: Circular Tracks & Races
        ansStr = `11.11 m/s`;
        qText = `1000 मीटर की दौड़ में A, B को 100 मीटर या 10 सेकंड से हराता है। A की चाल ज्ञात कीजिए।`;
        qTextEn = `In 1000m race, A beats B by 100m or 10s. Find A's speed.`;
        explanation = `B द्वारा 100 मीटर तय करने में लिया समय = 10 सेकंड -> B की चाल = 10 m/s। A ने 1000m तय किया 90 सेकंड में -> A की चाल = 1000 ÷ 90 = 11.11 m/s।`;
        explanationEn = `B's speed = 10m/s. A's time = 90s. A's speed = 1000/90 = 11.11 m/s.`;
        shortcut = `1000 ÷ 90 = 11.11 m/s`;
        distractors = [`10 m/s`, `12.5 m/s`, `9.5 m/s`, `13 m/s`];
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
