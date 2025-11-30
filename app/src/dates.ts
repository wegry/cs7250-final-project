import type { Dayjs } from "dayjs";
import dayjs from "dayjs";

export function getFirstDayOfType(
  year: number,
  month: number,
  type: "weekday" | "weekend",
): Dayjs {
  const firstOfMonth = dayjs().year(year).month(month).date(1);
  const dayOfWeek = firstOfMonth.day();
  if (type === "weekend") {
    if (dayOfWeek === 0 || dayOfWeek === 6) return firstOfMonth;
    return firstOfMonth.add(6 - dayOfWeek, "day");
  } else {
    if (dayOfWeek >= 1 && dayOfWeek <= 5) return firstOfMonth;
    if (dayOfWeek === 0) return firstOfMonth.add(1, "day");
    return firstOfMonth.add(2, "day");
  }
}
