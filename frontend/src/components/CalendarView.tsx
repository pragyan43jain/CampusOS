import { useMemo, useState, useEffect } from "react";
import { RefreshCcw, Calendar as CalendarIcon, Info, Sparkles } from "lucide-react";
import { MonthCalendar, CalendarDay, CalendarResponse } from "../types";
import { CampusAPI } from "../services/api";

export const CALENDAR_TYPES: Record<string, string> = {
  ALL: "General Semester",
  ALL02: "General Flexible",
  ALL03: "General Freshers",
  ALL05: "General LAW",
  ALL06: "Flexible Freshers",
  ALL08: "Cohort LAW",
  ALL11: "Flexible Research",
  WEI: "Weekend Intra Semester",
};

const EXAM_KEYWORDS = [
  "exam", "cat - 1", "cat - 2", "cat 1", "cat 2", "cat-1", "cat-2", "cat i", "cat ii", "cat-i", "cat-ii",
  "fat", "lab fat", "theory fat", "assessment", "term end test", "final test", "final assessment",
  "mid term", "continuous assessment", "examination"
];

const FEST_KEYWORDS = [
  "technovit", "vibrance", "riviera", "gravitas", "fest", "festival", "cultural fest", "technical fest"
];

const HOLIDAY_KEYWORDS = [
  "holiday", "pooja", "puja", "ayudha", "diwali", "deepavali", "pongal", "eid", "christmas", "good friday",
  "independence", "republic", "onam", "holi", "ramadan", "ganesh", "maha shivaratri", "vesak",
  "vacation", "term end", "no instructional", "noinstructional", "vinayakar chathurthi", "gandhi jayanthi",
  "gandhi jayanti", "thaipoosam", "telugu", "tamil", "ambedkar", "sunday", "winter break"
];

function normalize(str = ""): string {
  return String(str).toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
}

export function isExamEvent(e: any): boolean {
  if (!e) return false;
  const type = String(e.type || "").toLowerCase();
  const text = normalize(e.text || "");
  const cat = normalize(e.category || "");
  if (type === "exam") return true;
  for (const kw of EXAM_KEYWORDS) {
    if (text.includes(kw) || cat.includes(kw)) return true;
  }
  return false;
}

export function isFestEvent(e: any): boolean {
  if (!e) return false;
  const type = String(e.type || "").toLowerCase();
  const text = normalize(e.text || "");
  const cat = normalize(e.category || "");
  if (type === "festival" || type === "fest") return true;
  for (const kw of FEST_KEYWORDS) {
    if (text.includes(kw) || cat.includes(kw)) return true;
  }
  return false;
}

export function isHolidayEvent(e: any): boolean {
  if (!e) return false;
  const type = String(e.type || "").toLowerCase();
  const text = normalize(e.text || "");
  const cat = normalize(e.category || "");
  if (type === "holiday" || type.includes("holiday") || type.includes("no instructional") || cat.includes("no instructional")) return true;
  for (const kw of HOLIDAY_KEYWORDS) {
    if (text.includes(kw) || cat.includes(kw)) return true;
  }
  return false;
}

export function isInstructionalEvent(e: any): boolean {
  if (!e) return false;
  const type = String(e.type || "").toLowerCase();
  const cat = normalize(e.category || "");
  if (type === "instructional day" || cat.includes("working") || cat.includes("order")) return true;
  return false;
}

