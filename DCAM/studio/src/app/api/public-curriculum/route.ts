import { NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PublicCurriculumItem = {
  id: string;
  name?: string;
  examTypeId?: string;
  examTypeIds?: string[];
  examId?: string;
  examIds?: string[];
  classId?: string;
  classIds?: string[];
};

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => readString(item)).filter(Boolean)
    : [];
}

function sortByName(left: PublicCurriculumItem, right: PublicCurriculumItem) {
  return (left.name || left.id).localeCompare(right.name || right.id, undefined, {
    sensitivity: 'base',
  });
}

async function readCollection(collectionName: string) {
  const snapshot = await getFirebaseAdminDb().collection(collectionName).get();
  return snapshot.docs
    .map((entry) => {
      const data = entry.data() || {};
      return {
        id: entry.id,
        name: readString(data.name),
        examTypeId: readString(data.examTypeId),
        examTypeIds: readStringArray(data.examTypeIds),
        examId: readString(data.examId),
        examIds: readStringArray(data.examIds),
        classId: readString(data.classId),
        classIds: readStringArray(data.classIds),
      };
    })
    .sort(sortByName);
}

export async function GET() {
  try {
    const [examTypes, classes, subjects] = await Promise.all([
      readCollection('exam_types'),
      readCollection('classes'),
      readCollection('subjects'),
    ]);

    return NextResponse.json(
      { examTypes, classes, subjects },
      { headers: { 'cache-control': 'no-store' } }
    );
  } catch (error) {
    console.error('Public curriculum fetch failed:', error);
    return NextResponse.json(
      { error: 'Could not load curriculum options right now.' },
      {
        status: 500,
        headers: { 'cache-control': 'no-store' },
      }
    );
  }
}
