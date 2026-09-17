import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORTER_PS1 = path.join(__dirname, 'windows-reporter.ps1');

export function reportStatus(status, title, message = '', percent = -1, timeoutSeconds = 5, asyncMode = true) {
  const args = [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', REPORTER_PS1,
    '-Status', status,
    '-Title', title,
    '-Message', message,
    '-TimeoutSeconds', String(timeoutSeconds)
  ];
  if (percent >= 0) {
    args.push('-Percent', String(percent));
  }
  if (asyncMode) {
    args.push('-Async');
  }

  try {
    const child = spawn('powershell.exe', args, { detached: true, stdio: 'ignore' });
    child.unref();
    return true;
  } catch (err) {
    console.error('[ReporterError] Failed to spawn popup:', err);
    return false;
  }
}

export class WorkflowReporter {
  constructor(title, initialMsg = 'Task started...', timeout = 4) {
    this.title = title;
    this.timeout = timeout;
    reportStatus('RUNNING', this.title, initialMsg, -1, this.timeout, true);
  }

  progress(percent, msg = '') {
    reportStatus('PROGRESS', this.title, msg, percent, this.timeout, true);
  }

  completed(msg = 'Task completed successfully.', timeout = 5) {
    reportStatus('COMPLETED', this.title, msg, 100, timeout, true);
  }

  error(msg = 'Task encountered an error.', timeout = 8) {
    reportStatus('ERROR', this.title, msg, -1, timeout, true);
  }
}
