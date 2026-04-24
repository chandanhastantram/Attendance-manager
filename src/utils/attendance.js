import { addDays, startOfDay, differenceInDays, format, parseISO, isAfter, isBefore, isToday } from 'date-fns';

/**
 * Core attendance math
 * OD (On Duty) counts as attended — student was on official college duty
 * Off/Cancelled does NOT count towards attendance at all
 */
export function calcInsight(attended, od, missed, criteria = 75) {
  const effectiveAttended = attended + od;
  const total = effectiveAttended + missed;
  const percentage = total > 0 ? Math.round((effectiveAttended / total) * 100) : 0;

  let canBunk = 0;
  let needAttend = 0;

  if (total > 0) {
    if (percentage >= criteria) {
      canBunk = Math.max(0, Math.floor((effectiveAttended * 100 - criteria * total) / criteria));
    } else {
      needAttend = Math.max(0, Math.ceil((criteria * total - effectiveAttended * 100) / (100 - criteria)));
    }
  }

  let status = 'neutral';
  if (total === 0) status = 'neutral';
  else if (percentage >= criteria + 10) status = 'safe';
  else if (percentage >= criteria) status = 'ok';
  else if (percentage >= criteria - 15) status = 'warning';
  else status = 'danger';

  return { percentage, total, canBunk, needAttend, status, attended, od, missed, effectiveAttended };
}

/**
 * Future projection — given a timetable and semester end date,
 * calculates how many classes remain per subject from today to end.
 * Returns per-subject: remainingClasses, canBunkRemaining, mustAttendRemaining
 */
export function calcFutureProjection(subjects, slots, records, semesterEndDate, criteria = 75) {
  if (!semesterEndDate) return {};

  const today = startOfDay(new Date());
  const end = startOfDay(typeof semesterEndDate === 'string' ? parseISO(semesterEndDate) : semesterEndDate);

  if (isBefore(end, today)) return {};

  // Count remaining class days per subject from today to semesterEndDate
  const remainingBySubject = {};
  subjects.forEach(sub => { remainingBySubject[sub.id] = 0; });

  let cur = today;
  while (!isAfter(cur, end)) {
    // day: 0=Sun,1=Mon…6=Sat → our index: 0=Mon…5=Sat,6=Sun
    const jsDay = cur.getDay();
    const ourDay = jsDay === 0 ? 6 : jsDay - 1;
    const daySlots = slots.filter(s => s.day === ourDay);
    daySlots.forEach(slot => {
      if (remainingBySubject[slot.subjectId] !== undefined) {
        remainingBySubject[slot.subjectId]++;
      }
    });
    cur = addDays(cur, 1);
  }

  // Current stats per subject
  const statsMap = {};
  subjects.forEach(sub => {
    const recs = records.filter(r => r.subjectId === sub.id);
    const attended = recs.filter(r => r.status === 'attended').length;
    const od = recs.filter(r => r.status === 'od').length;
    const missed = recs.filter(r => r.status === 'missed').length;
    const subCriteria = sub.criteria || criteria;
    const remaining = remainingBySubject[sub.id] || 0;
    const effectiveNow = attended + od;
    const totalNow = effectiveNow + missed;

    // If you attend ALL remaining classes:
    const maxPossible = effectiveNow + remaining;
    const maxPossibleTotal = totalNow + remaining;
    const maxPossiblePct = maxPossibleTotal > 0 ? Math.round((maxPossible / maxPossibleTotal) * 100) : 0;

    // How many of the remaining classes MUST you attend to reach criteria%?
    // (effectiveNow + x) / (totalNow + remaining) >= criteria/100
    // x >= (criteria/100 * (totalNow + remaining)) - effectiveNow
    const mustAttend = Math.max(0, Math.ceil((subCriteria / 100) * (totalNow + remaining) - effectiveNow));
    const canSkip = Math.max(0, remaining - mustAttend);
    const projectedPct = (totalNow + remaining) > 0
      ? Math.round(((effectiveNow + remaining) / (totalNow + remaining)) * 100)
      : 0;

    statsMap[sub.id] = {
      remaining,
      mustAttend: Math.min(mustAttend, remaining),
      canSkip,
      maxPossiblePct,
      projectedPct,
      isAchievable: maxPossiblePct >= subCriteria,
    };
  });

  return statsMap;
}

/** Format HH:mm → 12h */
export function fmt12(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const p = h >= 12 ? 'PM' : 'AM';
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hh}:${String(m).padStart(2, '0')} ${p}`;
}

/** Greeting by hour */
export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Today's day index: 0=Mon … 5=Sat, 6=Sun */
export function todayDayIndex() {
  const d = new Date().getDay(); // 0=Sun,1=Mon…
  return d === 0 ? 6 : d - 1;
}

/** Count slots per day for a given subject */
export function countWeeklyClasses(slots, subjectId) {
  return slots.filter(s => s.subjectId === subjectId).length;
}
