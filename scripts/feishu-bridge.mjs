#!/usr/bin/env node
/**
 * Feishu Bridge for openclaw-gift-design
 *
 * Fetches ops document content via lark-cli (already available in OpenClaw environment).
 * Result delivery back to Feishu is handled by OpenClaw through standard mediaUrls fields.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Execute a lark-cli command and return parsed JSON output.
 * Uses shell:true so .cmd wrappers resolve correctly on Windows.
 * Do NOT use this for commands with large arguments - use runLarkCliDirect instead.
 */
export async function runLarkCli(args, { identity = 'user', execImpl = execFileAsync } = {}) {
  const fullArgs = [...args, '--as', identity, '--format', 'json'];
  const { stdout } = await execImpl('lark-cli', fullArgs, {
    encoding: 'utf8',
    timeout: 30000,
    shell: true,
  });
  return JSON.parse(stdout.trim());
}

/**
 * Resolve a direct, shell-free lark-cli command.
 * On Windows we prefer the package's native executable to avoid cmd.exe
 * truncation and quoting issues when passing multi-line markdown.
 */
export function resolveLarkCliDirectCommand({
  platform = process.platform,
  env = process.env,
  existsSyncImpl = existsSync,
} = {}) {
  if (platform !== 'win32') {
    return { file: 'lark-cli', prefixArgs: [] };
  }

  const appData = env.APPDATA?.trim();
  const overrideBin = env.LARK_CLI_BIN?.trim();
  if (overrideBin) {
    return { file: overrideBin, prefixArgs: [] };
  }

  const overrideRunJs = env.LARK_CLI_RUN_JS?.trim();
  if (overrideRunJs) {
    return { file: process.execPath, prefixArgs: [overrideRunJs] };
  }

  if (appData) {
    const packageRoot = join(appData, 'npm', 'node_modules', '@larksuite', 'cli');
    const nativeBinPath = join(packageRoot, 'bin', 'lark-cli.exe');
    if (existsSyncImpl(nativeBinPath)) {
      return { file: nativeBinPath, prefixArgs: [] };
    }

    const runScriptPath = join(packageRoot, 'scripts', 'run.js');
    if (existsSyncImpl(runScriptPath)) {
      return { file: process.execPath, prefixArgs: [runScriptPath] };
    }
  }

  return { file: 'lark-cli.cmd', prefixArgs: [] };
}

/**
 * Execute a lark-cli command without going through cmd.exe.
 * This avoids the Windows shell eating long or multi-line markdown content.
 */
export async function runLarkCliDirect(
  args,
  {
    identity = 'user',
    timeout = 60000,
    execImpl = execFileAsync,
    platform = process.platform,
    env = process.env,
    existsSyncImpl = existsSync,
  } = {},
) {
  const { file, prefixArgs } = resolveLarkCliDirectCommand({
    platform,
    env,
    existsSyncImpl,
  });
  const fullArgs = [...prefixArgs, ...args, '--as', identity, '--format', 'json'];

  try {
    const { stdout } = await execImpl(file, fullArgs, {
      encoding: 'utf8',
      timeout,
      shell: false,
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(stdout.trim());
  } catch (error) {
    const stderr = typeof error?.stderr === 'string' ? error.stderr.slice(0, 800) : '';
    const stdout = typeof error?.stdout === 'string' ? error.stdout.slice(0, 400) : '';
    throw new Error(`lark-cli direct execution failed: ${error.message}\nstderr: ${stderr}\nstdout: ${stdout}`);
  }
}

/**
 * Create a design document in the user's personal Feishu space.
 * Returns { url, doc_id }.
 *
 * Uses runLarkCliDirect (exec without shell) because markdownContent can be large
 * and contain characters that break cmd.exe argument parsing on Windows.
 */
export async function createFeishuDesignDoc(
  title,
  markdownContent,
  {
    identity = 'user',
    execImpl = execFileAsync,
    platform = process.platform,
    env = process.env,
    existsSyncImpl = existsSync,
  } = {},
) {
  if (!title || !title.trim()) {
    throw new Error('title is required to create a Feishu design document.');
  }
  const result = await runLarkCliDirect(
    ['docs', '+create', '--title', title.trim(), '--markdown', markdownContent],
    {
      identity,
      execImpl,
      platform,
      env,
      existsSyncImpl,
    },
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
 * Uses runLarkCli (shell:true) because the doc URL is short and doesn't need the direct path.
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

