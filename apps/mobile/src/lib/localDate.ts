function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function addLocalDaysDate(days: number, from = new Date()): string {
  const date = new Date(from.getTime());
  const safeDays = Number.isFinite(days) ? Math.trunc(days) : 0;
  date.setDate(date.getDate() + safeDays);

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
