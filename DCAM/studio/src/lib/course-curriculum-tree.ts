export type CourseCurriculumModule = {
  id: string;
  sequenceOrder?: number;
  itemType?: 'module' | 'chapter';
  subjectId?: string;
  subjectName?: string;
  chapterKey?: string;
  chapterRef?: string;
  moduleKey?: string;
  parentModuleRef?: string;
  heading?: string;
  subHeading?: string;
  title: string;
  textBody?: string;
  contentType?: 'youtube' | 'pdf' | 'word' | 'text' | 'chapter' | string;
  accessLevel?: 'free' | 'paid';
  youtubeUrl?: string;
  fileUrl?: string;
};

export type CourseCurriculumTest = {
  id: string;
  sequenceOrder?: number;
  subjectId?: string;
  subjectName?: string;
  chapterRef?: string;
  parentModuleRef?: string;
  title: string;
  accessLevel?: 'free' | 'paid';
  insertAfterModuleIndex?: number;
  config?: {
    questionIds?: string[];
    duration?: number;
  };
};

type OrderedCurriculumItem =
  | { kind: 'module'; id: string; order: number; module: CourseCurriculumModule }
  | { kind: 'test'; id: string; order: number; test: CourseCurriculumTest };

export type OrderedCurriculumModuleItem = Extract<OrderedCurriculumItem, { kind: 'module' }>;
export type OrderedCurriculumTestItem = Extract<OrderedCurriculumItem, { kind: 'test' }>;

export type CourseCurriculumNode = {
  item: OrderedCurriculumModuleItem;
  refKey: string;
  children: CourseCurriculumNode[];
  tests: OrderedCurriculumTestItem[];
};

export type CourseCurriculumSection = {
  key: string;
  title: string;
  description?: string;
  rootModules: CourseCurriculumNode[];
  chapterTests: OrderedCurriculumTestItem[];
  nextModuleById: Record<string, string | null>;
};

export type CourseCurriculumSubjectGroup = {
  key: string;
  subjectId?: string;
  title: string;
  sections: CourseCurriculumSection[];
  moduleCount: number;
  testCount: number;
};

const buildOrderedCurriculumItems = (
  modules: CourseCurriculumModule[],
  tests: CourseCurriculumTest[]
): OrderedCurriculumItem[] => {
  const hasSequenceOrdering = [...modules, ...tests].some((item) => typeof item.sequenceOrder === 'number');

  if (hasSequenceOrdering) {
    return [
      ...modules.map((module, index) => ({
        kind: 'module' as const,
        id: `module-${module.id}`,
        order: module.sequenceOrder ?? index,
        module,
      })),
      ...tests.map((test) => ({
        kind: 'test' as const,
        id: `test-${test.id}`,
        order: test.sequenceOrder ?? 9999,
        test,
      })),
    ].sort((a, b) => a.order - b.order);
  }

  const leadingTests: OrderedCurriculumItem[] = tests
    .filter((test) => (test.insertAfterModuleIndex ?? -1) < 0)
    .map((test) => ({ kind: 'test', id: `test-${test.id}`, order: -1, test }));

  const moduleItems: OrderedCurriculumItem[] = modules.flatMap((module, index) => {
    const testsForSlot: OrderedCurriculumItem[] = tests
      .filter((test) => test.insertAfterModuleIndex === index)
      .map((test) => ({ kind: 'test', id: `test-${test.id}`, order: index + 0.1, test }));

    return [{ kind: 'module', id: `module-${module.id}`, order: index, module }, ...testsForSlot];
  });

  const trailingTests: OrderedCurriculumItem[] = tests
    .filter((test) => (test.insertAfterModuleIndex ?? -1) >= modules.length)
    .map((test) => ({ kind: 'test', id: `test-${test.id}`, order: modules.length + 1, test }));

  return [...leadingTests, ...moduleItems, ...trailingTests];
};

const normalizeCurriculumValue = (value?: string | null) => String(value || '').trim();

const buildCurriculumSubjectKey = (subjectId?: string, subjectName?: string) => {
  const normalizedSubjectId = normalizeCurriculumValue(subjectId);
  if (normalizedSubjectId) return normalizedSubjectId;

  const normalizedSubjectName = normalizeCurriculumValue(subjectName);
  if (normalizedSubjectName) return `name:${normalizedSubjectName.toLowerCase()}`;

  return '__unassigned__';
};

