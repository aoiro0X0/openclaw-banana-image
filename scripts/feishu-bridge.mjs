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
 * Create a design document in the user's personal Feishu space.
 * Returns { url, doc_id }.
 */
export async function createFeishuDesignDoc(title, markdownContent, { identity = 'user', execImpl = execFileAsync } = {}) {
  if (!title || !title.trim()) {
    throw new Error('title is required to create a Feishu design document.');
  }
  const result = await runLarkCli(
    ['docs', '+create', '--title', title.trim(), '--markdown', markdownContent, '--wiki-space', 'my_library'],
    { identity, execImpl },
  );
  if (!result.ok) {
    throw new Error(`Feishu design doc creation failed: ${JSON.stringify(result).slice(0, 300)}`);
  }
  return {
    url: result.data?.url ?? result.data?.doc_url ?? null,
    doc_id: result.data?.doc_id ?? null,
  };
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
