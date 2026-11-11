# log-batch-size-calculator

Computes the UTF-8 byte length of structured log entries so you can group them into batches that respect a byte budget.

```js
import { byteLength, batchSize, batchEntries } from './src/index.js';

const entry = { level: 'info', msg: 'héllo', user: 'ada' };

// Bytes for one serialized entry.
byteLength(entry); // => 41

// How many entries from the front fit in 100 bytes?
batchSize([entry, entry, entry], 100); // => 2

// Split a list into batches that each fit in 100 bytes.
batchEntries([entry, entry, entry], 100);
// => [ [entry, entry], [entry] ]
```

## Why this exists

Log shippers usually batch by count, but the downstream limit is almost always bytes. Counting characters undercounts non-ASCII messages, and JSON-encoding every entry just to measure it doubles the work. This library measures the bytes that a key=value serialization will actually occupy, using the platform's `TextEncoder` so the result is correct for surrogate pairs, emoji, and combining marks without hand-rolled UTF-8 logic.

The trade-off is that the measurement is tied to one serialization format: `key=value` pairs joined by a single space, values stringified with `String`. If your pipeline writes JSON, measure the JSON string instead. The format is fixed here because a byte budget only makes sense relative to the bytes you are going to emit.

## The awkward edge

An entry larger than the whole budget cannot be made to fit. `batchSize` reports this by returning `-1` rather than `0`, so a caller can tell "nothing fits" apart from "an empty batch fits". `batchEntries` keeps such an entry as a single-entry batch instead of dropping it, because losing a log line is worse than exceeding a soft limit.

## API

- `utf8Length(str)` — UTF-8 byte length of a string.
- `byteLength(entry)` — byte length of one entry serialized as `key=value` pairs.
- `batchSize(entries, maxBytes)` — count of leading entries that fit, or `-1` if none fit.
- `batchEntries(entries, maxBytes)` — array of batches, each within the budget.

## Design notes

The window stores values eagerly rather than keeping running aggregates. Running
sums drift with floating point over long streams, and recomputing from a small
buffer is cheap enough that the drift is not worth the speed.

