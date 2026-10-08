import { useMemo, useState, useEffect } from "react";
import { RefreshCcw, Calendar as CalendarIcon, Info } from "lucide-react";
import { MonthCalendar, CalendarResponse } from "../types";
import { CampusAPI } from "../services/api";

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

export const HOLIDAY_KEYWORDS = [
  "holiday", "pooja", "puja", "ayudha", "diwali", "deepavali", "pongal", "eid", "christmas", "good friday",
  "independence", "republic", "onam", "holi", "ramadan", "ganesh", "maha shivaratri", "vesak",
  "vacation", "term end", "no instructional", "noinstructional", "vinayakar chathurthi", "gandhi jayanthi",
  "gandhi jayanti", "thaipoosam", "telugu", "tamil", "ambedkar", "sunday", "winter break"
];

const semiHolidayEvents = [
  "CAT - I", "CAT - II", "CAT 1", "CAT 2", "CAT-I", "CAT-II", "CAT I", "CAT II",
  "FAT", "Lab FAT", "Theory FAT", "Final Assessment", "Assessment", "Mid Term",
  "TechnoVIT", "Vibrance", "Riviera", "Gravitas"
];

function normalize(str = ""): string {
  return String(str).toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
}

export function isHolidayEvent(e: any): boolean {
  if (!e) return false;
  const type = String(e.type || "").toLowerCase();
  const text = normalize(e.text || "");
  const cat = normalize(e.category || "");
  if (type.includes("holiday")) return true;
  if (type.includes("no instructional")) return true;
  if (cat.includes("no instructional")) return true;
  for (const kw of HOLIDAY_KEYWORDS) {
    if (text.includes(kw) || cat.includes(kw)) return true;
  }
  return false;
}

export function isInstructionalEvent(e: any): boolean {
  if (!e) return false;
  const type = String(e.type || "").toLowerCase();
  const cat = normalize(e.category || "");
  if (type === "instructional day") return true;
  if (cat.includes("working") || cat.includes("order")) return true;
  return false;
}

export function isSemiHolidayEvent(e: any): boolean {
  if (!e) return false;
  const text = (e.text || "").toLowerCase();
  const cat = (e.category || "").toLowerCase();
  return semiHolidayEvents.some(
    (kw) => text.includes(kw.toLowerCase()) || cat.includes(kw.toLowerCase())
  );
}

export interface CalendarViewProps {
  calendars?: any;
  initialCalendars?: MonthCalendar[];
  calendarType?: string;
  semesterId?: string | null;
  handleCalendarFetch?: (type: string) => void | Promise<void>;
  onCalendarTypeChange?: (newType: string) => void;
  exams?: any;
  attendance?: any[];
}

