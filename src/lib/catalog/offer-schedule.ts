export interface OfferSchedule { starts: string; ends: string }

export function validOfferDate(value: string): boolean {
  return value === "" || (/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value);
}

export function readOfferSchedule(meta: unknown): OfferSchedule {
  const raw = (meta as { offer_schedule?: Partial<OfferSchedule> } | undefined)?.offer_schedule;
  return { starts: typeof raw?.starts === "string" && validOfferDate(raw.starts) ? raw.starts : "", ends: typeof raw?.ends === "string" && validOfferDate(raw.ends) ? raw.ends : "" };
}

/** Empty dates preserve all existing offers. End date is inclusive, São Paulo. */
export function offerIsScheduledNow(schedule: OfferSchedule, now = new Date()): boolean {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return (!schedule.starts || today >= schedule.starts) && (!schedule.ends || today <= schedule.ends);
}
