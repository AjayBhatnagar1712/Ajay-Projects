export const ALLOWED_TEACHER_AUTHOR_EMAIL = 'dcamclassesiit@gmail.com';
export const DCAM_QUESTION_BANK_LABEL = 'DCAM Question Bank';
export const DCAM_QUESTION_BANK_OWNER_ID = 'gqumFPxA8vh8MwMfmIhaG6FgOy92';
export const DCAM_PRACTICE_SUMMARY_DOC_ID = 'dcam_practice_question_summary';
export const QUESTION_UPLOAD_ROLE_ID = 'question_upload';
export const QUESTION_UPLOAD_ROLE_LABEL = 'Question Upload';
export const DCAM_PRACTICE_QUESTION_COUNTS = {
  free: 5688,
  paid: 177,
};

const normalizeEmail = (value?: string | null) => String(value || '').trim().toLowerCase();

export const isAllowedTeacherAuthorEmail = (value?: string | null) =>
  normalizeEmail(value) === ALLOWED_TEACHER_AUTHOR_EMAIL;

export const isQuestionUploadRole = (value?: string | null) =>
  String(value || '').trim() === QUESTION_UPLOAD_ROLE_ID;

export const shouldUseSharedDcamQuestionBank = (params: {
  email?: string | null;
  isQuestionUploader?: boolean;
}) => Boolean(params.isQuestionUploader) || isAllowedTeacherAuthorEmail(params.email);

export const resolveDcamQuestionBankOwnerId = (params: {
  userId?: string | null;
  email?: string | null;
  isQuestionUploader?: boolean;
}) => (
  shouldUseSharedDcamQuestionBank(params)
    ? DCAM_QUESTION_BANK_OWNER_ID
    : String(params.userId || '').trim()
);

export const getTeacherAuthoringRestrictionCopy = () =>
  `Only ${ALLOWED_TEACHER_AUTHOR_EMAIL} or accounts with the ${QUESTION_UPLOAD_ROLE_LABEL} role can add or manage question-bank content from the website.`;
