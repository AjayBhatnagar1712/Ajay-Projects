import { Badge } from '@/components/ui/badge';
import { splitSubtopicPath } from '@/lib/subtopic-paths';
import { cn } from '@/lib/utils';

export type OfferQuestionCoverageRow = {
  id: string;
  subjectName: string;
  topicName?: string;
  subtopicPaths?: string[];
  count: number;
};

type OfferQuestionCoverageSummaryProps = {
  title: string;
  description?: string;
  accent?: 'amber' | 'cyan';
  variant?: 'panel' | 'embedded';
  examTypeName?: string;
  curriculumName?: string;
  totalQuestions: number;
  rows: OfferQuestionCoverageRow[];
  className?: string;
};

type CoverageTopicGroup = {
  key: string;
  name: string;
  count: number;
  subtopicPaths: string[];
};

type CoverageSubjectGroup = {
  key: string;
  name: string;
  count: number;
  topics: CoverageTopicGroup[];
};

const ACCENT_STYLES = {
  amber: {
    shell: 'border-amber-300/20 bg-[linear-gradient(180deg,rgba(120,53,15,0.18),rgba(15,23,42,0.88))]',
    heading: 'text-amber-100',
    description: 'text-amber-50/80',
    badge: 'border-amber-300/25 bg-amber-500/10 text-amber-50',
    mutedBadge: 'border-amber-300/15 bg-slate-950/55 text-amber-50/90',
    innerCard: 'border-amber-300/15 bg-slate-950/45',
    innerMuted: 'text-amber-100/70',
    branch: 'border-amber-300/15 bg-amber-500/10 text-amber-50/90',
  },
  cyan: {
    shell: 'border-cyan-300/20 bg-[linear-gradient(180deg,rgba(8,47,73,0.28),rgba(15,23,42,0.9))]',
    heading: 'text-cyan-100',
    description: 'text-cyan-50/80',
    badge: 'border-cyan-300/25 bg-cyan-500/10 text-cyan-50',
    mutedBadge: 'border-cyan-300/15 bg-slate-950/55 text-cyan-50/90',
    innerCard: 'border-cyan-300/15 bg-slate-950/45',
    innerMuted: 'text-cyan-100/70',
    branch: 'border-cyan-300/15 bg-cyan-500/10 text-cyan-50/90',
  },
} as const;

const formatSubtopicPath = (value: string) => splitSubtopicPath(value).join(' / ') || value;

const buildCoverageGroups = (rows: OfferQuestionCoverageRow[]): CoverageSubjectGroup[] => {
  const subjectMap = new Map<string, { name: string; count: number; topics: Map<string, CoverageTopicGroup> }>();

  rows
    .filter((row) => Number(row.count || 0) > 0)
    .forEach((row) => {
      const subjectName = String(row.subjectName || '').trim() || 'Subject';
      const subjectKey = subjectName.toLowerCase();
      const subjectEntry = subjectMap.get(subjectKey) || { name: subjectName, count: 0, topics: new Map<string, CoverageTopicGroup>() };
      subjectEntry.count += Number(row.count || 0);

      const topicName = String(row.topicName || '').trim() || 'All selected topics';
      const topicKey = topicName.toLowerCase();
      const topicEntry = subjectEntry.topics.get(topicKey) || {
        key: `${subjectKey}-${topicKey}`,
        name: topicName,
        count: 0,
        subtopicPaths: [],
      };
      topicEntry.count += Number(row.count || 0);

      (row.subtopicPaths || [])
        .map((path) => formatSubtopicPath(path))
        .filter(Boolean)
        .forEach((path) => {
          if (!topicEntry.subtopicPaths.includes(path)) {
            topicEntry.subtopicPaths.push(path);
          }
        });

      subjectEntry.topics.set(topicKey, topicEntry);
      subjectMap.set(subjectKey, subjectEntry);
    });

  return Array.from(subjectMap.entries())
    .map(([key, subject]) => ({
      key,
      name: subject.name,
      count: subject.count,
      topics: Array.from(subject.topics.values()).sort((left, right) =>
        right.count === left.count ? left.name.localeCompare(right.name) : right.count - left.count
      ),
    }))
    .sort((left, right) => (right.count === left.count ? left.name.localeCompare(right.name) : right.count - left.count));
};

