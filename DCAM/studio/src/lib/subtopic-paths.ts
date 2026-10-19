const SUBTOPIC_PATH_DELIMITERS = [/\s*>\s*/, /\s*->\s*/, /\s*\u2192\s*/, /\s*::\s*/, /\s*\/\s*/, /\s*\|\s*/];

export const normalizeSubtopicValue = (value?: string) => String(value || '').trim().toLowerCase();

export const splitSubtopicPath = (value: string): string[] => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return [];
  for (const delimiter of SUBTOPIC_PATH_DELIMITERS) {
    const parts = trimmed.split(delimiter).map((item) => item.trim()).filter(Boolean);
    if (parts.length > 1) return parts;
  }
  return [trimmed];
};

export const extractSubtopicPaths = (subtopics?: string[] | null): string[][] => {
  return (subtopics || [])
    .map((entry) => splitSubtopicPath(entry))
    .filter((path) => path.length > 0);
};

export const extractTopLevelSubtopics = (subtopics?: string[] | null): string[] => {
  const unique = new Map<string, string>();
  extractSubtopicPaths(subtopics).forEach((path) => {
    const first = path[0];
    const key = normalizeSubtopicValue(first);
    if (!key || unique.has(key)) return;
    unique.set(key, first);
  });
  return Array.from(unique.values());
};

export const matchesSelectedTopLevelSubtopics = (
  subtopics: string[] | null | undefined,
  selectedSubtopics: string[] = []
): boolean => {
  if (!selectedSubtopics.length) return true;
  const selected = new Set(selectedSubtopics.map((entry) => normalizeSubtopicValue(entry)).filter(Boolean));
  if (selected.size === 0) return true;
  const topLevels = extractTopLevelSubtopics(subtopics).map((entry) => normalizeSubtopicValue(entry));
  return topLevels.some((entry) => selected.has(entry));
};

export const matchesSubtopicPathSelection = (
  subtopics: string[] | null | undefined,
  subtopic?: string,
  furtherSubtopic?: string
): boolean => {
  const normalizedSubtopic = normalizeSubtopicValue(subtopic);
  const normalizedFurtherSubtopic = normalizeSubtopicValue(furtherSubtopic);
  if (!normalizedSubtopic && !normalizedFurtherSubtopic) return true;
  const paths = extractSubtopicPaths(subtopics);
  if (paths.length === 0) return false;
  return paths.some((path) => {
    const first = normalizeSubtopicValue(path[0]);
    const second = normalizeSubtopicValue(path[1]);
    if (normalizedSubtopic && first !== normalizedSubtopic) return false;
    if (normalizedFurtherSubtopic && second !== normalizedFurtherSubtopic) return false;
    return true;
  });
};
