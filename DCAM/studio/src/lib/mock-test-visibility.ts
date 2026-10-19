type MockTestVisibilityShape = {
  isCourseOnly?: boolean | null;
  courseId?: string | null;
};

export const isCourseOnlyMockTest = (test: MockTestVisibilityShape | null | undefined): boolean => {
  if (!test) return false;
  const hasCourseId = typeof test.courseId === 'string' && test.courseId.trim().length > 0;
  return test.isCourseOnly === true || hasCourseId;
};

export const isStandaloneMockTest = (test: MockTestVisibilityShape | null | undefined): boolean => {
  return !isCourseOnlyMockTest(test);
};