const resolveCurriculumSubjectTitle = (
  subjectId?: string,
  subjectName?: string,
  subjectNameById?: Record<string, string>
) => {
  const normalizedSubjectId = normalizeCurriculumValue(subjectId);
  const normalizedSubjectName = normalizeCurriculumValue(subjectName);

  if (normalizedSubjectId) {
    return subjectNameById?.[normalizedSubjectId] || normalizedSubjectName || 'Subject';
  }

  if (normalizedSubjectName) return normalizedSubjectName;
  return 'General Subject';
};

export const buildCourseCurriculumSections = (
  modules: CourseCurriculumModule[],
  tests: CourseCurriculumTest[]
): CourseCurriculumSection[] => {
  const orderedItems = buildOrderedCurriculumItems(modules, tests);
  const chapterNameByKey = modules.reduce((acc, item) => {
    if ((item.itemType === 'chapter' || item.contentType === 'chapter') && item.chapterKey) {
      acc[item.chapterKey] = item.title;
    }
    return acc;
  }, {} as Record<string, string>);

  type MutableSection = {
    key: string;
    title: string;
    description?: string;
    moduleItems: OrderedCurriculumModuleItem[];
    testItems: OrderedCurriculumTestItem[];
  };

  const sections: MutableSection[] = [];
  const byKey = new Map<string, MutableSection>();

  const ensureSection = (key: string, title: string, description?: string) => {
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.description && description) existing.description = description;
      return existing;
    }

    const created: MutableSection = {
      key,
      title,
      description,
      moduleItems: [],
      testItems: [],
    };

    byKey.set(key, created);
    sections.push(created);
    return created;
  };

  ensureSection('general', 'General Content', 'Items without a chapter mapping.');

  for (const item of orderedItems) {
    if (item.kind === 'module' && (item.module.contentType === 'chapter' || item.module.itemType === 'chapter')) {
      const key = item.module.chapterKey || `chapter-${item.module.id}`;
      ensureSection(key, item.module.title, item.module.textBody);
      continue;
    }

    if (item.kind === 'module') {
      const key = item.module.chapterRef || 'general';
      const title = key === 'general' ? 'General Content' : (chapterNameByKey[key] || 'Chapter');
      ensureSection(key, title).moduleItems.push(item);
      continue;
    }

    const key = item.test.chapterRef || 'general';
    const title = key === 'general' ? 'General Content' : (chapterNameByKey[key] || 'Chapter');
    ensureSection(key, title).testItems.push(item);
  }

  return sections
    .map((section) => {
      const sortedModules = [...section.moduleItems].sort((a, b) => a.order - b.order);
      const sortedTests = [...section.testItems].sort((a, b) => a.order - b.order);

      const moduleByKey = new Map<string, OrderedCurriculumModuleItem>();
      for (const moduleItem of sortedModules) {
        const key = String(moduleItem.module.moduleKey || '').trim();
        if (key) moduleByKey.set(key, moduleItem);
      }

      const modulesByParent = new Map<string, OrderedCurriculumModuleItem[]>();
      const testsByParent = new Map<string, OrderedCurriculumTestItem[]>();

      const appendModule = (parentRef: string, moduleItem: OrderedCurriculumModuleItem) => {
        const bucket = modulesByParent.get(parentRef) || [];
        bucket.push(moduleItem);
        modulesByParent.set(parentRef, bucket);
      };

      const appendTest = (parentRef: string, testItem: OrderedCurriculumTestItem) => {
        const bucket = testsByParent.get(parentRef) || [];
        bucket.push(testItem);
        testsByParent.set(parentRef, bucket);
      };

      for (const moduleItem of sortedModules) {
        const parentRef = String(moduleItem.module.parentModuleRef || '').trim();
        const resolvedParent = parentRef && moduleByKey.has(parentRef) ? parentRef : '__root__';
        appendModule(resolvedParent, moduleItem);
      }

      for (const testItem of sortedTests) {
        const parentRef = String(testItem.test.parentModuleRef || '').trim();
        const resolvedParent = parentRef && moduleByKey.has(parentRef) ? parentRef : '__chapter__';
        appendTest(resolvedParent, testItem);
      }

      for (const bucket of modulesByParent.values()) {
        bucket.sort((a, b) => a.order - b.order);
      }

      for (const bucket of testsByParent.values()) {
        bucket.sort((a, b) => a.order - b.order);
      }

      const buildNodes = (parentRef: string): CourseCurriculumNode[] => {
        const branch = modulesByParent.get(parentRef) || [];
        return branch.map((moduleItem) => {
          const moduleRef = String(moduleItem.module.moduleKey || '').trim();
          return {
            item: moduleItem,
            refKey: moduleRef || `module-${moduleItem.module.id}`,
            children: moduleRef ? buildNodes(moduleRef) : [],
            tests: moduleRef ? (testsByParent.get(moduleRef) || []) : [],
          };
        });
      };

      const nextModuleById: Record<string, string | null> = {};
      for (let index = 0; index < sortedModules.length; index += 1) {
        const currentId = sortedModules[index]?.module.id;
        if (!currentId) continue;
        nextModuleById[currentId] = sortedModules[index + 1]?.module.id || null;
      }

      return {
        key: section.key,
        title: section.title,
        description: section.description,
        rootModules: buildNodes('__root__'),
        chapterTests: testsByParent.get('__chapter__') || [],
        nextModuleById,
      };
    })
    .filter((section) => section.rootModules.length > 0 || section.chapterTests.length > 0 || section.key !== 'general');
};

