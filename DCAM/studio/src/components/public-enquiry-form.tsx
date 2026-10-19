'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ref, uploadBytesResumable } from 'firebase/storage';
import {
  ArrowLeft,
  CheckCircle2,
  FileUp,
  LoaderCircle,
  Paperclip,
  Send,
} from 'lucide-react';
import { useStorage } from '@/firebase';
import { firebaseConfig } from '@/firebase/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  enquiryTypeContent,
  formatEnquiryFileSize,
  MAX_ENQUIRY_ATTACHMENTS,
  sanitizeEnquiryFileName,
  validateEnquiryAttachments,
  validateEnquiryMessage,
  type EnquiryAttachment,
  type EnquirySource,
  type EnquiryType,
} from '@/lib/enquiries';

type PublicEnquiryFormProps = {
  enquiryType: EnquiryType;
  source?: EnquirySource;
  variant?: 'support' | 'home_student';
  backHref?: string;
  backLabel?: string;
  initialValues?: {
    name?: string;
    email?: string;
    phoneNumber?: string;
  };
  authTokenProvider?: (() => Promise<string | null>) | null;
};

type ExamTypeDoc = {
  id: string;
  name?: string;
};

type ClassDoc = {
  id: string;
  name?: string;
  examTypeId?: string;
  examTypeIds?: string[];
  examId?: string;
  examIds?: string[];
};

type SubjectDoc = {
  id: string;
  name?: string;
  classId?: string;
  classIds?: string[];
};

type PublicCurriculumPayload = {
  examTypes: ExamTypeDoc[];
  classes: ClassDoc[];
  subjects: SubjectDoc[];
};

const selectTriggerClassName =
  'h-12 rounded-2xl border-white/10 bg-slate-950/35 px-4 text-white shadow-none data-[placeholder]:text-slate-400 focus:ring-cyan-300/30 focus:ring-offset-0';

const selectContentClassName =
  'z-[80] rounded-2xl border border-cyan-300/15 bg-[#071525] p-1 text-slate-100 shadow-[0_24px_80px_-36px_rgba(34,211,238,0.8)]';

const selectItemClassName =
  'rounded-xl py-2.5 pl-8 pr-3 text-sm text-slate-100 focus:bg-cyan-400/10 focus:text-cyan-50';

function normalizeLookupValue(value?: string) {
  return String(value || '').trim().toLowerCase();
}

function compactStringList(values: Array<string | undefined>) {
  return values.map(normalizeLookupValue).filter(Boolean);
}