export function CalendarView({
  calendars,
  initialCalendars,
  calendarType = "ALL",
  semesterId,
  handleCalendarFetch,
  onCalendarTypeChange,
  exams,
  attendance: _attendance,
}: CalendarViewProps) {
  const [internalCalendars, setInternalCalendars] = useState<any>(calendars || initialCalendars || null);
  const [currentType, setCurrentType] = useState<string>(calendarType || "ALL");
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedDay, setSelectedDay] = useState<{ date: number; events: any[] } | null>(null);

  // Sync props if parent updates them
  useEffect(() => {
    if (calendars && Array.isArray(calendars) && calendars.length > 0) {
      setInternalCalendars(calendars);
    } else if (initialCalendars && Array.isArray(initialCalendars) && initialCalendars.length > 0) {
      setInternalCalendars(initialCalendars);
    }
  }, [calendars, initialCalendars]);

  // Built-in calendar fetcher supporting UniCC VTOP flow
  const onFetchCalendar = async (typeToFetch: string) => {
    setLoading(true);
    try {
      if (handleCalendarFetch) {
        await handleCalendarFetch(typeToFetch);
      } else {
        const data: CalendarResponse = await CampusAPI.getCalendar(semesterId || undefined, typeToFetch);
        if (data && data.calendars && data.calendars.length > 0) {
          setInternalCalendars(data.calendars);
          setCurrentType(typeToFetch);
          if (onCalendarTypeChange) {
            onCalendarTypeChange(typeToFetch);
          }
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
      onFetchCalendar(currentType);
    }
  }, []);

  const safeCalendars = useMemo(() => {
    const src = internalCalendars || calendars || initialCalendars;
    if (!src) return [];
    if (Array.isArray(src)) return src;
    if (src.calendars && Array.isArray(src.calendars)) return src.calendars;
    return [src];
  }, [internalCalendars, calendars, initialCalendars]);

  // Find current real-time month index in safeCalendars
  const currentMonthIdx = useMemo(() => {
    if (!safeCalendars || safeCalendars.length === 0) return 0;
    const now = new Date();
    const nowMonth = now.getMonth(); // 0-11
    const nowYear = now.getFullYear();
    const MONTH_LOOKUP: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const found = safeCalendars.findIndex((cal: any) => {
      const rawMonth = String(cal.month || "").trim().toLowerCase();
      const calYear = cal.year ? Number(cal.year) : nowYear;
      for (const [abbr, mNum] of Object.entries(MONTH_LOOKUP)) {
        if (rawMonth.includes(abbr)) {
          return mNum === nowMonth && (!cal.year || calYear === nowYear);
        }
      }
      return false;
    });
    return found >= 0 ? found : 0;
  }, [safeCalendars]);

  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [hasUserSelectedMonth, setHasUserSelectedMonth] = useState<boolean>(false);

  // Automatically select current month when safeCalendars loads unless user clicked a tab
  useEffect(() => {
    if (!hasUserSelectedMonth && safeCalendars.length > 0) {
      setActiveIdx(currentMonthIdx);
    }
  }, [currentMonthIdx, safeCalendars.length, hasUserSelectedMonth]);

  useEffect(() => {
    if (activeIdx >= safeCalendars.length && safeCalendars.length > 0) {
      setActiveIdx(currentMonthIdx);
    }
  }, [safeCalendars.length, activeIdx, currentMonthIdx]);

  const activeCalendar = safeCalendars[activeIdx] || {};
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const { year, monthIndex } = useMemo(() => {
    const now = new Date();

    const MONTH_NAME_MAP: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };

    const rawMonth = String(activeCalendar.month || "").trim();
    const match = rawMonth.match(/([a-zA-Z]+)(?:[^\d]+(\d{4}))?/);

    let parsedMonthIndex = now.getMonth();
    let parsedYear = activeCalendar.year ? Number(activeCalendar.year) : now.getFullYear();

    if (match) {
      const monthPrefix = match[1].toLowerCase().slice(0, 3);
      if (MONTH_NAME_MAP[monthPrefix] !== undefined) {
        parsedMonthIndex = MONTH_NAME_MAP[monthPrefix];
      }
      if (match[2]) {
        parsedYear = parseInt(match[2], 10);
      }
    }

    return {
      year: parsedYear,
      monthIndex: parsedMonthIndex,
    };
  }, [activeCalendar.month, activeCalendar.year]);

  // Index student's authentic exams by date ("YYYY-M-D")
  const examDaysMap = useMemo(() => {
    const map = new Map<string, any[]>();
    if (!exams) return map;

    let examItems: any[] = [];
    if (Array.isArray(exams)) {
      examItems = exams;
    } else if (typeof exams === "object") {
      Object.entries(exams).forEach(([examType, list]: [string, any]) => {
        if (Array.isArray(list)) {
          list.forEach((item: any) => {
            examItems.push({ ...item, examType: item.examType || examType });
          });
        }
      });
    }

    const MONTH_NAME_LOOKUP: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };

    examItems.forEach((item) => {
      const rawDate = item.date;
      if (!rawDate || String(rawDate).toUpperCase() === "TBA") return;

      let d = 0, m = -1, y = 0;
      const vtopMatch = String(rawDate).match(/(\d{1,2})[-/]([a-zA-Z]{3})[-/](\d{4})/);
      const isoMatch = String(rawDate).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);

      if (vtopMatch) {
        d = parseInt(vtopMatch[1], 10);
        m = MONTH_NAME_LOOKUP[vtopMatch[2].toLowerCase()] ?? -1;
        y = parseInt(vtopMatch[3], 10);
      } else if (isoMatch) {
        y = parseInt(isoMatch[1], 10);
        m = parseInt(isoMatch[2], 10) - 1;
        d = parseInt(isoMatch[3], 10);
      }

      if (d > 0 && m >= 0 && y > 0) {
        const key = `${y}-${m}-${d}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(item);
      }
    });

    return map;
  }, [exams]);

  // Compute Days using date-fns matching UniCC
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

  if (!safeCalendars.length) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-gray-400">
        <CalendarIcon className="w-12 h-12 mb-3 opacity-60 text-blue-500" />
        <p className="text-base font-semibold text-gray-200">No Academic Calendar Data</p>
        <p className="text-xs text-gray-400 mt-1">Please fetch academic calendar from VTOP to synchronize.</p>
        <button
          onClick={() => onFetchCalendar(currentType)}
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
      {/* 1. Header with Calendar Type and Refresh Button (UniCC format) */}
      <h1 className="text-lg font-semibold mb-1 text-center text-gray-800 dark:text-gray-100 flex items-center justify-center gap-3 flex-wrap">
        <span>Academic Calendar ({CALENDAR_TYPES[currentType] || currentType})</span>
        <button
          onClick={() => onFetchCalendar(currentType)}
          disabled={loading}
          title="Refresh calendar directly from VTOP"
          className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </h1>

      {/* 2. Month Selector Tabs (UniCC design) */}
      <div className="flex gap-2 mb-2 justify-center flex-wrap">
        {safeCalendars.map((calendar: any, idx: number) => (
          <button
            key={calendar.id || calendar.month || idx}
            onClick={() => {
              setHasUserSelectedMonth(true);
              setActiveIdx(idx);
              setSelectedDay(null);
            }}
            className={`px-4 py-2 rounded-md text-sm md:text-base font-medium transition-colors duration-150 ${
              idx === activeIdx
                ? "bg-blue-600 text-white dark:bg-blue-700 shadow-sm"
                : "bg-gray-200 text-gray-700 hover:bg-blue-300 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {calendar.month ?? "Month"} {calendar.year ? `(${calendar.year})` : ""}
          </button>
        ))}
      </div>

      {/* 3. Calendar Grid for Active Month (UniCC layout & styling) */}
      <div data-scrollable key={activeIdx} className="w-full">
        <h2 className="text-2xl font-semibold mb-4 text-center text-gray-800 dark:text-gray-100">
          {activeCalendar.month ?? monthStart.toLocaleString(undefined, { month: "long" })}
        </h2>

        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm">
          <div className="w-full min-w-[950px] grid grid-cols-7 text-center border-collapse">
            {weekdays.map((day) => (
              <div
                key={day}
                className="font-semibold py-2.5 border-b text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm"
              >
                {day}
              </div>
            ))}

            {blanks.map((_, i) => (
              <div key={`blank-${i}`} className="h-36 bg-gray-50/40 dark:bg-gray-900/10 border-b border-r border-gray-100 dark:border-gray-800" />
            ))}

            {daysInMonth.map((dateObj) => {
              const date = dateObj.getDate();
              const dayInfo = Array.isArray(activeCalendar.days)
                ? activeCalendar.days.find((d: any) => Number(d.date) === date)
                : undefined;
              let events = [...(dayInfo?.events || [])];

              // Check student's personal exam schedule for this exact date
              const examKey = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}`;
              const studentExams = examDaysMap.get(examKey) || [];

              if (studentExams.length > 0) {
                // Remove generic instructional day pills on exam dates
                events = events.filter(
                  (e: any) =>
                    (e.type || "").toLowerCase() !== "instructional day" &&
                    (e.text || "").toLowerCase() !== "instructional day"
                );
                studentExams.forEach((ex: any) => {
                  const exType =
                    ex.examType ||
                    (ex.title && ex.title.includes("CAT 1")
                      ? "CAT 1"
                      : ex.title && ex.title.includes("CAT 2")
                      ? "CAT 2"
                      : "FAT");
                  const title = ex.title || ex.courseCode || "";
                  const slot = ex.slot ? `Slot ${ex.slot}` : "";
                  const venue = ex.venue && ex.venue !== "TBA" ? ex.venue : "";
                  const time = ex.time || (ex.start_time ? `${ex.start_time} - ${ex.end_time}` : "");
                  const meta = [slot, time, venue].filter(Boolean).join(", ");
                  const desc = `${exType}: ${title}${meta ? ` (${meta})` : ""}`;
                  if (!events.some((e: any) => e.text === desc)) {
                    events.unshift({
                      text: desc,
                      type: "Exam",
                      category: exType,
                      color: "#c084fc",
                      slot: ex.slot,
                      venue: ex.venue,
                      time: time,
                    });
                  }
                });
              }

              const hasHoliday = events.some(isHolidayEvent);
              const hasInstructional = events.some(isInstructionalEvent);
              const isToday = isCurrentMonth && dateObj.getDate() === today.getDate();
              const hasSemiHoliday = events.some(isSemiHolidayEvent);

              const isSunday = dateObj.getDay() === 0;
              let dayType = "regular";
              if (hasSemiHoliday) dayType = "semiholiday";
              else if (hasHoliday || isSunday) dayType = "holiday";
              else if (hasInstructional) dayType = "instructional";
              else if (events.length > 0) dayType = "other";
              else dayType = "regular";

              // Determine specific badge label
              let badgeLabel = "";
              if (dayType === "holiday") badgeLabel = "Holiday";
              else if (dayType === "instructional") badgeLabel = "Working";
              else if (dayType === "semiholiday") {
                const isCat = events.some((e) => /cat/i.test(e.text || "") || /cat/i.test(e.category || ""));
                const isFat = events.some((e) => /fat/i.test(e.text || "") || /fat/i.test(e.category || ""));
                const isFest = events.some(
                  (e) =>
                    /techno|vibrance|riviera|gravitas|fest/i.test(e.text || "") ||
                    /techno|vibrance|riviera|gravitas|fest/i.test(e.category || "")
                );
                if (isCat) badgeLabel = "CAT";
                else if (isFat) badgeLabel = "FAT";
                else if (isFest) badgeLabel = "Fest";
                else badgeLabel = "On Campus";
              } else if (dayType === "other") {
                badgeLabel = "Event";
              }

              const bgClass =
                dayType === "holiday"
                  ? "bg-red-50 dark:bg-red-900/30"
                  : dayType === "instructional"
                  ? "bg-green-50 dark:bg-green-900/30"
                  : dayType === "semiholiday"
                  ? (badgeLabel === "CAT" || badgeLabel === "FAT"
                      ? "bg-purple-50 dark:bg-purple-900/30"
                      : "bg-yellow-50 dark:bg-yellow-900/30")
                  : dayType === "other"
                  ? "bg-blue-50/50 dark:bg-blue-900/20"
                  : "bg-white dark:bg-gray-950";

              const badgeColorClass =
                dayType === "holiday"
                  ? "bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-100"
                  : dayType === "instructional"
                  ? "bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-100"
                  : dayType === "semiholiday"
                  ? (badgeLabel === "CAT" || badgeLabel === "FAT"
                      ? "bg-purple-200 text-purple-800 dark:bg-purple-700 dark:text-purple-100"
                      : "bg-yellow-200 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100")
                  : dayType === "other"
                  ? "bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-100"
                  : "hidden";

              // Events to display in day cell: preserve UniCC events.slice(1) logic, but don't hide sole milestone
              const displayEvents = events.filter((e: any, idx: number) => {
                if (events.length > 1 && idx === 0 && (e.text || "").toLowerCase() === "instructional day") {
                  return false;
                }
                return true;
              });

              return (
                <div
                  key={date}
                  onClick={() => setSelectedDay({ date, events })}
                  className={`relative flex flex-col items-start justify-start p-3 h-40 shadow-sm border-b border-r border-gray-200 dark:border-gray-800 cursor-pointer transition-all ${bgClass} ${
                    isToday ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-gray-900" : ""
                  }`}
                >
                  <div className="w-full flex items-center justify-between">
                    <div className="text-lg font-bold text-left text-gray-800 dark:text-gray-100">
                      {date}
                    </div>
                    {badgeLabel ? (
                      <div className={`text-xs font-semibold px-2 py-0.5 rounded ${badgeColorClass}`}>
                        {badgeLabel}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-2 w-full text-left overflow-y-auto max-h-28">
                    {displayEvents.length > 0 && (
                      <ul className="mt-1 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                        {displayEvents.map((e: any, i: number) => {
                          const isExam =
                            /cat|fat|exam|assessment/i.test(e.text || "") ||
                            /cat|fat|exam|assessment/i.test(e.category || "");
                          const isFest =
                            /techno|vibrance|riviera|gravitas|fest/i.test(e.text || "") ||
                            /techno|vibrance|riviera|gravitas|fest/i.test(e.category || "");
                          const isHol = isHolidayEvent(e);
                          const isInst = isInstructionalEvent(e);

                          const tagClass = isExam
                            ? "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-800/40 dark:text-purple-200"
                            : isFest
                            ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-800/40 dark:text-amber-200"
                            : isHol
                            ? "bg-red-100 text-red-800 border-red-200 dark:bg-red-800/40 dark:text-red-200"
                            : isInst
                            ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-800/40 dark:text-green-200"
                            : "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-800/40 dark:text-yellow-200";

                          const label = e.category && e.category !== "General" ? e.category : e.text;
                          const parts = String(label).split("/").map((p: string) => p.trim()).filter(Boolean);

                          return parts.map((p: string, j: number) => (
                            <li
                              key={`${i}-${j}`}
                              className={`inline-block px-2 py-0.5 rounded border ${tagClass} mr-1 mb-1 font-medium text-[11px]`}
                              title={e.text}
                            >
                              {p.replace(/^\(|\)$/g, "")}
                            </li>
                          ));
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Selected Day Schedule Inspector */}
        {selectedDay && (
          <div className="mt-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex flex-col gap-2.5 animate-fadeIn">
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
                    className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor:
                            isHolidayEvent(ev)
                              ? "#ef4444"
                              : isSemiHolidayEvent(ev)
                              ? "#f59e0b"
                              : isInstructionalEvent(ev)
                              ? "#10b981"
                              : "#3b82f6",
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

      {/* 5. Calendar Program Selector (UniCC CalendarTabWrapper) */}
      <CalendarTabWrapper
        calendarType={currentType}
        handleCalendarFetch={onFetchCalendar}
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
    <div className="flex flex-col items-center justify-center gap-4 p-6 text-center mt-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
        Select Calendar Type
      </h2>

      <select
        value={selectedType}
        onChange={(e) => setSelectedType(e.target.value)}
        className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm
                   dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100
                   focus:outline-none focus:ring-2 focus:ring-blue-500 transition min-w-[220px]"
      >
        {Object.entries(CALENDAR_TYPES).map(([code, name]) => (
          <option key={code} value={code}>
            {name} ({code})
          </option>
        ))}
      </select>

      <button
        onClick={handleSubmitCalendarType}
        disabled={loading}
        className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 
                   transition shadow-sm disabled:opacity-50 flex items-center gap-2"
      >
        <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        <span>{loading ? "Switching..." : "Switch Calendar"}</span>
      </button>
    </div>
  );
}

export default CalendarView;
