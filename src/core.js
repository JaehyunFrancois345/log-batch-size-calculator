const encoder = new TextEncoder();

/**
 * Returns the number of UTF-8 bytes needed to encode `str`.
 *
 * We use TextEncoder because it is the standard, dependency-free way to get
 * UTF-8 byte lengths in both browsers and Node. A manual implementation would
 * need to handle surrogate pairs and would be easy to get wrong.
 *
 * @param {string} str
 * @returns {number}
 */
export function utf8Length(str) {
  if (typeof str !== 'string') {
    throw new TypeError('utf8Length expects a string');
  }
  return encoder.encode(str).length;
}

/**
 * Computes the UTF-8 byte length of a structured log entry.
 *
 * The entry is a plain object whose own enumerable string-keyed properties are
 * serialized in insertion order as `key=value` pairs joined by spaces. Values
 * are converted with `String(value)`. `null` and `undefined` become empty
 * strings so that a missing field still occupies its key and separator bytes.
 *
 * This is deliberately not JSON: log batching cares about the bytes that will
 * actually be written, and many log pipelines use key=value rather than JSON.
 * The function is deterministic and does not depend on the environment.
 *
 * @param {Record<string, unknown>} entry
 * @returns {number} byte length of the serialized entry
 */
export function byteLength(entry) {
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new TypeError('byteLength expects a plain object entry');
  }

  let total = 0;
  let first = true;
  for (const key of Object.keys(entry)) {
    if (!first) {
      total += 1; // space separator
    }
    first = false;

    const value = entry[key];
    const valueStr = value === null || value === undefined ? '' : String(value);

    total += utf8Length(key);
    total += 1; // '='
    total += utf8Length(valueStr);
  }
  return total;
}

/**
 * Picks the largest number of entries from the front of `entries` whose total
 * serialized byte length does not exceed `maxBytes`.
 *
 * Returns `-1` when even the first entry is larger than `maxBytes`, which lets
 * callers distinguish "nothing fits" from "an empty batch fits". A non-positive
 * `maxBytes` therefore also yields `-1` for any non-empty input, and `0` for
 * empty input.
 *
 * @param {Array<Record<string, unknown>>} entries
 * @param {number} maxBytes
 * @returns {number} count of entries that fit, or -1 if none fit
 */
export function batchSize(entries, maxBytes) {
  if (!Array.isArray(entries)) {
    throw new TypeError('batchSize expects an array of entries');
  }
  if (typeof maxBytes !== 'number' || Number.isNaN(maxBytes)) {
    throw new TypeError('maxBytes must be a number');
  }

  if (entries.length === 0) {
    return 0;
  }

  let used = 0;
  for (let i = 0; i < entries.length; i++) {
    const size = byteLength(entries[i]);
    if (used + size > maxBytes) {
      return i === 0 ? -1 : i;
    }
    used += size;
  }
  return entries.length;
}

/**
 * Splits `entries` into consecutive batches where each batch's total serialized
 * byte length is at most `maxBytes`.
 *
 * An entry that is itself larger than `maxBytes` is emitted as a single-entry
 * batch on its own. This keeps the output lossless: every input entry appears
 * exactly once, and the caller can decide to drop or truncate oversized entries
 * downstream. Emitting them is preferable to silently dropping log lines.
 *
 * @param {Array<Record<string, unknown>>} entries
 * @param {number} maxBytes
 * @returns {Array<Array<Record<string, unknown>>>}
 */
export function batchEntries(entries, maxBytes) {
  if (!Array.isArray(entries)) {
    throw new TypeError('batchEntries expects an array of entries');
  }
  if (typeof maxBytes !== 'number' || Number.isNaN(maxBytes)) {
    throw new TypeError('maxBytes must be a number');
  }

  const batches = [];
  let current = [];
  let currentBytes = 0;

  for (const entry of entries) {
    const size = byteLength(entry);

    if (size > maxBytes) {
      if (current.length > 0) {
        batches.push(current);
        current = [];
        currentBytes = 0;
      }
      batches.push([entry]);
      continue;
    }

    if (currentBytes + size > maxBytes) {
      batches.push(current);
      current = [entry];
      currentBytes = size;
    } else {
      current.push(entry);
      currentBytes += size;
    }
  }

  if (current.length > 0) {
    batches.push(current);
  }

  return batches;
}
