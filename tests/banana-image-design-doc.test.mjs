import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { parseDesignDocGifts } from '../scripts/banana-image.mjs';

test('parseDesignDocGifts reads JSON from @file path', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'banana-gifts-'));
  const jsonPath = join(tempDir, 'gifts.json');

  try {
    await writeFile(
      jsonPath,
      JSON.stringify([{ name: 'gift1', price_str: '99coin' }]),
      'utf8',
    );

    const gifts = await parseDesignDocGifts(`@${jsonPath}`);
    assert.deepEqual(gifts, [{ name: 'gift1', price_str: '99coin' }]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('parseDesignDocGifts reads JSON from explicit file path option', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'banana-gifts-'));
  const jsonPath = join(tempDir, 'gifts.json');

  try {
    await writeFile(
      jsonPath,
      JSON.stringify([{ name: 'gift2', price_str: '299coin' }]),
      'utf8',
    );

    const gifts = await parseDesignDocGifts(null, jsonPath);
    assert.deepEqual(gifts, [{ name: 'gift2', price_str: '299coin' }]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
