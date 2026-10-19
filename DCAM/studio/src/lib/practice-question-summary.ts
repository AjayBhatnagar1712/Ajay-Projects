import {
  doc,
  increment,
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import {
  DCAM_PRACTICE_SUMMARY_DOC_ID,
  DCAM_QUESTION_BANK_OWNER_ID,
} from '@/lib/teacher-authoring';

type PracticeQuestionSummaryInput = {
  teacherId?: string | null;
  accessLevel?: string | null;
  mockTestOnly?: boolean | null;
};

type PracticeQuestionSummaryDelta = {
  free: number;
  paid: number;
};

const ZERO_DELTA: PracticeQuestionSummaryDelta = {
  free: 0,
  paid: 0,
};

const getQuestionSummaryBucket = (question?: PracticeQuestionSummaryInput | null): keyof PracticeQuestionSummaryDelta | null => {
  if (!question) return null;
  if (question.teacherId !== DCAM_QUESTION_BANK_OWNER_ID) return null;
  if (question.mockTestOnly === true) return null;
  return question.accessLevel === 'paid' ? 'paid' : 'free';
};

const getQuestionDelta = (
  previousQuestion?: PracticeQuestionSummaryInput | null,
  nextQuestion?: PracticeQuestionSummaryInput | null
): PracticeQuestionSummaryDelta => {
  const delta = { ...ZERO_DELTA };
  const previousBucket = getQuestionSummaryBucket(previousQuestion);
  const nextBucket = getQuestionSummaryBucket(nextQuestion);

  if (previousBucket) delta[previousBucket] -= 1;
  if (nextBucket) delta[nextBucket] += 1;

  return delta;
};

const addDeltas = (
  current: PracticeQuestionSummaryDelta,
  next: PracticeQuestionSummaryDelta
): PracticeQuestionSummaryDelta => ({
  free: current.free + next.free,
  paid: current.paid + next.paid,
});

const applyPracticeQuestionSummaryDelta = async (
  firestore: Firestore,
  delta: PracticeQuestionSummaryDelta
) => {
  const total = delta.free + delta.paid;
  if (delta.free === 0 && delta.paid === 0) return;

  try {
    await setDoc(
      doc(firestore, 'platform_settings', DCAM_PRACTICE_SUMMARY_DOC_ID),
      {
        ownerTeacherId: DCAM_QUESTION_BANK_OWNER_ID,
        freeQuestionCount: increment(delta.free),
        paidQuestionCount: increment(delta.paid),
        totalQuestionCount: increment(total),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Could not sync DCAM practice question summary.', error);
  }
};

export const syncPracticeQuestionSummaryForCreate = async (
  firestore: Firestore,
  question: PracticeQuestionSummaryInput
) => {
  await applyPracticeQuestionSummaryDelta(firestore, getQuestionDelta(null, question));
};

export const syncPracticeQuestionSummaryForDelete = async (
  firestore: Firestore,
  question: PracticeQuestionSummaryInput
) => {
  await applyPracticeQuestionSummaryDelta(firestore, getQuestionDelta(question, null));
};

export const syncPracticeQuestionSummaryForUpdate = async (
  firestore: Firestore,
  previousQuestion: PracticeQuestionSummaryInput,
  nextQuestionPatch: PracticeQuestionSummaryInput
) => {
  await applyPracticeQuestionSummaryDelta(
    firestore,
    getQuestionDelta(previousQuestion, { ...previousQuestion, ...nextQuestionPatch })
  );
};

export const syncPracticeQuestionSummaryForBulkUpdate = async (
  firestore: Firestore,
  updates: Array<{
    previousQuestion: PracticeQuestionSummaryInput;
    nextQuestionPatch: PracticeQuestionSummaryInput;
  }>
) => {
  const delta = updates.reduce(
    (current, update) => addDeltas(
      current,
      getQuestionDelta(update.previousQuestion, { ...update.previousQuestion, ...update.nextQuestionPatch })
    ),
    ZERO_DELTA
  );

  await applyPracticeQuestionSummaryDelta(firestore, delta);
};

export const syncPracticeQuestionSummaryForBulkDelete = async (
  firestore: Firestore,
  questions: PracticeQuestionSummaryInput[]
) => {
  const delta = questions.reduce(
    (current, question) => addDeltas(current, getQuestionDelta(question, null)),
    ZERO_DELTA
  );

  await applyPracticeQuestionSummaryDelta(firestore, delta);
};