export const buildCourseCurriculumSubjectGroups = (
  modules: CourseCurriculumModule[],
  tests: CourseCurriculumTest[],
  options?: {
    subjectIds?: string[];
    subjectNameById?: Record<string, string>;
  }
): CourseCurriculumSubjectGroup[] => {
  const subjectNameById = options?.subjectNameById || {};
  const subjectOrderById = new Map(
    (options?.subjectIds || [])
      .map((subjectId) => normalizeCurriculumValue(subjectId))
      .filter(Boolean)
      .map((subjectId, index) => [subjectId, index] as const)
  );
  const orderedItems = buildOrderedCurriculumItems(modules, tests);
  let nextDynamicOrder = subjectOrderById.size;

  type MutableSubjectGroup = {
    key: string;
    subjectId?: string;
    title: string;
    modules: CourseCurriculumModule[];
    tests: CourseCurriculumTest[];
    order: number;
  };

  const byKey = new Map<string, MutableSubjectGroup>();

  const ensureGroup = (subjectId?: string, subjectName?: string) => {
    const key = buildCurriculumSubjectKey(subjectId, subjectName);
    const preferredOrder = subjectId ? subjectOrderById.get(normalizeCurriculumValue(subjectId)) : undefined;
    const resolvedTitle = resolveCurriculumSubjectTitle(subjectId, subjectName, subjectNameById);
    const existing = byKey.get(key);

    if (existing) {
      if (!existing.subjectId && normalizeCurriculumValue(subjectId)) {
        existing.subjectId = normalizeCurriculumValue(subjectId);
      }
      if (existing.title === 'General Subject' && resolvedTitle !== 'General Subject') {
        existing.title = resolvedTitle;
      }
      return existing;
    }

    const created: MutableSubjectGroup = {
      key,
      subjectId: normalizeCurriculumValue(subjectId) || undefined,
      title: resolvedTitle,
      modules: [],
      tests: [],
      order: preferredOrder ?? nextDynamicOrder++,
    };

    byKey.set(key, created);
    return created;
  };

  for (const item of orderedItems) {
    if (item.kind === 'module') {
      ensureGroup(item.module.subjectId, item.module.subjectName).modules.push(item.module);
      continue;
    }

    ensureGroup(item.test.subjectId, item.test.subjectName).tests.push(item.test);
  }

  return [...byKey.values()]
    .filter((group) => group.modules.length > 0 || group.tests.length > 0)
    .sort((left, right) => left.order - right.order || left.title.localeCompare(right.title))
    .map((group) => ({
      key: group.key,
      subjectId: group.subjectId,
      title: group.title,
      sections: buildCourseCurriculumSections(group.modules, group.tests),
      moduleCount: group.modules.filter((item) => item.itemType !== 'chapter' && item.contentType !== 'chapter').length,
      testCount: group.tests.length,
    }));
};
