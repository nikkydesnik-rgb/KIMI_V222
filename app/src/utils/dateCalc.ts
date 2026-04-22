import { isWeekend, addDays, format, parseISO } from 'date-fns';

export function getWorkingDays(start: string, end: string): number {
  let count = 0;
  const startDate = parseISO(start);
  const endDate = parseISO(end);
  let current = new Date(startDate);

  while (current <= endDate) {
    if (!isWeekend(current)) {
      count++;
    }
    current = addDays(current, 1);
  }

  return count;
}

export function addWorkingDays(start: string, days: number): string {
  const startDate = parseISO(start);
  let current = new Date(startDate);
  let added = 0;

  while (added < days) {
    current = addDays(current, 1);
    if (!isWeekend(current)) {
      added++;
    }
  }

  return format(current, 'yyyy-MM-dd');
}

export function calculateActDates(
  dateStart: string,
  dateEnd: string,
  actCount: number
): Array<{ startDate: string; endDate: string }> {
  if (!dateStart || !dateEnd || actCount <= 0) return [];

  const totalDays = getWorkingDays(dateStart, dateEnd);
  const daysPerAct = Math.floor(totalDays / actCount);
  const remainder = totalDays % actCount;

  const result: Array<{ startDate: string; endDate: string }> = [];
  let currentStart = dateStart;

  for (let i = 0; i < actCount; i++) {
    const extraDay = i < remainder ? 1 : 0;
    const actDays = daysPerAct + extraDay;

    if (actDays <= 0) {
      // If not enough working days, acts overlap
      result.push({
        startDate: currentStart,
        endDate: currentStart,
      });
    } else {
      const actEndDate = addWorkingDays(currentStart, actDays - 1);
      result.push({
        startDate: currentStart,
        endDate: actEndDate,
      });

      // Next act starts where this one ends (possible overlap)
      currentStart = actEndDate;
    }
  }

  return result;
}

export function formatDateRu(dateStr: string): string {
  if (!dateStr) return '';
  const date = parseISO(dateStr);
  return format(date, 'dd.MM.yyyy');
}

export function getHighlightedDates(
  dateStart: string,
  dateEnd: string
): string[] {
  const dates: string[] = [];
  const startDate = parseISO(dateStart);
  const endDate = parseISO(dateEnd);
  let current = new Date(startDate);

  while (current <= endDate) {
    if (!isWeekend(current)) {
      dates.push(format(current, 'yyyy-MM-dd'));
    }
    current = addDays(current, 1);
  }

  return dates;
}
