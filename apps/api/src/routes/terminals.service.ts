import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  AiTool,
  CreateTerminalSessionRequest,
  TerminalClientMessage,
  TerminalServerMessage,
  TerminalSessionSummary,
  TerminalSessionStatus,
} from '@ai-manage/shared';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, stat } from 'node:fs/promises';
import type { IDisposable } from 'node-pty';
import type { WebSocket } from 'ws';
import { IndexRepository } from '../database/index.repository.js';

const terminalCommands: Record<AiTool, string> = {
  codex: 'codex',
  claude: 'claude',
};

const maxRunningSessions = 6;

interface TerminalRecord {
  summary: TerminalSessionSummary;
  pty?: TerminalPty;
  clients: Set<WebSocket>;
  disposables: IDisposable[];
}

interface TerminalPty {
  onData(callback: (data: string) => void): IDisposable;
  onExit(callback: (event: { exitCode: number }) => void): IDisposable;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
}

const pythonPtyBridge = [
  'import fcntl, os, pty, select, signal, struct, sys, termios',
  'cols = int(sys.argv[1])',
  'rows = int(sys.argv[2])',
  'cmd = sys.argv[3:]',
  'pid, fd = pty.fork()',
  'if pid == 0:',
  '    os.execvpe(cmd[0], cmd, os.environ)',
  'def stop_child(signum, frame):',
  '    try:',
  '        os.kill(pid, signal.SIGTERM)',
  '    except ProcessLookupError:',
  '        pass',
  'signal.signal(signal.SIGTERM, stop_child)',
  'signal.signal(signal.SIGINT, stop_child)',
  'def resize_pty(next_cols, next_rows):',
  '    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", next_rows, next_cols, 0, 0))',
  '    try:',
  '        os.kill(pid, signal.SIGWINCH)',
  '    except ProcessLookupError:',
  '        pass',
  'resize_pty(cols, rows)',
  'stdin_fd = sys.stdin.fileno()',
  'stdout_fd = sys.stdout.fileno()',
  'control_fd = 3',
  'control_buffer = b""',
  'while True:',
  '    try:',
  '        readable, _, _ = select.select([stdin_fd, fd, control_fd], [], [])',
  '    except OSError:',
  '        break',
  '    if control_fd in readable:',
  '        data = os.read(control_fd, 4096)',
  '        if data:',
  '            control_buffer += data',
  '            while b"\\n" in control_buffer:',
  '                line, control_buffer = control_buffer.split(b"\\n", 1)',
  '                parts = line.decode("utf-8", "ignore").strip().split()',
  '                if len(parts) == 3 and parts[0] == "resize":',
  '                    resize_pty(int(parts[1]), int(parts[2]))',
  '    if stdin_fd in readable:',
  '        data = os.read(stdin_fd, 4096)',
  '        if not data:',
  '            try:',
  '                os.close(fd)',
  '            except OSError:',
  '                pass',
  '            break',
  '        os.write(fd, data)',
  '    if fd in readable:',
  '        try:',
  '            data = os.read(fd, 4096)',
  '        except OSError:',
  '            break',
  '        if not data:',
  '            break',
  '        os.write(stdout_fd, data)',
  '        sys.stdout.flush()',
  'try:',
  '    _, status = os.waitpid(pid, 0)',
  'except ChildProcessError:',
  '    status = 0',
  'if os.WIFEXITED(status):',
  '    sys.exit(os.WEXITSTATUS(status))',
  'if os.WIFSIGNALED(status):',
  '    sys.exit(128 + os.WTERMSIG(status))',
  'sys.exit(0)',
].join('\n');

@Injectable()
export class TerminalsService {
  private readonly logger = new Logger(TerminalsService.name);
  private readonly sessions = new Map<string, TerminalRecord>();

  constructor(private readonly index: IndexRepository) {}

