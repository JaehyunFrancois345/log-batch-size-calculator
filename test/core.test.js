import test from 'node:test';
import assert from 'node:assert/strict';
import { byteLength, batchSize, batchEntries, utf8Length } from '../src/index.js';

test('utf8Length counts ASCII as one byte each', () => {
  assert.equal(utf8Length('hello'), 5);
});

test('utf8Length counts multi-byte characters correctly', () => {
  // 'é' is two bytes in UTF-8; '😀' is four.
  assert.equal(utf8Length('é'), 2);
  assert.equal(utf8Length('😀'), 4);
});

test('utf8Length rejects non-strings', () => {
  assert.throws(() => utf8Length(42), TypeError);
});

test('byteLength of an empty entry is zero', () => {
  assert.equal(byteLength({}), 0);
});

test('byteLength serializes key=value pairs with spaces', () => {
  assert.equal(byteLength({ a: 1, b: 'two' }), 'a=1 b=two'.length);
});

test('byteLength accounts for UTF-8 bytes in keys and values', () => {
  assert.equal(byteLength({ 'é': '😀' }), utf8Length('é') + 1 + utf8Length('😀'));
});

test('byteLength renders null and undefined as empty values', () => {
  assert.equal(byteLength({ a: null, b: undefined }), 'a= b='.length);
});

test('byteLength rejects arrays and null', () => {
  assert.throws(() => byteLength([]), TypeError);
  assert.throws(() => byteLength(null), TypeError);
});

test('batchSize returns the count of entries that fit', () => {
  const entries = [{ a: 1 }, { b: 2 }, { c: 3 }];
  assert.equal(batchSize(entries, 100), 3);
  assert.equal(batchSize(entries, 3), 1);
});

test('batchSize returns -1 when the first entry does not fit', () => {
  assert.equal(batchSize([{ a: 1 }], 0), -1);
});

test('batchSize returns 0 for an empty list', () => {
  assert.equal(batchSize([], 10), 0);
});

test('batchSize rejects invalid arguments', () => {
  assert.throws(() => batchSize('nope', 10), TypeError);
  assert.throws(() => batchSize([], NaN), TypeError);
});

test('batchEntries splits entries into size-bounded batches', () => {
  const entries = [{ a: 1 }, { b: 2 }, { c: 3 }, { d: 4 }];
  const batches = batchEntries(entries, 3);
  assert.deepEqual(batches, [[{ a: 1 }], [{ b: 2 }], [{ c: 3 }], [{ d: 4 }]]);
});

test('batchEntries keeps an oversized entry as its own batch', () => {
  const entries = [{ a: 1 }, { b: 'x'.repeat(100) }, { c: 1 }];
  const batches = batchEntries(entries, 3);
  assert.deepEqual(batches, [[{ a: 1 }], [{ b: 'x'.repeat(100) }], [{ c: 1 }]]);
});

test('batchEntries accepts an empty input', () => {
  assert.deepEqual(batchEntries([], 10), []);
});

test('batchEntries rejects invalid arguments', () => {
  assert.throws(() => batchEntries({}, 10), TypeError);
  assert.throws(() => batchEntries([], NaN), TypeError);
});