export default function PublicEnquiryForm({
  enquiryType,
  source = 'website',
  variant = 'support',
  backHref = '/',
  backLabel = 'Back',
  initialValues,
  authTokenProvider = null,
}: PublicEnquiryFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const storage = useStorage();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedExamTypeId, setSelectedExamTypeId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [preferredClassType, setPreferredClassType] = useState('');
  const [planToStart, setPlanToStart] = useState('');
  const [publicCurriculum, setPublicCurriculum] = useState<PublicCurriculumPayload>({
    examTypes: [],
    classes: [],
    subjects: [],
  });
  const [isCurriculumLoading, setIsCurriculumLoading] = useState(false);
  const [curriculumLoadError, setCurriculumLoadError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgressPercent, setUploadProgressPercent] = useState<number | null>(null);
  const [attachmentErrorMessage, setAttachmentErrorMessage] = useState('');
  const [submissionErrorMessage, setSubmissionErrorMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const content = enquiryTypeContent[enquiryType];
  const isHomeStudentEnquiry = variant === 'home_student' && enquiryType === 'student';
  const formSeed = `${source}:${initialValues?.name || ''}:${initialValues?.email || ''}:${initialValues?.phoneNumber || ''}`;
  const activeErrorMessage = attachmentErrorMessage || submissionErrorMessage;
  const isUploadingFiles = uploadProgressPercent !== null;
  const examTypes = publicCurriculum.examTypes;
  const classes = publicCurriculum.classes;
  const subjects = publicCurriculum.subjects;
  const selectedExamType = useMemo(
    () => examTypes.find((item) => item.id === selectedExamTypeId) || null,
    [examTypes, selectedExamTypeId]
  );
  const selectedExamLookupValues = useMemo(
    () => compactStringList([selectedExamTypeId, selectedExamType?.name]),
    [selectedExamTypeId, selectedExamType?.name]
  );
  const classesHaveExamLinks = useMemo(
    () => classes.some((item) => (
      item.examTypeId
      || item.examId
      || (item.examTypeIds && item.examTypeIds.length > 0)
      || (item.examIds && item.examIds.length > 0)
    )),
    [classes]
  );
  const availableClasses = useMemo(
    () => {
      if (!selectedExamTypeId) return [];
      if (!classesHaveExamLinks) return classes;

      return classes.filter((item) => {
        const classExamLinks = compactStringList([
          item.examTypeId,
          item.examId,
          ...(item.examTypeIds || []),
          ...(item.examIds || []),
        ]);
        return classExamLinks.some((value) => selectedExamLookupValues.includes(value));
      });
    },
    [classes, classesHaveExamLinks, selectedExamLookupValues, selectedExamTypeId]
  );
  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) || null,
    [classes, selectedClassId]
  );
  const selectedClassLookupValues = useMemo(
    () => compactStringList([selectedClassId, selectedClass?.name]),
    [selectedClassId, selectedClass?.name]
  );
  const subjectsHaveClassLinks = useMemo(
    () => subjects.some((item) => item.classId || (item.classIds && item.classIds.length > 0)),
    [subjects]
  );
  const availableSubjects = useMemo(
    () => {
      if (!selectedClassId) return [];
      if (!subjectsHaveClassLinks) return subjects;

      return subjects.filter((item) => {
        const subjectClassLinks = compactStringList([
          item.classId,
          ...(item.classIds || []),
        ]);
        return subjectClassLinks.some((value) => selectedClassLookupValues.includes(value));
      });
    },
    [selectedClassId, selectedClassLookupValues, subjects, subjectsHaveClassLinks]
  );
  const selectedSubjectNames = useMemo(
    () => selectedSubjectIds
      .map((subjectId) => subjects.find((item) => item.id === subjectId)?.name || '')
      .filter(Boolean),
    [selectedSubjectIds, subjects]
  );

  useEffect(() => {
    if (!isHomeStudentEnquiry) return;

    let isCancelled = false;

    async function loadPublicCurriculum() {
      setIsCurriculumLoading(true);
      setCurriculumLoadError('');

      try {
        const response = await fetch('/api/public-curriculum', {
          headers: { accept: 'application/json' },
          cache: 'no-store',
        });
        const data = (await response.json().catch(() => null)) as Partial<PublicCurriculumPayload> & { error?: string } | null;

        if (!response.ok) {
          throw new Error(data?.error || 'Could not load curriculum options right now.');
        }

        if (!isCancelled) {
          setPublicCurriculum({
            examTypes: Array.isArray(data?.examTypes) ? data.examTypes : [],
            classes: Array.isArray(data?.classes) ? data.classes : [],
            subjects: Array.isArray(data?.subjects) ? data.subjects : [],
          });
        }
      } catch (error) {
        if (!isCancelled) {
          setCurriculumLoadError(error instanceof Error ? error.message : 'Could not load curriculum options right now.');
          setPublicCurriculum({ examTypes: [], classes: [], subjects: [] });
        }
      } finally {
        if (!isCancelled) {
          setIsCurriculumLoading(false);
        }
      }
    }

    loadPublicCurriculum();

    return () => {
      isCancelled = true;
    };
  }, [isHomeStudentEnquiry]);

  useEffect(() => {
    setSelectedClassId('');
    setSelectedSubjectIds([]);
  }, [selectedExamTypeId]);

  useEffect(() => {
    setSelectedSubjectIds([]);
  }, [selectedClassId]);

  function getStorageBucketName() {
    return firebaseConfig.storageBucket?.trim() || '';
  }

  function buildAttachmentStoragePath(file: File) {
    return `enquiry_attachments/${enquiryType}/pending/${Date.now()}_${crypto.randomUUID()}_${sanitizeEnquiryFileName(file.name)}`;
  }

  function buildAttachmentDownloadUrl(storagePath: string, token: string) {
    const bucketName = getStorageBucketName();
    if (!bucketName) {
      throw new Error('Storage bucket is not configured.');
    }

    return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
  }

  function getUploadErrorMessage(error: unknown, fileName: string) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';

    if (code === 'storage/unauthorized') {
      return `Could not upload ${fileName} right now. Please try again.`;
    }
    if (code === 'storage/canceled') {
      return `Upload cancelled for ${fileName}.`;
    }
    if (code === 'storage/retry-limit-exceeded') {
      return `${fileName} took too long to upload. Please try again.`;
    }

    return `Could not upload ${fileName}.`;
  }

  async function submitEnquiryRequest(uploadedAttachments?: EnquiryAttachment[]) {
    if (!formRef.current) {
      throw new Error('Form is not ready.');
    }

    const payload = new FormData(formRef.current);
    payload.set('enquiryType', enquiryType);
    payload.set('source', source);

    if (uploadedAttachments && uploadedAttachments.length > 0) {
      payload.delete('attachments');
      payload.set('uploadedAttachments', JSON.stringify(uploadedAttachments));
    } else {
      payload.delete('uploadedAttachments');
    }

    const headers: HeadersInit = {};
    if (authTokenProvider) {
      const idToken = await authTokenProvider();
      if (idToken) {
        headers.Authorization = `Bearer ${idToken}`;
      }
    }

    return fetch('/api/enquiries', {
      method: 'POST',
      body: payload,
      headers,
    });
  }

  async function uploadSelectedFiles(): Promise<EnquiryAttachment[]> {
    if (selectedFiles.length === 0) {
      return [];
    }

    const totalBytes = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    let uploadedBytes = 0;
    const uploadedAttachments: EnquiryAttachment[] = [];

    for (const file of selectedFiles) {
      const storagePath = buildAttachmentStoragePath(file);
      const token = crypto.randomUUID();
      const contentType = file.type || 'application/octet-stream';
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType,
        customMetadata: {
          firebaseStorageDownloadTokens: token,
          originalFileName: file.name,
        },
      });

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            if (totalBytes > 0) {
              setUploadProgressPercent(
                Math.min(99, Math.round(((uploadedBytes + snapshot.bytesTransferred) / totalBytes) * 100))
              );
            }
          },
          (error) => reject(error),
          () => resolve()
        );
      }).catch((error) => {
        throw new Error(getUploadErrorMessage(error, file.name));
      });

      uploadedBytes += file.size;
      setUploadProgressPercent(totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 100);
      uploadedAttachments.push({
        name: file.name,
        url: buildAttachmentDownloadUrl(storagePath, token),
        contentType,
        storagePath,
        sizeBytes: file.size,
      });
    }

    return uploadedAttachments;
  }

  function handleAttachmentChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    const validationError = validateEnquiryAttachments(files);

    if (validationError) {
      event.target.value = '';
      setSelectedFiles([]);
      setAttachmentErrorMessage(validationError);
      return;
    }

    setSelectedFiles(files);
    setAttachmentErrorMessage('');
    setSubmissionErrorMessage('');
  }

  function toggleSubjectSelection(subjectId: string) {
    setSelectedSubjectIds((current) =>
      current.includes(subjectId)
        ? current.filter((item) => item !== subjectId)
        : [...current, subjectId]
    );
    setSubmissionErrorMessage('');
  }

  function validateHomeStudentEnquiry(formData: FormData) {
    if (!isHomeStudentEnquiry) return '';

    const requiredTextFields = [
      ['name', 'Enter your name.'],
      ['email', 'Enter your email address.'],
      ['phoneNumber', 'Enter your phone number.'],
    ] as const;

    for (const [fieldName, message] of requiredTextFields) {
      const value = formData.get(fieldName);
      if (typeof value !== 'string' || !value.trim()) return message;
    }

    if (!selectedExamTypeId || !selectedExamType) return 'Select an exam.';
    if (!selectedClassId || !selectedClass) return 'Select a curriculum.';
    if (selectedSubjectIds.length === 0) return 'Select at least one subject.';
    if (!preferredClassType) return 'Select preferred class type.';
    if (!planToStart) return 'Select when you plan to start.';

    const preferredStartDate = formData.get('preferredStartDate');
    if (planToStart === 'later' && (typeof preferredStartDate !== 'string' || !preferredStartDate.trim())) {
      return 'Choose an approximate start date.';
    }

    const messageEntry = formData.get('message');
    const messageValue = typeof messageEntry === 'string' ? messageEntry : '';
    if (messageValue.length > 4000) return 'Message is too long.';

    return '';
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formRef.current || isSubmitting) return;

    const formData = new FormData(formRef.current);
    const homeStudentValidationError = validateHomeStudentEnquiry(formData);
    if (homeStudentValidationError) {
      setAttachmentErrorMessage('');
      setSubmissionErrorMessage(homeStudentValidationError);
      return;
    }

    const messageEntry = formData.get('message');
    const messageValue = typeof messageEntry === 'string' ? messageEntry : '';
    const messageValidationError = isHomeStudentEnquiry
      ? ''
      : validateEnquiryMessage(messageValue, selectedFiles.length > 0);
    const attachmentValidationError = validateEnquiryAttachments(selectedFiles);

    if (messageValidationError) {
      setAttachmentErrorMessage('');
      setSubmissionErrorMessage(messageValidationError);
      return;
    }

    if (attachmentValidationError) {
      setAttachmentErrorMessage(attachmentValidationError);
      setSubmissionErrorMessage('');
      return;
    }

    setIsSubmitting(true);
    setUploadProgressPercent(selectedFiles.length > 0 ? 0 : null);
    setAttachmentErrorMessage('');
    setSubmissionErrorMessage('');

    try {
      let response: Response;

      if (selectedFiles.length > 0) {
        try {
          const uploadedAttachments = await uploadSelectedFiles();
          response = await submitEnquiryRequest(uploadedAttachments);
        } catch (error) {
          console.warn('Direct enquiry attachment upload failed. Falling back to form upload.', error);
          setUploadProgressPercent(null);
          response = await submitEnquiryRequest();
        }
      } else {
        response = await submitEnquiryRequest();
      }

      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setSubmissionErrorMessage(data?.error || 'Could not submit the enquiry right now.');
        return;
      }

      formRef.current.reset();
      if (attachmentInputRef.current) {
        attachmentInputRef.current.value = '';
      }
      setSelectedFiles([]);
      setSelectedExamTypeId('');
      setSelectedClassId('');
      setSelectedSubjectIds([]);
      setPreferredClassType('');
      setPlanToStart('');
      setAttachmentErrorMessage('');
      setSubmissionErrorMessage('');
      setUploadProgressPercent(null);
      setIsSubmitted(true);
    } catch (error) {
      setSubmissionErrorMessage(error instanceof Error ? error.message : 'Could not submit the enquiry right now.');
    } finally {
      setIsSubmitting(false);
      setUploadProgressPercent(null);
    }
  }

  if (isSubmitted) {
    return (
      <div className="rounded-[30px] border border-emerald-300/18 bg-[linear-gradient(145deg,rgba(6,20,32,0.96),rgba(8,57,46,0.78))] p-6 shadow-[0_34px_90px_-52px_rgba(16,185,129,0.7)] sm:p-7">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/28 bg-emerald-500/12">
          <CheckCircle2 className="h-5 w-5 text-emerald-100" />
        </div>
        <h2 className="mt-5 text-2xl font-semibold text-white">{content.successTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-200/78">{content.successMessage}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => setIsSubmitted(false)}
            className="rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 px-5 text-slate-950 hover:brightness-105"
          >
            Send another
          </Button>
          <Button
            type="button"
            asChild
            variant="ghost"
            className="rounded-2xl border border-white/12 bg-white/[0.04] px-5 text-slate-100 hover:bg-white/[0.08]"
          >
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {backLabel}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(155deg,rgba(10,18,31,0.98),rgba(9,28,43,0.86)_45%,rgba(8,15,26,0.98))] p-6 shadow-[0_34px_110px_-62px_rgba(34,211,238,0.6)] backdrop-blur-xl sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="inline-flex rounded-full border border-cyan-300/18 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
            {isHomeStudentEnquiry ? 'Student coaching enquiry' : content.heroTag}
          </p>
          <h2 className="mt-4 text-2xl font-semibold text-white sm:text-3xl">
            {isHomeStudentEnquiry ? 'Student Coaching Enquiry' : content.pageTitle}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-200/78">
            {isHomeStudentEnquiry
              ? 'Tell us your exam, curriculum, subjects, and preferred coaching start plan.'
              : content.pageDescription}
          </p>
        </div>
        <Button
          asChild
          variant="ghost"
          className="rounded-2xl border border-white/12 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
        >
          <Link href={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {backLabel}
          </Link>
        </Button>
      </div>

      <form key={formSeed} ref={formRef} onSubmit={handleSubmit} className="mt-8 space-y-6">
        <input type="hidden" name="website" autoComplete="off" tabIndex={-1} className="hidden" />
        {isHomeStudentEnquiry ? (
          <>
            <input type="hidden" name="examTypeId" value={selectedExamTypeId} />
            <input type="hidden" name="examName" value={selectedExamType?.name || ''} />
            <input type="hidden" name="classId" value={selectedClassId} />
            <input type="hidden" name="className" value={selectedClass?.name || ''} />
            <input type="hidden" name="subjectIds" value={JSON.stringify(selectedSubjectIds)} />
            <input type="hidden" name="subjectNames" value={JSON.stringify(selectedSubjectNames)} />
            <input type="hidden" name="preferredClassType" value={preferredClassType} />
            <input type="hidden" name="planToStart" value={planToStart} />
          </>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${enquiryType}-name`} className="text-slate-100">
              Name
            </Label>
            <Input
              id={`${enquiryType}-name`}
              name="name"
              defaultValue={initialValues?.name || ''}
              required
              placeholder="Enter your name"
              className="h-12 rounded-2xl border-white/10 bg-slate-950/35 text-white placeholder:text-slate-400"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${enquiryType}-email`} className="text-slate-100">
              Email
            </Label>
            <Input
              id={`${enquiryType}-email`}
              name="email"
              type="email"
              defaultValue={initialValues?.email || ''}
              required
              placeholder="Enter your email"
              className="h-12 rounded-2xl border-white/10 bg-slate-950/35 text-white placeholder:text-slate-400"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${enquiryType}-phone`} className="text-slate-100">
              Phone number
            </Label>
            <Input
              id={`${enquiryType}-phone`}
              name="phoneNumber"
              type="tel"
              defaultValue={initialValues?.phoneNumber || ''}
              required
              placeholder="Enter your phone number"
              className="h-12 rounded-2xl border-white/10 bg-slate-950/35 text-white placeholder:text-slate-400"
            />
          </div>
          {isHomeStudentEnquiry ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="student-home-exam" className="text-slate-100">
                  Exam name
                </Label>
                <Select
                  value={selectedExamTypeId}
                  onValueChange={setSelectedExamTypeId}
                  disabled={isCurriculumLoading || examTypes.length === 0}
                >
                  <SelectTrigger id="student-home-exam" className={selectTriggerClassName}>
                    <SelectValue placeholder={isCurriculumLoading ? 'Loading exams...' : 'Select exam'} />
                  </SelectTrigger>
                  <SelectContent className={selectContentClassName}>
                    {examTypes.length > 0 ? (
                      examTypes.map((examType) => (
                        <SelectItem key={examType.id} value={examType.id} className={selectItemClassName}>
                          {examType.name || examType.id}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-exams-found" disabled className={selectItemClassName}>
                        No exams found
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {curriculumLoadError ? (
                  <p className="text-xs text-amber-100">{curriculumLoadError}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="student-home-class" className="text-slate-100">
                  Curriculum
                </Label>
                <Select
                  value={selectedClassId}
                  onValueChange={setSelectedClassId}
                  disabled={!selectedExamTypeId || isCurriculumLoading}
                >
                  <SelectTrigger id="student-home-class" className={selectTriggerClassName}>
                    <SelectValue placeholder={selectedExamTypeId ? 'Select curriculum' : 'Select exam first'} />
                  </SelectTrigger>
                  <SelectContent className={selectContentClassName}>
                    {availableClasses.length > 0 ? (
                      availableClasses.map((classItem) => (
                        <SelectItem key={classItem.id} value={classItem.id} className={selectItemClassName}>
                          {classItem.name || classItem.id}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-curriculums-found" disabled className={selectItemClassName}>
                        No curriculums found
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor={`${enquiryType}-attachments`} className="text-slate-100">
                Attach files
              </Label>
              <label
                htmlFor={`${enquiryType}-attachments`}
                className="flex h-12 cursor-pointer items-center justify-between rounded-2xl border border-dashed border-white/12 bg-slate-950/35 px-4 text-sm text-slate-200 transition hover:border-cyan-300/28 hover:bg-slate-950/50"
              >
                <span className="inline-flex items-center gap-2">
                  <FileUp className="h-4 w-4 text-cyan-200" />
                  Choose files
                </span>
                <span className="text-xs text-slate-400">
                  {MAX_ENQUIRY_ATTACHMENTS} files max
                </span>
              </label>
              <input
                id={`${enquiryType}-attachments`}
                ref={attachmentInputRef}
                name="attachments"
                type="file"
                multiple
                onChange={handleAttachmentChange}
                className="sr-only"
              />
            </div>
          )}
        </div>

        {isHomeStudentEnquiry ? (
          <>
            <div className="space-y-3">
              <Label className="text-slate-100">Subjects</Label>
              <div className="grid gap-3 rounded-[24px] border border-white/10 bg-slate-950/20 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {selectedClassId ? (
                  availableSubjects.length > 0 ? (
                    availableSubjects.map((subject) => (
                      <label
                        key={subject.id}
                        className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-100 transition hover:border-cyan-300/30 hover:bg-cyan-400/10"
                      >
                        <input
                          type="checkbox"
                          checked={selectedSubjectIds.includes(subject.id)}
                          onChange={() => toggleSubjectSelection(subject.id)}
                          className="h-4 w-4 accent-cyan-300"
                        />
                        {subject.name || subject.id}
                      </label>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">No subjects found for this curriculum.</p>
                  )
                ) : (
                  <p className="text-sm text-slate-400">Select exam and curriculum first.</p>
                )}
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-3">
                <Label className="text-slate-100">Preferred class type</Label>
                <div className="grid gap-3">
                  {[
                    ['regular', 'Regular classes'],
                    ['online', 'Online classes'],
                    ['both', 'Both'],
                  ].map(([value, label]) => (
                    <label
                      key={value}
                      className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/25 px-4 py-3 text-sm text-slate-100 transition hover:border-cyan-300/30 hover:bg-cyan-400/10"
                    >
                      <input
                        type="radio"
                        name="preferredClassTypeOption"
                        value={value}
                        checked={preferredClassType === value}
                        onChange={() => setPreferredClassType(value)}
                        className="h-4 w-4 accent-cyan-300"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-slate-100">Plan to start</Label>
                <div className="grid gap-3">
                  {[
                    ['immediate', 'Immediate'],
                    ['later', 'Later on'],
                  ].map(([value, label]) => (
                    <label
                      key={value}
                      className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/25 px-4 py-3 text-sm text-slate-100 transition hover:border-cyan-300/30 hover:bg-cyan-400/10"
                    >
                      <input
                        type="radio"
                        name="planToStartOption"
                        value={value}
                        checked={planToStart === value}
                        onChange={() => setPlanToStart(value)}
                        className="h-4 w-4 accent-cyan-300"
                      />
                      {label}
                    </label>
                  ))}
                </div>
                {planToStart === 'later' ? (
                  <div className="space-y-2">
                    <Label htmlFor="student-home-start-date" className="text-slate-100">
                      Approximate start date
                    </Label>
                    <Input
                      id="student-home-start-date"
                      name="preferredStartDate"
                      type="date"
                      required
                      className="h-12 rounded-2xl border-white/10 bg-slate-950/35 text-white"
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${enquiryType}-attachments`} className="text-slate-100">
                Attach files <span className="text-slate-400">(optional)</span>
              </Label>
              <label
                htmlFor={`${enquiryType}-attachments`}
                className="flex h-12 cursor-pointer items-center justify-between rounded-2xl border border-dashed border-white/12 bg-slate-950/35 px-4 text-sm text-slate-200 transition hover:border-cyan-300/28 hover:bg-slate-950/50"
              >
                <span className="inline-flex items-center gap-2">
                  <FileUp className="h-4 w-4 text-cyan-200" />
                  Choose files
                </span>
                <span className="text-xs text-slate-400">
                  {MAX_ENQUIRY_ATTACHMENTS} files max
                </span>
              </label>
              <input
                id={`${enquiryType}-attachments`}
                ref={attachmentInputRef}
                name="attachments"
                type="file"
                multiple
                onChange={handleAttachmentChange}
                className="sr-only"
              />
            </div>
          </>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor={`${enquiryType}-message`} className="text-slate-100">
            Message {isHomeStudentEnquiry ? <span className="text-slate-400">(optional)</span> : null}
          </Label>
          <Textarea
            id={`${enquiryType}-message`}
            name="message"
            rows={7}
            placeholder={isHomeStudentEnquiry ? 'Write a message if needed' : 'Write your message or attach files'}
            className="rounded-[24px] border-white/10 bg-slate-950/35 px-4 py-3 text-white placeholder:text-slate-400"
          />
        </div>

        <div className="rounded-[24px] border border-white/10 bg-black/15 p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
            <Paperclip className="h-4 w-4 text-cyan-200" />
            <span>Any file type</span>
            <span className="text-slate-500">|</span>
            <span>Up to {MAX_ENQUIRY_ATTACHMENTS} files</span>
          </div>
          {selectedFiles.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedFiles.map((file) => (
                <div
                  key={`${file.name}-${file.size}`}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-200"
                >
                  {file.name} | {formatEnquiryFileSize(file.size)}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {activeErrorMessage ? (
          <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {activeErrorMessage}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">Clear details help us respond faster.</p>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[12rem] rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 px-5 text-slate-950 shadow-[0_18px_40px_-20px_rgba(56,189,248,0.95)] hover:brightness-105"
          >
            {isSubmitting ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                {isUploadingFiles ? `Uploading ${uploadProgressPercent ?? 0}%` : 'Sending'}
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                {content.submitLabel}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
