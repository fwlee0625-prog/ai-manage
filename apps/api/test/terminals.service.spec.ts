import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { AiTool } from '@ai-manage/shared';
import type { IndexRepository } from '../src/database/index.repository.js';
import { TerminalsService } from '../src/routes/terminals.service.js';

class FakePty {
  written = '';
  resized?: { cols: number; rows: number };
  killed = false;
  private exitHandler?: (event: { exitCode: number }) => void;

  onData() {
    return { dispose: () => undefined };
  }

  onExit(handler: (event: { exitCode: number }) => void) {
    this.exitHandler = handler;
    return { dispose: () => undefined };
  }

  write(data: string) {
    this.written += data;
  }

  resize(cols: number, rows: number) {
    this.resized = { cols, rows };
  }

  kill() {
    this.killed = true;
    this.exitHandler?.({ exitCode: 0 });
  }
}

function createService(projectPath = '/tmp/demo') {
  const fakeIndex = {
    listProjects: async (tool?: AiTool) => [{
      tool: tool || 'codex',
      projectPath,
      projectName: 'demo',
      sessionCount: 1,
    }],
    getSession: async (tool: AiTool, id: string) => ({
      id,
      tool,
      title: 'demo session',
      projectPath,
      sourcePath: '/tmp/demo/session.jsonl',
      messageCount: 1,
      preview: 'hello',
    }),
  } as Pick<IndexRepository, 'listProjects' | 'getSession'> as IndexRepository;
  const spawned: FakePty[] = [];
  const service = new TerminalsService(fakeIndex);
  Reflect.set(service, 'spawnPty', async () => {
    const pty = new FakePty();
    spawned.push(pty);
    return pty;
  });
  return { service, spawned, projectPath };
}

describe('TerminalsService', () => {
  it('rejects unsupported tools', async () => {
    const { service, projectPath } = createService();
    await expect(service.createSession({
      tool: 'vim' as AiTool,
      projectPath,
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects project paths outside the indexed project list', async () => {
    const { service } = createService('/tmp/indexed');
    await expect(service.createSession({
      tool: 'codex',
      projectPath: '/tmp/other',
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('limits concurrent running terminal sessions', async () => {
    const { service, projectPath } = createService();
    for (let index = 0; index < 6; index += 1) {
      await service.createSession({ tool: 'codex', projectPath });
    }

    await expect(service.createSession({
      tool: 'codex',
      projectPath,
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('forwards input and resize messages to the active PTY', async () => {
    const { service, spawned, projectPath } = createService();
    const session = await service.createSession({ tool: 'claude', projectPath });

    service.handleClientMessage(session.id, { type: 'input', data: 'hello' });
    service.handleClientMessage(session.id, { type: 'resize', cols: 120, rows: 30 });

    expect(spawned[0].written).toBe('hello');
    expect(spawned[0].resized).toEqual({ cols: 120, rows: 30 });
  });

  it('starts a terminal session that resumes an indexed conversation', async () => {
    const { service, projectPath } = createService();
    const session = await service.createSession({
      tool: 'codex',
      projectPath,
      resumeSessionId: 'session-1',
    });

    expect(session.resumeSessionId).toBe('session-1');
  });

  it('rejects resume sessions from another project', async () => {
    const { service, projectPath } = createService('/tmp/indexed');
    Reflect.set(service, 'index', {
      listProjects: async () => [{
        tool: 'codex',
        projectPath,
        projectName: 'demo',
        sessionCount: 1,
      }],
      getSession: async () => ({
        id: 'session-2',
        tool: 'codex',
        title: 'other',
        projectPath: '/tmp/other',
        sourcePath: '/tmp/other/session.jsonl',
        messageCount: 1,
        preview: '',
      }),
    });

    await expect(service.createSession({
      tool: 'codex',
      projectPath,
      resumeSessionId: 'session-2',
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('kills and removes a terminal session when closed', async () => {
    const { service, spawned, projectPath } = createService();
    const session = await service.createSession({ tool: 'codex', projectPath });

    const result = service.closeSession(session.id);

    expect(result).toEqual({ id: session.id, status: 'closed' });
    expect(spawned[0].killed).toBe(true);
    expect(service.listSessions()).toEqual([]);
  });
});
