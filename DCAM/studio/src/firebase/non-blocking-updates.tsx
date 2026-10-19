'use client';
    
import {
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  CollectionReference,
  DocumentReference,
  SetOptions,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import {FirestorePermissionError} from '@/firebase/errors';
import { normalizeQuestionDifficulty } from '@/lib/question-difficulty';

const isPermissionDeniedError = (error: unknown): boolean => (
  !!error
  && typeof error === 'object'
  && 'code' in error
  && (error as { code?: unknown }).code === 'permission-denied'
);

const sanitizeFirestoreValue = (value: unknown): unknown => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeFirestoreValue(item))
      .filter((item) => item !== undefined);
  }
  if (value instanceof Date) return value;
  if (typeof value !== 'object') return value;

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => [key, sanitizeFirestoreValue(item)] as const)
    .filter(([, item]) => item !== undefined);

  return Object.fromEntries(entries);
};

/**
 * Initiates a setDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function setDocumentNonBlocking(docRef: DocumentReference, data: any, options: SetOptions) {
  const sanitizedData = sanitizeFirestoreValue(docRef.parent.id === 'practice_questions' ? normalizeQuestionDifficulty(data) : data);
  const promise = setDoc(docRef, sanitizedData as any, options).catch(error => {
    if (isPermissionDeniedError(error)) {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'write', // or 'create'/'update' based on options
          requestResourceData: sanitizedData,
        })
      );
      return null;
    }
    console.error('setDocumentNonBlocking failed:', error);
    return null;
  });
  return promise;
}


/**
 * Initiates an addDoc operation for a collection reference.
 * Does NOT await the write operation internally.
 * Returns the Promise for the new doc ref, but typically not awaited by caller.
 */
export function addDocumentNonBlocking(colRef: CollectionReference, data: any) {
  const sanitizedData = sanitizeFirestoreValue(colRef.id === 'practice_questions' ? normalizeQuestionDifficulty(data) : data);
  const promise = addDoc(colRef, sanitizedData as any)
    .catch(error => {
      if (isPermissionDeniedError(error)) {
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: colRef.path,
            operation: 'create',
            requestResourceData: sanitizedData,
          })
        );
        return null;
      }
      console.error('addDocumentNonBlocking failed:', error);
      return null;
    });
  return promise;
}


/**
 * Initiates an updateDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function updateDocumentNonBlocking(docRef: DocumentReference, data: any) {
  const sanitizedData = sanitizeFirestoreValue(docRef.parent.id === 'practice_questions' ? normalizeQuestionDifficulty(data) : data);
  const promise = updateDoc(docRef, sanitizedData as any)
    .catch(error => {
      if (isPermissionDeniedError(error)) {
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: sanitizedData,
          })
        );
        return null;
      }
      console.error('updateDocumentNonBlocking failed:', error);
      return null;
    });
  return promise;
}


/**
 * Initiates a deleteDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function deleteDocumentNonBlocking(docRef: DocumentReference) {
  const promise = deleteDoc(docRef)
    .catch(error => {
      if (isPermissionDeniedError(error)) {
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
          })
        );
        return;
      }
      console.error('deleteDocumentNonBlocking failed:', error);
    });
  return promise;
}
