import { describe, expect, it } from 'vitest';

import { extractRecordId, normalizeRecord } from '../../src/attio/record-utils';

describe('record-utils', () => {
  it('extracts record id from nested data shapes', () => {
    const record = {
      data: {
        record: {
          id: {
            record_id: 'rec-123',
          },
        },
      },
    };

    expect(extractRecordId(record)).toBe('rec-123');
  });

  it('normalizes record and fills values', () => {
    const record = {
      data: {
        id: { record_id: 'rec-456' },
        values: { name: [{ value: 'Acme' }] },
      },
    };

    const normalized = normalizeRecord(record as Record<string, unknown>);
    expect(normalized.id?.record_id).toBe('rec-456');
    expect(normalized.values?.name).toBeTruthy();
  });
});
