const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { test } = require('node:test');
const cache = new Map();
function load(relative) {
  const filename = path.resolve(relative + '.ts');
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = new Module(filename);
  cache.set(filename, module);
  module.filename = filename;
  module.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = module.require.bind(module);
  module.require = (id) => id.startsWith('@/') ? load('src/' + id.slice(2)) : originalRequire(id);
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename);
  return module.exports;
}
const { normalizeQuestionDifficulty } = load('src/lib/question-difficulty');
const { buildPracticeQuestionScopeEntries } = load('src/lib/practice-question-scope');
const { buildTeacherPremiumQuestionRowsFromQuestions, allocateTeacherPremiumQuestionRows, getTeacherPurchaseQuotaForBucket } = load('src/lib/teacher-premium-question-access');
const base = { teacherId: 'dcam', examTypeId: 'exam', classId: 'class', subjectId: 'subject', topicId: 'topic', questionType: 'MCQ', accessLevel: 'paid' };

test('legacy and missing difficulties normalize without modifying question content or access', () => {
  for (const level of ['Easy', 'Medium', 'Hard', undefined]) {
    const question = { ...base, id: 'q', difficultyLevel: level, questionText: 'Original question', options: ['A', 'B'], alignments: [{ ...base, difficultyLevel: 'Hard', questionNumber: 4 }] };
    const normalized = normalizeQuestionDifficulty(question);
    assert.equal(normalized.difficultyLevel, 'Easy');
    assert.equal(normalized.alignments[0].difficultyLevel, 'Easy');
    assert.equal(normalized.questionText, question.questionText);
    assert.deepEqual(normalized.options, question.options);
    assert.equal(normalized.accessLevel, 'paid');
    assert.equal(normalized.alignments[0].questionNumber, 4);
    assert.equal(question.difficultyLevel, level);
  }
});

test('difficulty-only alignments do not duplicate questions, but curriculum alignments remain', () => {
  const entries = buildPracticeQuestionScopeEntries({ ...base, id: 'q', difficultyLevel: 'Hard', alignments: [{ ...base, difficultyLevel: 'Medium' }, { ...base, topicId: 'other', difficultyLevel: 'Easy' }] });
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map((entry) => entry.topicId), ['topic', 'other']);
  assert.ok(entries.every((entry) => entry.difficultyLevel === 'Easy'));
});

test('old difficulty filters no longer hide questions and access restrictions still apply', () => {
  const questions = ['Easy', 'Medium', 'Hard'].map((difficultyLevel, index) => ({ ...base, id: String(index), difficultyLevel }));
  const rows = buildTeacherPremiumQuestionRowsFromQuestions(questions, { difficultyLevel: 'Hard', accessLevel: 'paid', subjectId: 'subject' });
  assert.equal(rows.length, 3);
  assert.equal(buildTeacherPremiumQuestionRowsFromQuestions(questions, { subjectId: 'other' }).length, 0);
  assert.equal(buildTeacherPremiumQuestionRowsFromQuestions(questions, { accessLevel: 'free' }).length, 0);
});

test('legacy purchased quantities combine once without crossing source or curriculum boundaries', () => {
  const purchase = { id: 'purchase', ...base, regularCounts: { Easy: 1, Medium: 2, Hard: 1 }, pyqCounts: { Easy: 0, Medium: 1, Hard: 0 } };
  assert.equal(getTeacherPurchaseQuotaForBucket(purchase, 'regular', 'Easy'), 4);
  assert.equal(getTeacherPurchaseQuotaForBucket(purchase, 'regular', 'Hard'), 0);
  const questions = Array.from({ length: 8 }, (_, index) => ({ ...base, id: String(index), difficultyLevel: 'Hard', isPreviousYear: index >= 5, previousYear: '2025' }));
  const rows = buildTeacherPremiumQuestionRowsFromQuestions(questions);
  const allocated = allocateTeacherPremiumQuestionRows(rows, [purchase]);
  assert.equal(allocated.filter((row) => row.category === 'regular').length, 4);
  assert.equal(allocated.filter((row) => row.category === 'pyq').length, 1);
  assert.equal(new Set(allocated.map((row) => row.id)).size, 5);
  assert.equal(allocateTeacherPremiumQuestionRows(rows, [{ ...purchase, subjectId: 'other' }]).length, 0);
});
