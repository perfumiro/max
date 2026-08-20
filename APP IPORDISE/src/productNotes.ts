import { curatedProductNotes } from './productNotes.generated';

export type ProductNotes = { top?: string; heart?: string; base?: string };

const noteText = (value: unknown): string | undefined => {
  if (Array.isArray(value)) {
    const joined = value.map(noteText).filter(Boolean).join(', ');
    return joined || undefined;
  }
  if (typeof value === 'string') return value.trim() || undefined;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return noteText(record.title ?? record.name ?? record.value ?? record.text);
  }
  return undefined;
};

const objectValue = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const direct = noteText(record[key]);
    if (direct) return direct;
    const matchingKey = Object.keys(record).find(candidate => candidate.toLowerCase() === key.toLowerCase());
    const matching = matchingKey ? noteText(record[matchingKey]) : undefined;
    if (matching) return matching;
  }
  return undefined;
};

export const normalizeProductNotes = (productId: string, raw: unknown): ProductNotes | undefined => {
  let supplied: ProductNotes = {};
  if (Array.isArray(raw)) {
    supplied = {
      top: noteText(raw[0]),
      heart: noteText(raw[1]),
      base: noteText(raw[2]),
    };
  } else if (raw && typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    supplied = {
      top: objectValue(record, ['top', 'topNotes', 'opening', 'head']),
      heart: objectValue(record, ['heart', 'heartNotes', 'middle', 'middleNotes']),
      base: objectValue(record, ['base', 'baseNotes', 'drydown']),
    };
  }

  const curated = curatedProductNotes[productId];
  const notes = {
    top: supplied.top ?? curated?.top,
    heart: supplied.heart ?? curated?.heart,
    base: supplied.base ?? curated?.base,
  };
  return notes.top || notes.heart || notes.base ? notes : undefined;
};
