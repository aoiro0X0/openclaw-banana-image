#!/usr/bin/env node
/**
 * Feishu Bridge for openclaw-banana-image
 *
 * Fetches ops document content via lark-cli (already available in OpenClaw environment).
 * Result delivery back to Feishu is handled by OpenClaw through standard mediaUrls fields.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Execute a lark-cli command and return parsed JSON output.
 */
export async function runLarkCli(args, { identity = 'user', execImpl = execFileAsync } = {}) {
  const fullArgs = [...args, '--as', identity, '--format', 'json'];
  const { stdout } = await execImpl('lark-cli', fullArgs, {
    encoding: 'utf8',
    timeout: 30000,
  });
  return JSON.parse(stdout.trim());
}

/**
 * Fetch document content from a Feishu doc URL.
 * Returns the markdown string content.
 */
export async function fetchFeishuDoc(docUrl, { identity = 'user', execImpl = execFileAsync } = {}) {
  if (!docUrl || !docUrl.trim()) {
    throw new Error('docUrl is required to fetch a Feishu document.');
  }
  const result = await runLarkCli(['docs', '+fetch', '--doc', docUrl.trim()], {
    identity,
    execImpl,
  });
  if (!result.ok) {
    throw new Error(`Feishu doc fetch failed: ${JSON.stringify(result).slice(0, 300)}`);
  }
  return result.data?.markdown ?? result.data?.content ?? '';
}
