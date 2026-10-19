'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ConductedSessionDatePickerOption = {
  date: string;
  meetingTime?: string;
  meetingEndTime?: string;
  subjectId?: string;
  subjectName?: string;
  meetingTitle?: string;
};

type ConductedSessionDatePickerProps = {
  value?: string;
  onChange: (value: string) => void;
  options: ConductedSessionDatePickerOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

const parseYmdToLocalDate = (value?: string) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toLocalYmd = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const addMonths = (date: Date, amount: number) => new Date(date.getFullYear(), date.getMonth() + amount, 1);

const compareMonth = (left: Date, right: Date) => {
  const leftValue = left.getFullYear() * 12 + left.getMonth();
  const rightValue = right.getFullYear() * 12 + right.getMonth();
  return leftValue - rightValue;
};

const formatDateLabel = (value?: string) => {
  const date = parseYmdToLocalDate(value);
  if (!date) return value || '';
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatMonthLabel = (value: Date) =>
  value.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

const getMonthKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function ConductedSessionDatePicker({
  value,
  onChange,
  options,
  placeholder = 'Select conducted date',
  disabled = false,
  className,
}: ConductedSessionDatePickerProps) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const uniqueDates = useMemo(
    () => Array.from(new Set(options.map((option) => option.date).filter(Boolean))).sort(),
    [options]
  );
  const allowedDateSet = useMemo(() => new Set(uniqueDates), [uniqueDates]);
  const allowedDates = useMemo(
    () => uniqueDates.map((date) => parseYmdToLocalDate(date)).filter((date): date is Date => Boolean(date)),
    [uniqueDates]
  );
  const selectedDate = parseYmdToLocalDate(value);
  const selectedDateIsAllowed = value ? allowedDateSet.has(value) : false;
  const firstAllowedDate = allowedDates[0];
  const lastAllowedDate = allowedDates[allowedDates.length - 1];
  const today = useMemo(() => new Date(), []);
  const defaultMonth = (selectedDateIsAllowed ? selectedDate : null) || lastAllowedDate || today;
  const firstAllowedMonth = startOfMonth(firstAllowedDate || today);
  const lastAllowedMonth = startOfMonth(lastAllowedDate || today);
  const defaultMonthKey = getMonthKey(defaultMonth);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(defaultMonth));
  const isDisabled = disabled || uniqueDates.length === 0;
  const previousMonth = addMonths(visibleMonth, -1);
  const nextMonth = addMonths(visibleMonth, 1);
  const canGoToPreviousMonth = compareMonth(previousMonth, firstAllowedMonth) >= 0;
  const canGoToNextMonth = compareMonth(nextMonth, lastAllowedMonth) <= 0;
  const monthCells = useMemo(() => {
    const firstDay = startOfMonth(visibleMonth);
    const cursor = new Date(firstDay);
    cursor.setDate(firstDay.getDate() - firstDay.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(cursor);
      date.setDate(cursor.getDate() + index);
      const dateKey = toLocalYmd(date);
      return {
        date,
        dateKey,
        isCurrentMonth: date.getMonth() === visibleMonth.getMonth() && date.getFullYear() === visibleMonth.getFullYear(),
        isAllowed: allowedDateSet.has(dateKey),
        isSelected: selectedDateIsAllowed && value === dateKey,
      };
    });
  }, [allowedDateSet, selectedDateIsAllowed, value, visibleMonth]);

  useEffect(() => {
    if (!open) return;
    setVisibleMonth(startOfMonth(defaultMonth));
  }, [defaultMonthKey, open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!pickerRef.current) return;
      if (pickerRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div ref={pickerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        disabled={isDisabled}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'h-11 w-full justify-between rounded-xl border-white/10 bg-background/70 px-3 text-left font-normal shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
          !value && 'text-muted-foreground',
          className
        )}
      >
        <span className="truncate">{value ? formatDateLabel(value) : placeholder}</span>
        <CalendarDays className="ml-2 h-4 w-4 shrink-0 opacity-70" />
      </Button>
      {open ? (
        <div className="absolute left-0 top-full z-[130] mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-md border border-white/10 bg-slate-950 p-0 text-slate-100 shadow-xl">
        <div className="p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-white/10"
              onClick={() => setVisibleMonth(previousMonth)}
              disabled={!canGoToPreviousMonth}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="text-sm font-semibold">{formatMonthLabel(visibleMonth)}</p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-white/10"
              onClick={() => setVisibleMonth(nextMonth)}
              disabled={!canGoToNextMonth}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="flex h-8 items-center justify-center">
                {label}
              </div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {monthCells.map((cell) => (
              <button
                key={cell.dateKey}
                type="button"
                disabled={!cell.isAllowed}
                onClick={() => {
                  if (!cell.isAllowed) return;
                  onChange(cell.dateKey);
                  setOpen(false);
                }}
                className={cn(
                  'flex h-9 w-full items-center justify-center rounded-lg text-sm transition-colors',
                  cell.isAllowed
                    ? 'font-semibold text-cyan-100 hover:bg-cyan-500/20 hover:text-white'
                    : 'cursor-not-allowed text-slate-600',
                  !cell.isCurrentMonth && 'opacity-45',
                  cell.isSelected && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
                )}
                aria-label={formatDateLabel(cell.dateKey)}
              >
                {cell.date.getDate()}
              </button>
            ))}
          </div>
        </div>
        <div className="border-t border-white/10 px-3 py-2 text-xs text-muted-foreground">
          Only completed scheduled class dates are selectable.
        </div>
        </div>
      ) : null}
    </div>
  );
}
