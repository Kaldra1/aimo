/**
 * Формат збереження програм емуляторів (.json і посилання «Поділитися»):
 * `{ "machine": "post", "version": 1, ...поля машини }`.
 */
import LZString from 'lz-string';
import { isMachineId, MACHINE_META, type MachineId } from './meta';

export const FORMAT_VERSION = 1;

const HASH_KEY = 's';

export function writeEnvelope(machine: MachineId, fields: Record<string, unknown>): string {
  return `${JSON.stringify({ machine, version: FORMAT_VERSION, ...fields }, null, 2)}\n`;
}

/**
 * Читає й перевіряє збережену програму: JSON, поле machine і версію формату.
 * Поля самої машини перевіряє її модуль. Помилки — українською, їх показують користувачу.
 */
export function readEnvelope(machine: MachineId, text: string): Record<string, unknown> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Файл пошкоджений або це не JSON.');
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('У файлі немає програми емулятора.');
  }
  const record = data as Record<string, unknown>;
  if (!isMachineId(record.machine)) {
    throw new Error('У файлі не вказано, для якої машини програма (поле machine).');
  }
  if (record.machine !== machine) {
    throw new Error(
      `Це програма для ${MACHINE_META[record.machine].genitive}, а не для ${MACHINE_META[machine].genitive}.`,
    );
  }
  if (typeof record.version !== 'number' || !Number.isInteger(record.version)) {
    throw new Error('У файлі не вказано версію формату (поле version).');
  }
  if (record.version > FORMAT_VERSION) {
    throw new Error('Файл створено новішою версією сайту. Оновіть сторінку.');
  }
  return record;
}

/** Текстове поле збереженої програми. */
export function stringField(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== 'string') throw new Error(`У файлі немає поля ${field}.`);
  return value;
}

/** Необов'язкове текстове поле: у старих файлах його може не бути. */
export function optionalStringField(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (value === undefined) return '';
  if (typeof value !== 'string') throw new Error(`Поле ${field} має бути текстом.`);
  return value;
}

/** Частина адреси після `#`: стиснений стан емулятора. */
export function encodeShareHash(serialized: string): string {
  return `${HASH_KEY}=${LZString.compressToEncodedURIComponent(serialized)}`;
}

/** Повертає збережений стан із `#s=…` або null, якщо його немає чи він пошкоджений. */
export function decodeShareHash(hash: string): string | null {
  const parts = hash.replace(/^#/, '').split('&');
  const part = parts.find((p) => p.startsWith(`${HASH_KEY}=`));
  if (!part) return null;
  // Значення не декодуємо як URL: у стисненому рядку трапляється «+».
  const text = LZString.decompressFromEncodedURIComponent(part.slice(HASH_KEY.length + 1));
  return text ? text : null;
}

/** Повне посилання «Поділитися» для сторінки емулятора. */
export function shareUrl(pageUrl: string, serialized: string): string {
  const url = new URL(pageUrl);
  url.hash = encodeShareHash(serialized);
  return url.href;
}
