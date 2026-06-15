export const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const fromDateKey = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const shiftDateKey = (value: string, days: number) => {
  const date = fromDateKey(value);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
};

export const formatDateKey = (value: string, locale = "pt-BR") =>
  new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(fromDateKey(value));

export const isValidDateKey = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = fromDateKey(value);
  return toDateKey(date) === value;
};

export const todayDateKey = () => toDateKey(new Date());

export const isPastDateKey = (value: string) => value < todayDateKey();
