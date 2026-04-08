import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createFeishuDesignDoc,
  resolveLarkCliDirectCommand,
} from '../scripts/feishu-bridge.mjs';

test('resolveLarkCliDirectCommand prefers lark-cli.exe on Windows', () => {
  const result = resolveLarkCliDirectCommand({
    platform: 'win32',
    env: {
      APPDATA: 'C:\\Users\\Admin\\AppData\\Roaming',
    },
    existsSyncImpl: (filePath) => filePath.endsWith('bin\\lark-cli.exe'),
  });

  assert.equal(
    result.file,
    'C:\\Users\\Admin\\AppData\\Roaming\\npm\\node_modules\\@larksuite\\cli\\bin\\lark-cli.exe',
  );
  assert.deepEqual(result.prefixArgs, []);
});

test('createFeishuDesignDoc uses direct execution without shell on Windows', async () => {
  const calls = [];
  const markdownContent = '# Design Doc\n\n| Gift | Tier |\n| --- | --- |\n| Banana | Head |';

  const result = await createFeishuDesignDoc('Gift Batch', markdownContent, {
    platform: 'win32',
    env: {
      APPDATA: 'C:\\Users\\Admin\\AppData\\Roaming',
    },
    existsSyncImpl: (filePath) => filePath.endsWith('bin\\lark-cli.exe'),
    execImpl: async (file, args, options) => {
      calls.push({ file, args, options });
      return {
        stdout: JSON.stringify({
          ok: true,
          data: {
            url: 'https://example.com/doc',
            doc_id: 'doc_123',
          },
        }),
      };
    },
  });

  assert.deepEqual(result, {
    url: 'https://example.com/doc',
    doc_id: 'doc_123',
  });
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].file,
    'C:\\Users\\Admin\\AppData\\Roaming\\npm\\node_modules\\@larksuite\\cli\\bin\\lark-cli.exe',
  );
  assert.equal(calls[0].options.shell, false);
  assert.equal(calls[0].options.encoding, 'utf8');
  assert.ok(calls[0].args.includes('--markdown'));
  assert.ok(calls[0].args.includes(markdownContent));
});
