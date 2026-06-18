import { describe, expect, it } from 'vitest';
import {
  buildSessionQuerySql,
  projectWhereClause,
  sessionIdentityWhereClause,
  toolWhereClause,
} from '../src/database/index.queries.js';

describe('index query helpers', () => {
  it('builds session filters with pagination', () => {
    const query = buildSessionQuerySql({
      tool: 'codex',
      projectPath: '/tmp/project',
      keyword: "router's issue",
      startAt: '2026-06-01T00:00:00.000Z',
      endAt: '2026-06-30T00:00:00.000Z',
      page: 2,
      pageSize: 25,
    });

    expect(query.page).toBe(2);
    expect(query.pageSize).toBe(25);
    expect(query.limit).toBe(25);
    expect(query.offset).toBe(25);
    expect(query.where).toContain("tool = 'codex'");
    expect(query.where).toContain("project_path = '/tmp/project'");
    expect(query.where).toContain("search_text LIKE '%router''s issue%'");
    expect(query.where).toContain("datetime(updated_at) >= datetime('2026-06-01T00:00:00.000Z')");
    expect(query.where).toContain("datetime(updated_at) <= datetime('2026-06-30T00:00:00.000Z')");
  });

  it('builds empty and identity where clauses', () => {
    expect(projectWhereClause()).toBe('');
    expect(projectWhereClause('claude')).toBe("WHERE tool = 'claude'");
    expect(toolWhereClause('codex')).toBe("WHERE tool = 'codex'");
    expect(sessionIdentityWhereClause('codex', "abc'123")).toBe("WHERE tool = 'codex' AND id = 'abc''123'");
  });
});