// Date helpers
function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function eachDayOfInterval({ start, end }: { start: Date; end: Date }): Date[] {
  const dates: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function getDay(date: Date): number {
  return date.getDay();
}

export interface CalendarDayDetails {
  dayType: "instructional" | "holiday" | "exam" | "fest" | "weekend";
  badgeLabel: string;
  badgeCol: string;
  badgeBg: string;
  bgCol: string;
  borderCol: string;
  primaryDetail: string;
  secondaryDetail?: string;
  fullDescription: string;
}

export function resolveCalendarDayDetails(
  _dayNum: number,
  dayInfo: CalendarDay | undefined,
  _year: number,
  _monthIndex: number,
  _examMap?: any
): CalendarDayDetails {
  const events = dayInfo?.events || [];
  const hasExam = events.some(isExamEvent);
  const hasFest = events.some(isFestEvent);
  const hasHoliday = events.some(isHolidayEvent);
  const hasInstructional = events.some(isInstructionalEvent);
  const isEmpty = events.length === 0;

  if (hasExam) {
    const ev = events.find(isExamEvent);
    const label = ev?.category && ev.category !== "General" ? ev.category : ev?.text || "Exam";
    return {
      dayType: "exam",
      badgeLabel: "Exam",
      badgeCol: "#a855f7",
      badgeBg: "rgba(168, 85, 247, 0.25)",
      bgCol: "rgba(168, 85, 247, 0.08)",
      borderCol: "rgba(168, 85, 247, 0.4)",
      primaryDetail: label,
      fullDescription: `${label} - University Examination Milestone. Attendance mandatory.`,
    };
  }

  if (hasFest) {
    const ev = events.find(isFestEvent);
    const label = ev?.category && ev.category !== "General" ? ev.category : ev?.text || "Festival";
    return {
      dayType: "fest",
      badgeLabel: "Fest",
      badgeCol: "#f59e0b",
      badgeBg: "rgba(245, 158, 11, 0.25)",
      bgCol: "rgba(245, 158, 11, 0.08)",
      borderCol: "rgba(245, 158, 11, 0.35)",
      primaryDetail: label,
      fullDescription: `${label} - Campus Festival / University Event. Non-instructional.`,
    };
  }

  if (hasHoliday || isEmpty || (!hasInstructional && events.length > 0)) {
    const ev = events.find(isHolidayEvent) || events[0];
    const label = ev?.category && ev.category !== "General" ? ev.category : ev?.text || "Holiday";
    return {
      dayType: "holiday",
      badgeLabel: "Holiday",
      badgeCol: "#ef4444",
      badgeBg: "rgba(239, 68, 68, 0.22)",
      bgCol: "rgba(239, 68, 68, 0.08)",
      borderCol: "rgba(239, 68, 68, 0.35)",
      primaryDetail: label,
      fullDescription: `${label} - Sanctioned University Holiday / Weekend. No classes.`,
    };
  }

  const orderEv = events.find((e) => (e.text || "").toLowerCase().includes("order") || (e.category || "").toLowerCase().includes("order"));
  const primaryLabel = orderEv?.category || orderEv?.text || "Instructional Day";

  return {
    dayType: "instructional",
    badgeLabel: "Working",
    badgeCol: "#10b981",
    badgeBg: "rgba(16, 185, 129, 0.22)",
    bgCol: "rgba(16, 185, 129, 0.08)",
    borderCol: "rgba(16, 185, 129, 0.3)",
    primaryDetail: primaryLabel,
    fullDescription: "Regular instructional working day. Attendance recorded.",
  };
}

export interface CalendarViewProps {
  calendars?: any;
  initialCalendars?: MonthCalendar[];
  calendarType?: string;
  handleCalendarFetch?: (type: string) => void | Promise<void>;
  onCalendarTypeChange?: (newType: string) => void;
  exams?: any;
  attendance?: any[];
}

export function CalendarView({
  calendars,
  initialCalendars,
  calendarType = "ALL",
  handleCalendarFetch,
  onCalendarTypeChange,
}: CalendarViewProps) {
  const [internalCalendars, setInternalCalendars] = useState<any>(calendars || initialCalendars || null);
  const [currentType, setCurrentType] = useState<string>(calendarType || "ALL");
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedDay, setSelectedDay] = useState<{ date: number; events: any[] } | null>(null);

  // Sync props if parent updates them
  useEffect(() => {
    if (calendars && Array.isArray(calendars) && calendars.length > 0) setInternalCalendars(calendars);
    else if (initialCalendars && Array.isArray(initialCalendars) && initialCalendars.length > 0) setInternalCalendars(initialCalendars);
  }, [calendars, initialCalendars]);

  // Built-in calendar fetcher if parent did not provide handleCalendarFetch
  const executeCalendarFetch = async (typeToFetch: string) => {
    if (handleCalendarFetch) {
      handleCalendarFetch(typeToFetch);
      return;
    }
    setLoading(true);
    try {
      const data: CalendarResponse = await CampusAPI.getCalendar(undefined, typeToFetch);
      if (data && data.calendars && data.calendars.length > 0) {
        setInternalCalendars(data.calendars);
        setCurrentType(typeToFetch);
        if (onCalendarTypeChange) {
          onCalendarTypeChange(typeToFetch);
        }
      }
    } catch (err) {
      console.error("[CalendarView] Failed to fetch academic calendar from VTOP:", err);
    } finally {
      setLoading(false);
    }
  };

  // If no calendar data exists on mount, fetch automatically
  useEffect(() => {
    if (!internalCalendars || (Array.isArray(internalCalendars) && internalCalendars.length === 0)) {
      executeCalendarFetch(currentType);
    }
  }, []);

  const safeCalendars = useMemo(() => {
    const src = internalCalendars || calendars || initialCalendars;
    if (!src) return [];
    if (Array.isArray(src)) return src;
    if (src.calendars && Array.isArray(src.calendars)) return src.calendars;
    return [src];
  }, [internalCalendars, calendars, initialCalendars]);

  const [activeIdx, setActiveIdx] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("calendar-active-index");
      return saved ? Number(saved) || 0 : 0;
    }
    return 0;
  });

  useEffect(() => {
    localStorage.setItem("calendar-active-index", String(activeIdx));
  }, [activeIdx]);

  const activeCalendar = safeCalendars[activeIdx] || {};
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const { year, monthIndex } = useMemo(() => {
    const now = new Date();

    const MONTH_NAME_MAP: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };

    const rawMonth = String(activeCalendar.month || "").trim();
    const match = rawMonth.match(/([a-zA-Z]+)\s+(\d{4})/);

    let parsedMonthIndex = now.getMonth();
    let parsedYear = now.getFullYear();

    if (match) {
      const monthName = match[1].toLowerCase().slice(0, 3);
      parsedMonthIndex = MONTH_NAME_MAP[monthName] ?? parsedMonthIndex;
      parsedYear = parseInt(match[2], 10);
    }

    return {
      year: parsedYear,
      monthIndex: parsedMonthIndex,
    };
  }, [activeCalendar.month]);

  // Compute Days
  let monthStart = new Date(year, monthIndex, 1);
  let daysInMonth: Date[] = [];
  try {
    const monthEnd = endOfMonth(monthStart);
    daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  } catch {
    const totalDays = Number(activeCalendar.totalDays) || 31;
    daysInMonth = Array.from({ length: totalDays }, (_, i) => new Date(year, monthIndex, i + 1));
  }

  const firstDay = getDay(monthStart);
  const blanksCount = (firstDay + 6) % 7;
  const blanks = Array.from({ length: blanksCount }, (_, i) => i);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex;

  // Month Statistics
  const monthStats = useMemo(() => {
    let working = 0;
    let holidays = 0;
    let exams = 0;
    let fests = 0;

    daysInMonth.forEach((dateObj) => {
      const date = dateObj.getDate();
      const dayInfo = Array.isArray(activeCalendar.days)
        ? activeCalendar.days.find((d: any) => Number(d.date) === date)
        : undefined;
      const events = dayInfo?.events || [];

      if (events.some(isExamEvent)) exams++;
      else if (events.some(isFestEvent)) fests++;
      else if (events.some(isHolidayEvent) || events.length === 0 || !events.some(isInstructionalEvent)) holidays++;
      else if (events.some(isInstructionalEvent)) working++;
    });

    return { total: daysInMonth.length, working, holidays, exams, fests };
  }, [daysInMonth, activeCalendar]);

  if (!safeCalendars.length) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-gray-400">
        <CalendarIcon className="w-12 h-12 mb-3 opacity-60 text-blue-500" />
        <p className="text-base font-semibold text-gray-200">No Academic Calendar Data</p>
        <p className="text-xs text-gray-400 mt-1">Please query VTOP academic calendar to synchronize.</p>
        <button
          onClick={() => executeCalendarFetch(currentType)}
          disabled={loading}
          className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors flex items-center gap-2"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span>{loading ? "Fetching..." : "Fetch Calendar"}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* 1. Header with Calendar Type and Refresh Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-gray-50/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-500">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <span>VTOP Academic Calendar</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-500 border border-blue-500/30">
                {CALENDAR_TYPES[currentType] || currentType}
              </span>
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Instructional days, continuous assessment tests (CAT I & II), lab & theory FAT, and declared holidays.
            </p>
          </div>
        </div>

        <button
          onClick={() => executeCalendarFetch(currentType)}
          disabled={loading}
          title="Refresh calendar directly from VTOP"
          className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors flex items-center gap-2 shadow-sm"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span>{loading ? "Refreshing..." : "Refresh Calendar"}</span>
        </button>
      </div>

      {/* 2. Month Selector Tabs */}
      <div className="flex gap-2 justify-center flex-wrap">
        {safeCalendars.map((calendar: any, idx: number) => (
          <button
            key={calendar.id || calendar.month || idx}
            onClick={() => {
              setActiveIdx(idx);
              setSelectedDay(null);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 ${
              idx === activeIdx
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700/60"
            }`}
          >
            {calendar.month ?? "Month"}
          </button>
        ))}
      </div>

      {/* 3. Month Summary Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 px-4 py-2.5 rounded-lg bg-gray-50/80 dark:bg-gray-900/60 border border-gray-200/80 dark:border-gray-800 text-xs">
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
          {activeCalendar.month ?? monthStart.toLocaleString(undefined, { month: "long" })}
        </h2>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Working: {monthStats.working}</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-red-600 dark:text-red-400">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span>Holidays: {monthStats.holidays}</span>
          </div>
          {monthStats.exams > 0 && (
            <div className="flex items-center gap-1.5 font-medium text-purple-600 dark:text-purple-400">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span>Exams: {monthStats.exams}</span>
            </div>
          )}
          {monthStats.fests > 0 && (
            <div className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>Fests: {monthStats.fests}</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Calendar Grid for Selected Month */}
      <div data-scrollable key={activeIdx} className="w-full">
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm">
          <div className="w-full min-w-[850px] grid grid-cols-7 text-center border-collapse">
            {weekdays.map((day) => (
              <div
                key={day}
                className="font-bold py-2.5 border-b text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50/70 dark:bg-gray-900/60 border-gray-200 dark:border-gray-800"
              >
                {day}
              </div>
            ))}

            {blanks.map((_, i) => (
              <div key={`blank-${i}`} className="min-h-[110px] bg-gray-50/30 dark:bg-gray-900/10 border-b border-r border-gray-100 dark:border-gray-900" />
            ))}

            {daysInMonth.map((dateObj) => {
              const date = dateObj.getDate();
              const dayInfo = Array.isArray(activeCalendar.days)
                ? activeCalendar.days.find((d: any) => Number(d.date) === date)
                : undefined;
              const events = dayInfo?.events || [];

              const hasExam = events.some(isExamEvent);
              const hasFest = events.some(isFestEvent);
              const hasHoliday = events.some(isHolidayEvent);
              const hasInstructional = events.some(isInstructionalEvent);
              const isEmpty = events.length === 0;
              const isToday = isCurrentMonth && dateObj.getDate() === today.getDate();
              const isSelected = selectedDay?.date === date;

              let dayType: "exam" | "fest" | "holiday" | "instructional" | "other" = "other";
              let badgeLabel = "Other";

              if (hasExam) {
                dayType = "exam";
                const examEv = events.find(isExamEvent);
                const exText = (examEv?.text || "").toUpperCase();
                badgeLabel = exText.includes("CAT - 1") || exText.includes("CAT-1") ? "CAT-1"
                  : exText.includes("CAT - 2") || exText.includes("CAT-2") ? "CAT-2"
                  : exText.includes("FAT") ? "FAT" : "Exam";
              } else if (hasFest) {
                dayType = "fest";
                const festEv = events.find(isFestEvent);
                const fText = (festEv?.text || "").toUpperCase();
                badgeLabel = fText.includes("TECHNO") ? "TechnoVIT" : fText.includes("VIBRANCE") ? "Vibrance" : "Fest";
              } else if (hasHoliday || isEmpty || (!hasInstructional && events.length > 0)) {
                dayType = "holiday";
                badgeLabel = "Holiday";
              } else if (hasInstructional) {
                dayType = "instructional";
                badgeLabel = "Working";
              }

              const bgClass =
                dayType === "exam"
                  ? "bg-purple-50/80 dark:bg-purple-950/25 border-purple-200/80 dark:border-purple-900/40"
                  : dayType === "fest"
                  ? "bg-amber-50/80 dark:bg-amber-950/25 border-amber-200/80 dark:border-amber-900/40"
                  : dayType === "holiday"
                  ? "bg-red-50/70 dark:bg-red-950/20 border-red-200/80 dark:border-red-900/40"
                  : dayType === "instructional"
                  ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/40"
                  : "bg-gray-50/50 dark:bg-gray-900/20 border-gray-200/80 dark:border-gray-800";

              const badgeColorClass =
                dayType === "exam"
                  ? "bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200 border-purple-300 dark:border-purple-700"
                  : dayType === "fest"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border-amber-300 dark:border-amber-700"
                  : dayType === "holiday"
                  ? "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200 border-red-300 dark:border-red-700"
                  : dayType === "instructional"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700"
                  : "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-700";

              // Filter display pills to highlight meaningful events
              const displayPills = events.filter((e: any) => {
                const t = (e.text || "").toLowerCase().trim();
                const c = (e.category || "").toLowerCase().trim();
                if (isExamEvent(e) || isFestEvent(e) || isHolidayEvent(e)) return true;
                if (t.includes("order") || c.includes("order")) return true;
                if (t.includes("commencement") || c.includes("commencement") || t.includes("add & drop")) return true;
                if (t.includes("vacation") || c.includes("vacation") || t.includes("study day")) return true;
                // Exclude pure generic "Instructional Day" or "(Working Day)" pills to keep card neat
                if (t === "instructional day" || t === "(working day)") return false;
                return true;
              });

              return (
                <div
                  key={date}
                  onClick={() => setSelectedDay(dayInfo || { date, events: [] })}
                  className={`relative flex flex-col items-start justify-start p-2.5 min-h-[110px] text-left border-b border-r transition-all cursor-pointer select-none ${bgClass} ${
                    isToday ? "ring-2 ring-blue-500 ring-inset" : ""
                  } ${isSelected ? "ring-2 ring-indigo-600 ring-inset shadow-md" : ""}`}
                >
                  {/* Card Header: Date & Status Badge */}
                  <div className="w-full flex items-center justify-between">
                    <span className={`text-sm font-bold font-mono ${isToday ? "text-blue-600 dark:text-blue-400" : "text-gray-800 dark:text-gray-200"}`}>
                      {date}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badgeColorClass}`}>
                      {badgeLabel}
                    </span>
                  </div>

                  {/* Card Events List */}
                  <div className="mt-1.5 w-full flex flex-col gap-1 overflow-y-auto max-h-24">
                    {displayPills.map((e: any, i: number) => {
                      let pillClass = "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200";
                      if (isExamEvent(e)) {
                        pillClass = "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-900/50 dark:text-purple-200 font-semibold";
                      } else if (isFestEvent(e)) {
                        pillClass = "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200 font-semibold";
                      } else if (isHolidayEvent(e)) {
                        pillClass = "bg-red-100 text-red-900 border-red-300 dark:bg-red-900/50 dark:text-red-200 font-semibold";
                      } else if (isInstructionalEvent(e)) {
                        pillClass = "bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-900/50 dark:text-sky-200 font-semibold";
                      }

                      // Label cleaning
                      const cleanLabel = (e.category && e.category !== "General" && e.category !== "Instructional Day" ? e.category : e.text)
                        .replace(/^\((.*)\)$/, "$1")
                        .replace(/^(Holiday\s*\((.*)\)|Holiday\s*-\s*)/i, "$2")
                        .trim();

                      return (
                        <div
                          key={i}
                          className={`text-[11px] leading-tight px-1.5 py-0.5 rounded border truncate ${pillClass}`}
                          title={e.text}
                        >
                          {cleanLabel || e.text}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 5. Selected Day Detail Inspector Drawer */}
        {selectedDay && (
          <div className="mt-4 p-4 rounded-xl bg-gray-50/90 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 flex flex-col gap-2.5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-500" />
                <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  Schedule Details: {activeCalendar.month} {selectedDay.date}
                </h4>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="text-xs text-gray-400 hover:text-gray-200 px-2 py-0.5 rounded border border-gray-300 dark:border-gray-700"
              >
                Close
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              {selectedDay.events && selectedDay.events.length > 0 ? (
                selectedDay.events.map((ev: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-gray-950 border border-gray-200/80 dark:border-gray-800 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor:
                            isExamEvent(ev) ? "#a855f7"
                            : isFestEvent(ev) ? "#f59e0b"
                            : isHolidayEvent(ev) ? "#ef4444"
                            : "#10b981",
                        }}
                      />
                      <span className="font-semibold text-gray-800 dark:text-gray-200">{ev.text}</span>
                    </div>
                    {ev.category && ev.category !== "General" && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        {ev.category}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-xs text-gray-400 italic">
                  Non-instructional weekend / university holiday. No regular classes or lab sessions.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 6. Calendar Type Switcher Wrapper */}
      <CalendarTabWrapper
        calendarType={currentType}
        handleCalendarFetch={executeCalendarFetch}
        loading={loading}
      />
    </div>
  );
}

function CalendarTabWrapper({
  calendarType,
  handleCalendarFetch,
  loading,
}: {
  calendarType?: string;
  handleCalendarFetch: (type: string) => void | Promise<void>;
  loading?: boolean;
}) {
  const [selectedType, setSelectedType] = useState<string>(calendarType || "ALL");

  useEffect(() => {
    if (calendarType) setSelectedType(calendarType);
  }, [calendarType]);

  function handleSubmitCalendarType() {
    handleCalendarFetch(selectedType);
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-5 text-center mt-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-900/30">
      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-blue-500" />
        <span>University Calendar Program Selector</span>
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md">
        Switch between General Semester, Flexible, Freshers, LAW, or Weekend intra-semester programs to inspect distinct university schedules.
      </p>

      <div className="flex items-center gap-3 flex-wrap justify-center">
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-3.5 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-900 text-xs 
                     dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100
                     focus:outline-none focus:ring-2 focus:ring-blue-500 transition min-w-[200px]"
        >
          {Object.entries(CALENDAR_TYPES).map(([value, label]) => (
            <option key={value} value={value}>
              {label} ({value})
            </option>
          ))}
        </select>

        <button
          onClick={handleSubmitCalendarType}
          disabled={loading}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 
                     transition shadow-sm disabled:opacity-50"
        >
          {loading ? "Switching..." : "Switch Calendar"}
        </button>
      </div>
    </div>
  );
}

export default CalendarView;
