import type { SessionSummary } from '../contracts/sessions.js';

export interface ProjectSessionGroup {
  projectPath: string;
  projectName: string;
  sessions: SessionSummary[];
  total: number;
  expanded: boolean;
  latestUpdatedAt?: string;
}

export function projectNameFromPath(projectPath: string): string {
  const normalized = projectPath.trim().replace(/\/+$/, '');
  if (!normalized) return '未识别项目';
  return normalized.split('/').filter(Boolean).at(-1) || normalized;
}

export function groupSessionsByProject(
  sessions: SessionSummary[],
  expandedProjects: ReadonlySet<string>,
  collapsedLimit = 3,
): ProjectSessionGroup[] {
  const groupMap = new Map<string, SessionSummary[]>();
  for (const session of sessions) {
    const key = session.projectPath || '未识别项目';
    const current = groupMap.get(key) || [];
    current.push(session);
    groupMap.set(key, current);
  }

  return [...groupMap.entries()]
    .map(([projectPath, projectSessions]) => {
      const sorted = [...projectSessions].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
      const expanded = expandedProjects.has(projectPath);
      return {
        projectPath,
        projectName: projectNameFromPath(projectPath),
        sessions: expanded ? sorted : sorted.slice(0, collapsedLimit),
        total: sorted.length,
        expanded,
        latestUpdatedAt: sorted[0]?.updatedAt,
      };
    })
    .sort((a, b) => String(b.latestUpdatedAt || '').localeCompare(String(a.latestUpdatedAt || '')));
}