  /** Returns non-closed terminal sessions currently tracked by the process. */
  listSessions(): TerminalSessionSummary[] {
    return [...this.sessions.values()]
      .map(record => record.summary)
      .filter(session => session.status !== 'closed')
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  /** Creates a PTY-backed terminal session in an indexed project directory. */
  async createSession(request: CreateTerminalSessionRequest): Promise<TerminalSessionSummary> {
    this.logger.log(
      `Create terminal requested: tool=${request.tool}, projectPath=${request.projectPath}, resumeSessionId=${request.resumeSessionId || '-'}, cols=${request.cols || '-'}, rows=${request.rows || '-'}`,
    );

    if (!this.isAiTool(request.tool)) {
      this.logger.warn(`Rejected terminal request with unsupported tool: ${String(request.tool)}`);
      throw new BadRequestException('Unsupported terminal tool');
    }
    if (this.runningCount() >= maxRunningSessions) {
      this.logger.warn(`Rejected terminal request because running session count reached ${maxRunningSessions}`);
      throw new BadRequestException(`最多同时运行 ${maxRunningSessions} 个会话`);
    }

    const project = await this.findProject(request.tool, request.projectPath);
    if (!project) {
      this.logger.warn(`Rejected terminal request because project is not indexed: ${request.projectPath}`);
      throw new BadRequestException('Project path is not in the indexed project list');
    }
    if (request.resumeSessionId) {
      await this.ensureResumeSession(request.tool, project.projectPath, request.resumeSessionId);
    }

    const id = randomUUID();
    const startedAt = new Date().toISOString();
    const summary: TerminalSessionSummary = {
      id,
      tool: request.tool,
      projectPath: project.projectPath,
      projectName: project.projectName,
      resumeSessionId: request.resumeSessionId,
      status: 'running',
      startedAt,
    };
    const record: TerminalRecord = {
      summary,
      clients: new Set(),
      disposables: [],
    };
    this.sessions.set(id, record);

    try {
      record.pty = await this.spawnPty(
        request.tool,
        project.projectPath,
        request.resumeSessionId,
        request.cols,
        request.rows,
      );
    } catch (error) {
      this.sessions.delete(id);
      this.logger.error(
        `Failed to spawn terminal: tool=${request.tool}, projectPath=${project.projectPath}, error=${this.errorMessage(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException(error instanceof Error ? error.message : String(error));
    }

    record.disposables.push(
      record.pty.onData(data => this.broadcast(id, { type: 'output', data })),
      record.pty.onExit(event => {
        this.markExited(id, event.exitCode);
      }),
    );

    return summary;
  }

  /** Closes a terminal session and releases its PTY process. */
  closeSession(id: string) {
    const record = this.requireRecord(id);
    if (record.summary.status === 'running') {
      record.summary.status = 'closed';
      record.summary.exitedAt = new Date().toISOString();
      try {
        record.pty?.kill();
      } catch {
        // The process may already be gone; the session is removed either way.
      }
    }
    this.disposeRecord(record);
    this.sessions.delete(id);
    return { id, status: 'closed' as TerminalSessionStatus };
  }

  /** Registers a websocket as a viewer/controller for one terminal session. */
  attachClient(id: string, client: WebSocket): TerminalSessionSummary {
    const record = this.requireRecord(id);
    record.clients.add(client);
    this.send(client, { type: 'ready', session: record.summary });
    return record.summary;
  }

  /** Detaches a websocket without stopping the backing PTY session. */
  detachClient(id: string, client: WebSocket) {
    this.sessions.get(id)?.clients.delete(client);
  }

  /** Applies user input or resize events received from the browser terminal. */
  handleClientMessage(id: string, message: TerminalClientMessage) {
    const record = this.requireRecord(id);
    if (record.summary.status !== 'running' || !record.pty) return;
    if (message.type === 'input') {
      record.pty.write(message.data);
      return;
    }
    if (message.type === 'resize') {
      const cols = this.clampDimension(message.cols, 20, 240);
      const rows = this.clampDimension(message.rows, 5, 120);
      record.pty.resize(cols, rows);
    }
  }

  private async spawnPty(
    tool: AiTool,
    projectPath: string,
    resumeSessionId?: string,
    cols = 100,
    rows = 28,
  ): Promise<TerminalPty> {
    await this.ensureProjectDirectory(projectPath);
    await this.ensureShellAvailable();

    const shell = this.loginShell();
    const command = this.launchCommand(tool, projectPath, resumeSessionId);
    const env = this.terminalEnv();
    const bootstrapCwd = this.bootstrapCwd();
    const normalizedCols = this.clampDimension(cols, 20, 240);
    const normalizedRows = this.clampDimension(rows, 5, 120);
    this.logger.log(
      [
        `Spawning terminal: tool=${tool}`,
        `shell=${shell}`,
        `bootstrapCwd=${bootstrapCwd}`,
        `projectPath=${projectPath}`,
        `resumeSessionId=${resumeSessionId || '-'}`,
        `cols=${normalizedCols}`,
        `rows=${normalizedRows}`,
        `PATH=${env.PATH || ''}`,
        `command=${command.replace(/\n/g, ' ')}`,
      ].join(', '),
    );

    try {
      const pty = await import('node-pty');
      return pty.spawn(shell, ['-l', '-c', command], {
        name: 'xterm-256color',
        cols: normalizedCols,
        rows: normalizedRows,
        cwd: bootstrapCwd,
        env,
      });
    } catch (error) {
      this.logger.warn(
        `node-pty failed, falling back to Python pty bridge: error=${this.errorMessage(error)}`,
      );
      return this.spawnPythonPty(shell, command, bootstrapCwd, env, normalizedCols, normalizedRows);
    }
  }

  /** Starts a PTY through Python's standard pty module when native node-pty cannot spawn. */
  private spawnPythonPty(
    shell: string,
    command: string,
    cwd: string,
    env: NodeJS.ProcessEnv,
    cols: number,
    rows: number,
  ): TerminalPty {
    const child = spawn(
      'python3',
      ['-c', pythonPtyBridge, String(cols), String(rows), shell, '-l', '-c', command],
      { cwd, env, stdio: ['pipe', 'pipe', 'pipe', 'pipe'] },
    );
    return new ChildProcessPty(child);
  }

  /** Returns a login shell so GUI-launched API processes can resolve Homebrew/npm CLI paths. */
  private loginShell() {
    const shell = process.env.SHELL || '/bin/zsh';
    return /\/(bash|zsh)$/.test(shell) ? shell : '/bin/zsh';
  }

  /** Builds the fixed command line for a whitelisted AI tool. */
  private launchCommand(tool: AiTool, projectPath: string, resumeSessionId?: string) {
    const command = terminalCommands[tool];
    const commandArgs = this.launchCommandArgs(tool, resumeSessionId);
    return [
      `cd ${this.shellQuote(projectPath)} || {`,
      `  echo "无法进入项目目录：${projectPath}" >&2;`,
      '  exit 1;',
      '}',
      `command -v ${command} >/dev/null 2>&1 || {`,
      `  echo "未找到 ${command} 命令，请确认它已安装并在登录 shell 的 PATH 中。" >&2;`,
      '  exit 127;',
      '}',
      `exec ${command} ${commandArgs.join(' ')}`.trimEnd(),
    ].join('\n');
  }

  /** Builds fixed whitelisted CLI arguments for new or resumed conversations. */
  private launchCommandArgs(tool: AiTool, resumeSessionId?: string) {
    if (!resumeSessionId) return [];
    if (tool === 'codex') return ['resume', this.shellQuote(resumeSessionId)];
    return ['--resume', this.shellQuote(resumeSessionId)];
  }

  /** Uses an ASCII-safe startup directory before the shell changes into the project path. */
  private bootstrapCwd() {
    return process.env.HOME || '/tmp';
  }

  /** Quotes a value for the static shell bootstrap command. */
  private shellQuote(value: string) {
    return `'${value.replace(/'/g, String.raw`'\''`)}'`;
  }

  /** Adds common local binary folders that may be missing from desktop-app environments. */
  private terminalEnv(): NodeJS.ProcessEnv {
    const home = process.env.HOME || '';
    const pathEntries = [
      process.env.PATH,
      home ? `${home}/.local/bin` : '',
      home ? `${home}/.npm-global/bin` : '',
      home ? `${home}/.bun/bin` : '',
      home ? `${home}/.volta/bin` : '',
      home ? `${home}/.local/share/mise/shims` : '',
      '/opt/homebrew/bin',
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin',
    ].filter(Boolean);

    return {
      ...process.env,
      PATH: [...new Set(pathEntries)].join(':'),
    };
  }

  /** Ensures the indexed project can be used as a PTY working directory. */
  private async ensureProjectDirectory(projectPath: string) {
    try {
      const projectStat = await stat(projectPath);
      if (!projectStat.isDirectory()) {
        this.logger.warn(`Terminal project path is not a directory: ${projectPath}`);
        throw new BadRequestException(`项目路径不是目录：${projectPath}`);
      }
      this.logger.debug(`Terminal project directory verified: ${projectPath}`);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.warn(`Terminal project directory is not accessible: ${projectPath}, error=${this.errorMessage(error)}`);
      throw new BadRequestException(`项目目录不存在或无法访问：${projectPath}`);
    }
  }

  /** Ensures the shell used to bootstrap terminal sessions exists. */
  private async ensureShellAvailable() {
    const shell = this.loginShell();
    try {
      await access(shell);
      this.logger.debug(`Terminal login shell verified: ${shell}`);
    } catch {
      this.logger.warn(`Terminal login shell is not accessible: ${shell}`);
      throw new BadRequestException(`无法访问登录 shell：${shell}`);
    }
  }

  /** Converts unknown thrown values into a compact log message. */
  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  private async findProject(tool: AiTool, projectPath: string) {
    const projects = await this.index.listProjects(tool);
    return projects.find(project => project.projectPath === projectPath);
  }

  /** Ensures resumed terminals can only target an indexed session in the same project. */
  private async ensureResumeSession(tool: AiTool, projectPath: string, sessionId: string) {
    const session = await this.index.getSession(tool, sessionId);
    if (!session) {
      this.logger.warn(`Rejected terminal resume because session is not indexed: tool=${tool}, sessionId=${sessionId}`);
      throw new BadRequestException('Resume session is not in the indexed session list');
    }
    if (session.projectPath !== projectPath) {
      this.logger.warn(
        `Rejected terminal resume because project mismatch: sessionId=${sessionId}, sessionProject=${session.projectPath}, requestedProject=${projectPath}`,
      );
      throw new BadRequestException('Resume session does not belong to the requested project');
    }
  }

  private runningCount() {
    return [...this.sessions.values()].filter(record => record.summary.status === 'running').length;
  }

  private requireRecord(id: string): TerminalRecord {
    const record = this.sessions.get(id);
    if (!record || record.summary.status === 'closed') {
      throw new NotFoundException('Terminal session not found');
    }
    return record;
  }

  private markExited(id: string, exitCode: number) {
    const record = this.sessions.get(id);
    if (!record || record.summary.status !== 'running') return;
    record.summary.status = 'exited';
    record.summary.exitedAt = new Date().toISOString();
    record.summary.exitCode = exitCode;
    this.broadcast(id, { type: 'exit', session: record.summary });
    this.disposeRecord(record);
  }

  private disposeRecord(record: TerminalRecord) {
    for (const disposable of record.disposables) {
      disposable.dispose();
    }
    record.disposables = [];
    for (const client of record.clients) {
      client.close();
    }
    record.clients.clear();
  }

  private broadcast(id: string, message: TerminalServerMessage) {
    const record = this.sessions.get(id);
    if (!record) return;
    for (const client of record.clients) {
      this.send(client, message);
    }
  }

  private send(client: WebSocket, message: TerminalServerMessage) {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  private clampDimension(value: number | undefined, min: number, max: number) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, Math.floor(Number(value))));
  }

  private isAiTool(value: string): value is AiTool {
    return value === 'codex' || value === 'claude';
  }
}

class ChildProcessPty implements TerminalPty {
  constructor(private readonly child: ChildProcess) {}

