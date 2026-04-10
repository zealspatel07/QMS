//frontend/src/utils/date.ts

export function formatDateDDMMYYYY(
  date?: string | Date | null
): string {
  if (!date) return "-";

  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "-";

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}
