const uiDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const uiTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const uiDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function toValidDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatUiDate(value: string | Date) {
  const date = toValidDate(value);
  return date ? uiDateFormatter.format(date) : "";
}

export function formatUiTime(value: string | Date) {
  const date = toValidDate(value);
  return date ? uiTimeFormatter.format(date) : "";
}

export function formatUiDateTime(value: string | Date) {
  const date = toValidDate(value);
  return date ? uiDateTimeFormatter.format(date) : "";
}