  onData(callback: (data: string) => void): IDisposable {
    const stdoutListener = (chunk: Buffer) => callback(chunk.toString());
    const stderrListener = (chunk: Buffer) => callback(chunk.toString());
    const errorListener = (error: Error) => callback(`\r\n[PTY bridge error: ${error.message}]\r\n`);
    this.child.stdout?.on('data', stdoutListener);
    this.child.stderr?.on('data', stderrListener);
    this.child.on('error', errorListener);
    return {
      dispose: () => {
        this.child.stdout?.off('data', stdoutListener);
        this.child.stderr?.off('data', stderrListener);
        this.child.off('error', errorListener);
      },
    };
  }

  onExit(callback: (event: { exitCode: number }) => void): IDisposable {
    const exitListener = (code: number | null) => callback({ exitCode: code ?? 0 });
    this.child.on('exit', exitListener);
    return {
      dispose: () => this.child.off('exit', exitListener),
    };
  }

  write(data: string): void {
    if (!this.child.killed && this.child.stdin?.writable) {
      this.child.stdin.write(data);
    }
  }

  resize(cols: number, rows: number): void {
    const control = this.child.stdio[3];
    if (!this.child.killed && control && 'write' in control && typeof control.write === 'function') {
      control.write(`resize ${cols} ${rows}\n`);
    }
  }

  kill(): void {
    if (!this.child.killed) {
      this.child.kill();
    }
  }
}
