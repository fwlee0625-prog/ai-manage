import type { AiTool, SessionsQuery } from '@ai-manage/shared';
import { clampPage, clampPageSize } from '../utils.js';
import { sqlString } from './sqlite-database.js';

export interface SessionQuerySql {
  where: string;
  limit: number;
  offset: number;
  page: number;
  pageSize: number;
}

export const SESSION_SELECT_COLUMNS = `
  id,
  tool,
  title,
  project_path AS projectPath,
  created_at AS createdAt,
  updated_at AS updatedAt,
  source_path AS sourcePath,
  message_count AS messageCount,
  preview
`;

export function buildSessionQuerySql(query: SessionsQuery): SessionQuerySql {
  const page = clampPage(query.page);
  const pageSize = clampPageSize(query.pageSize);
  return {
    where: whereClause(sessionConditions(query)),
    limit: pageSize,
    offset: (page - 1) * pageSize,
    page,
    pageSize,
  };
}

export function projectWhereClause(tool?: AiTool): string {
  return whereClause(tool ? [`tool = ${sqlString(tool)}`] : []);
}

export function sessionIdentityWhereClause(tool: AiTool, id: string): string {
  return whereClause([
    `tool = ${sqlString(tool)}`,
    `id = ${sqlString(id)}`,
  ]);
}

export function toolWhereClause(tool: AiTool): string {
  return whereClause([`tool = ${sqlString(tool)}`]);
}

function sessionConditions(query: SessionsQuery): string[] {
  const conditions: string[] = [];
  if (query.tool) conditions.push(`tool = ${sqlString(query.tool)}`);
  if (query.projectPath) conditions.push(`project_path = ${sqlString(query.projectPath)}`);
  if (query.keyword) conditions.push(`search_text LIKE ${sqlString(`%${query.keyword}%`)}`);
  if (query.startAt) conditions.push(`datetime(updated_at) >= datetime(${sqlString(query.startAt)})`);
  if (query.endAt) conditions.push(`datetime(updated_at) <= datetime(${sqlString(query.endAt)})`);
  return conditions;
}

function whereClause(conditions: string[]): string {
  return conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
}
