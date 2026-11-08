import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseCategories, deduplicateCategories, categoryMatches, canonicalizeCategory } from './categoryUtils.ts';

describe('categoryUtils', () => {
  it('deduplicates categories case-insensitively', () => {
    const raw = ['oil', 'Oil', 'Spare Parts', 'oil', 'spare parts'];
    const result = deduplicateCategories(raw);
    assert.deepStrictEqual(result, ['Oil', 'Spare Parts']);
  });

  it('matches category case-insensitively', () => {
    assert.strictEqual(categoryMatches('Oil', 'oil'), true);
    assert.strictEqual(categoryMatches('oil', 'Oil'), true);
    assert.strictEqual(categoryMatches('oil, parts', 'Oil'), true);
    assert.strictEqual(categoryMatches('oil, parts', 'PARTS'), true);
    assert.strictEqual(categoryMatches('oil, parts', 'All'), true);
    assert.strictEqual(categoryMatches('oil, parts', 'other'), false);
    assert.strictEqual(categoryMatches(['oil', 'filter'], 'Oil'), true);
  });

  it('canonicalizes categories correctly', () => {
    assert.strictEqual(canonicalizeCategory('oil'), 'Oil');
    assert.strictEqual(canonicalizeCategory('spare parts'), 'Spare Parts');
    assert.strictEqual(canonicalizeCategory('Oil'), 'Oil');
  });

  it('parses comma-separated categories cleanly', () => {
    assert.deepStrictEqual(parseCategories('oil, filter , spare parts'), ['oil', 'filter', 'spare parts']);
    assert.deepStrictEqual(parseCategories(''), []);
    assert.deepStrictEqual(parseCategories(null), []);
  });
});

