export const PROMOTION_DURATION_HOURS = 48;
export const PROMOTION_DURATION_MS = PROMOTION_DURATION_HOURS * 60 * 60 * 1000;

export type PromotionWindow = { startsAt: string; endsAt: string };

export function createPromotionWindow(now = Date.now()): PromotionWindow {
  return {
    startsAt: new Date(now).toISOString(),
    endsAt: new Date(now + PROMOTION_DURATION_MS).toISOString(),
  };
}

export function isPromotionWindowActive(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  now = Date.now(),
) {
  const start = startsAt ? Date.parse(startsAt) : Number.NaN;
  const end = endsAt ? Date.parse(endsAt) : Number.NaN;
  return (
    (!Number.isFinite(start) || start <= now) &&
    (!Number.isFinite(end) || end > now)
  );
}

export function promotionRemainingMilliseconds(
  endsAt: string | null | undefined,
  now = Date.now(),
) {
  const end = endsAt ? Date.parse(endsAt) : Number.NaN;
  return Number.isFinite(end) ? Math.max(0, end - now) : 0;
}

export function formatPromotionRemaining(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export function promotionCountdownParts(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  return {
    hours: Math.floor(totalSeconds / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
  };
}

export function formatPromotionCountdown(milliseconds: number) {
  const { hours, minutes, seconds } = promotionCountdownParts(milliseconds);
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}
