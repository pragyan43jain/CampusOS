// Academic Calendar Analyzer
// Analyzes instructional and holiday days from VTOP academic calendar schema

export interface CalendarEvent {
  text: string;
  type: string;
  color?: string;
  category?: string;
}

export interface AnalyzedDay {
  date: number;
  weekday: string;
  type: 'working' | 'holiday' | 'other';
  events: CalendarEvent[];
}

export interface CalendarResult {
  month: string;
  year: number;
  days: AnalyzedDay[];
  summary: {
    total: number;
    working: number;
    holiday: number;
    other: number;
  };
}

export interface ImportantEvent {
  event: string;
  date: number;
  weekday: string;
  month: string;
  year: number;
  formattedDate: Date;
}

const HOLIDAY_KEYWORDS = [
  'holiday', 'pooja', 'puja', 'ayudha', 'diwali', 'pongal', 'eid', 'christmas', 'good friday',
  'independence', 'republic', 'onam', 'holi', 'ramadan', 'ganesh', 'maha shivaratri', 'vesak',
  'vacation', 'term end', 'no instructional', 'noinstructional',
];

function normalize(str = ''): string {
  return String(str).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
}

function isHolidayEvent(e: CalendarEvent): boolean {
  if (!e) return false;
  const type = String(e.type || '').toLowerCase();
  const text = normalize(e.text || '');
  const cat = normalize(e.category || '');
  if (type.includes('holiday') || type.includes('no instructional') || cat.includes('no instructional')) return true;
  for (const kw of HOLIDAY_KEYWORDS) {
    if (text.includes(kw) || cat.includes(kw)) return true;
  }
  return false;
}

function isInstructionalEvent(e: CalendarEvent): boolean {
  if (!e) return false;
  const type = String(e.type || '').toLowerCase();
  const cat = normalize(e.category || '');
  if (type === 'instructional day' || cat.includes('working')) return true;
  return false;
}

const MONTH_NAME_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

export function analyzeCalendar(calendar: any = {}): { result: CalendarResult; importantEvents: Map<string, ImportantEvent> } {
  const now = new Date();
  let year = Number(String(calendar.month ?? '').split(' ').pop()) || Number(calendar.year);
  if (!Number.isFinite(year)) year = now.getFullYear();

  let monthIndex = now.getMonth();
  const mRaw = calendar.month;
  if (mRaw != null) {
    if (typeof mRaw === 'number') {
      monthIndex = mRaw >= 1 && mRaw <= 12 ? mRaw - 1 : (mRaw >= 0 && mRaw <= 11 ? mRaw : now.getMonth());
    } else {
      const s = String(mRaw).trim();
      const n = Number(s);
      if (!Number.isNaN(n)) {
        monthIndex = n >= 1 && n <= 12 ? n - 1 : now.getMonth();
      } else {
        const monthPart = s.split(' ')[0].toLowerCase().slice(0, 3);
        if (MONTH_NAME_MAP[monthPart] !== undefined) {
          monthIndex = MONTH_NAME_MAP[monthPart];
        } else {
          const parsed = Date.parse(`${s} 1, ${year}`);
          monthIndex = !Number.isNaN(parsed)
            ? new Date(parsed).getMonth()
            : now.getMonth();
        }
      }
    }
  }

  // Days in month calculation without external library
  const daysInMonthCount = new Date(year, monthIndex + 1, 0).getDate();
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const result: CalendarResult = {
    month: calendar.month ?? new Date(year, monthIndex, 1).toLocaleString('en-US', { month: 'long' }).toUpperCase(),
    year,
    days: [],
    summary: { total: daysInMonthCount, working: 0, holiday: 0, other: 0 },
  };

  for (let d = 1; d <= daysInMonthCount; d++) {
    const dateObj = new Date(year, monthIndex, d);
    const dayName = weekdayNames[dateObj.getDay()];
    const dayInfo = Array.isArray(calendar.days)
      ? calendar.days.find((item: any) => Number(item.date) === d)
      : undefined;

    const events: CalendarEvent[] = dayInfo?.events || [];
    const hasHoliday = events.some(isHolidayEvent);
    const hasInstructional = events.some(isInstructionalEvent);
    const isEmpty = events.length === 0;

    let dayType: 'working' | 'holiday' | 'other' = 'other';
    if (hasHoliday || isEmpty || (!hasInstructional && events.length > 0)) {
      dayType = 'holiday';
    } else if (hasInstructional) {
      dayType = 'working';
    }

    result.days.push({
      date: d,
      weekday: dayName,
      type: dayType,
      events,
    });

    result.summary[dayType]++;
  }

  const IMPORTANT_EVENT_NAMES = [
    { key: 'cat   i', display: 'CAT I', aliases: ['cat 1', 'cat i', 'cat-1', 'cat-i'] },
    { key: 'cat   ii', display: 'CAT II', aliases: ['cat 2', 'cat ii', 'cat-2', 'cat-ii'] },
    {
      key: 'lid for laboratory classes',
      display: 'LID FOR LABORATORY CLASSES',
      aliases: ['lid for lab', 'lid laboratory', 'last instructional day lab'],
    },
    {
      key: 'lid for theory classes',
      display: 'LID FOR THEORY CLASSES',
      aliases: ['lid for theory', 'lid theory', 'last instructional day theory'],
    },
    { key: 'mid term test', display: 'MID TERM TEST', aliases: ['mid term', 'midsem'] },
  ];

  const importantEvents = new Map<string, ImportantEvent>();

  for (const day of result.days) {
    for (const ev of day.events) {
      const text = normalize(ev.text || '');
      for (const { key, display, aliases = [] } of IMPORTANT_EVENT_NAMES) {
        const matched = text.includes(key) || aliases.some((alias) => text.includes(alias));
        if (matched && !importantEvents.has(key)) {
          importantEvents.set(key, {
            event: display,
            date: day.date,
            weekday: day.weekday,
            month: result.month,
            year: result.year,
            formattedDate: new Date(result.year, monthIndex, day.date),
          });
        }
      }
    }
  }

  return { result, importantEvents };
}

export function analyzeAllCalendars(calendars: any): { results: CalendarResult[]; importantEvents: Map<string, ImportantEvent> } {
  if (!calendars) return { results: [], importantEvents: new Map() };

  const calArray: any[] = Array.isArray(calendars)
    ? calendars
    : calendars.calendars
    ? calendars.calendars
    : [calendars];

  const results: CalendarResult[] = [];
  const importantEvents = new Map<string, ImportantEvent>();

  for (const cal of calArray) {
    const { result, importantEvents: imp } = analyzeCalendar(cal);
    results.push(result);
    for (const [key, val] of imp.entries()) {
      if (!importantEvents.has(key)) importantEvents.set(key, val);
    }
  }

  return { results, importantEvents };
}