export default function OfferQuestionCoverageSummary({
  title,
  description,
  accent = 'amber',
  variant = 'panel',
  examTypeName,
  curriculumName,
  totalQuestions,
  rows,
  className: classNameProp,
}: OfferQuestionCoverageSummaryProps) {
  const styles = ACCENT_STYLES[accent];
  const subjectGroups = buildCoverageGroups(rows);
  const topicCount = subjectGroups.reduce((sum, subject) => sum + subject.topics.length, 0);
  const branchCount = subjectGroups.reduce(
    (sum, subject) => sum + subject.topics.reduce((topicSum, topic) => topicSum + topic.subtopicPaths.length, 0),
    0
  );
  const isEmbedded = variant === 'embedded';

  return (
    <div
      className={cn(
        isEmbedded
          ? 'rounded-2xl border border-white/10 bg-black/15 p-3'
          : 'rounded-3xl border p-4 shadow-xl shadow-black/15',
        !isEmbedded && styles.shell,
        classNameProp
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn(isEmbedded ? 'text-[11px] font-semibold tracking-[0.16em] uppercase' : 'text-sm font-semibold tracking-[0.16em] uppercase', styles.heading)}>
              {title}
            </p>
            <Badge variant="outline" className={styles.badge}>
              {Math.max(0, Number(totalQuestions || 0))} questions locked in
            </Badge>
          </div>
          {description ? <p className={cn('max-w-2xl text-sm', styles.description)}>{description}</p> : null}
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {examTypeName ? <Badge variant="outline" className={styles.mutedBadge}>{examTypeName}</Badge> : null}
          {curriculumName ? <Badge variant="outline" className={styles.mutedBadge}>{curriculumName}</Badge> : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <Badge variant="outline" className={styles.badge}>
          {subjectGroups.length} subject{subjectGroups.length === 1 ? '' : 's'}
        </Badge>
        <Badge variant="outline" className={styles.badge}>
          {topicCount} topic{topicCount === 1 ? '' : 's'}
        </Badge>
        {branchCount > 0 ? (
          <Badge variant="outline" className={styles.badge}>
            {branchCount} subtopic branch{branchCount === 1 ? '' : 'es'}
          </Badge>
        ) : null}
      </div>

      <div className={cn('mt-4 grid gap-3', isEmbedded ? 'grid-cols-1' : 'xl:grid-cols-2')}>
        {subjectGroups.map((subject) => (
          <div key={subject.key} className={cn('rounded-2xl border p-4', styles.innerCard)}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-base font-semibold text-white">{subject.name}</p>
                <p className={cn('mt-1 text-xs', styles.innerMuted)}>
                  {subject.topics.length} topic{subject.topics.length === 1 ? '' : 's'} covered in this pack
                </p>
              </div>
              <Badge variant="outline" className={styles.badge}>
                {subject.count} Qs
              </Badge>
            </div>

            <div className="mt-3 space-y-2">
              {subject.topics.map((topic) => (
                <div key={topic.key} className="rounded-2xl border border-white/10 bg-black/15 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-white">{topic.name}</p>
                      <p className="mt-1 text-[11px] text-slate-300">
                        {topic.subtopicPaths.length > 0
                          ? `${topic.subtopicPaths.length} selected subtopic ${topic.subtopicPaths.length === 1 ? 'branch' : 'branches'}`
                          : 'All selected questions stay inside this topic scope'}
                      </p>
                    </div>
                    <Badge variant="outline" className={styles.badge}>
                      {topic.count} Qs
                    </Badge>
                  </div>

                  {topic.subtopicPaths.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {topic.subtopicPaths.map((path) => (
                        <Badge key={`${topic.key}-${path}`} variant="outline" className={cn('max-w-full text-[11px]', styles.branch)}>
                          <span className="truncate">{path}</span>
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
