// Unit checks for the eligibility age calculator. Run: npm run test:eligibility
import assert from 'node:assert/strict';
import { ageOn, diffYMD, minusYears, checkExam, type Profile } from './eligibility';
import { EXAMS } from '../data/eligibility';

const exam = (id: string) => EXAMS.find(e => e.id === id)!;
const P = (o: Partial<Profile>): Profile => ({ dob: '2005-01-01', qual: '12', gender: 'M', category: 'GEN', esm: false, ...o });
let n = 0;
const ok = (name: string, fn: () => void) => { fn(); n++; console.log('✓', name); };

ok('age on same day = exact years', () => assert.deepEqual(ageOn('2003-01-01', '2026-01-01'), { y: 23, m: 0, d: 0 }));
ok('age one day before birthday', () => assert.deepEqual(ageOn('2003-01-02', '2026-01-01'), { y: 22, m: 11, d: 30 }));
ok('age across month end', () => assert.deepEqual(diffYMD('2006-05-10', '2026-08-01'), { y: 20, m: 2, d: 22 }));
ok('leap-day birthday: 21 on 1 March of a non-leap year', () => assert.deepEqual(ageOn('2004-02-29', '2025-03-01'), { y: 21, m: 0, d: 0 }));
ok('leap-day birthday: still 20 on 28 Feb', () => assert.deepEqual(ageOn('2004-02-29', '2025-02-28'), { y: 20, m: 11, d: 30 }));
ok('minusYears handles 29 Feb', () => assert.equal(minusYears('2004-02-29', 1), '2003-02-28'));

// SSC GD 2026: born 02-01-2003 … 01-01-2008
ok('SSC GD: DOB exactly at upper boundary (02-01-2003) is eligible', () => assert.equal(checkExam(exam('ssc_gd'), P({ dob: '2003-01-02', qual: '10' }), '2026-10-24').status, 'yes'));
ok('SSC GD: one day older (01-01-2003) is not', () => assert.equal(checkExam(exam('ssc_gd'), P({ dob: '2003-01-01', qual: '10' }), '2026-10-24').status, 'no'));
ok('SSC GD: DOB exactly at lower boundary (01-01-2008) is eligible', () => assert.equal(checkExam(exam('ssc_gd'), P({ dob: '2008-01-01', qual: '10' }), '2026-10-24').status, 'yes'));
ok('SSC GD: one day younger (02-01-2008) is not', () => assert.equal(checkExam(exam('ssc_gd'), P({ dob: '2008-01-02', qual: '10' }), '2026-10-24').status, 'no'));
ok('SSC GD: OBC +3 makes 02-01-2000 eligible', () => assert.equal(checkExam(exam('ssc_gd'), P({ dob: '2000-01-02', qual: '10', category: 'OBC' }), '2026-10-24').status, 'yes'));
ok('SSC GD: Gen 02-01-2000 is 3 years over', () => {
  const r = checkExam(exam('ssc_gd'), P({ dob: '2000-01-02', qual: '10' }), '2026-10-24');
  assert.equal(r.status, 'no');
  assert.match(r.reasons[0], /उम्र 3 साल ज़्यादा/);
});
ok('qualification: CGL needs graduation', () => {
  const r = checkExam(exam('ssc_cgl'), P({ dob: '2002-01-15', qual: '12' }), '2026-10-24');
  assert.equal(r.status, 'no');
  assert.ok(r.reasons.some(x => x.includes('ग्रेजुएशन')));
});
ok('CGL bands: 29-year-old Gen meets 20-30/18-30/18-32 posts, not 18-27', () => {
  const r = checkExam(exam('ssc_cgl'), P({ dob: '1997-06-01', qual: 'grad' }), '2026-10-24');
  assert.equal(r.status, 'yes');
  assert.equal(r.bandsOk!.length, 3);
  assert.ok(!r.bandsOk!.some(b => b.includes('(18–27)')));
});
ok('Agniveer GD is male-only', () => assert.equal(checkExam(exam('army_gd'), P({ dob: '2007-01-01', qual: '10', gender: 'F' }), '2026-10-24').status, 'no'));
ok('Bihar: BC/EBC woman gets 3 years', () => assert.equal(checkExam(exam('bihar_police'), P({ dob: '1996-08-02', gender: 'F', category: 'OBC' }), '2026-10-24').status, 'yes'));
ok('Height only warns', () => assert.equal(checkExam(exam('ssc_gd'), P({ dob: '2005-01-01', qual: '10', height: 160 }), '2026-10-24').status, 'maybe'));
console.log(`\n${n} checks passed`);
