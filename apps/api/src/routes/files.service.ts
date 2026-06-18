import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AiTool,
  ToolDirectoryListing,
  ToolFileBreadcrumb,
  ToolFileEntry,
  ToolFilePreview,
  ToolFilePreviewType,
} from '@ai-manage/shared';
import { existsSync } from 'node:fs';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { basename, extname, relative, resolve } from 'node:path';
import { AdapterRegistry } from '../adapters/adapter-registry.js';
import type { AiToolAdapter } from '../adapters/ai-tool.adapter.js';
import { PathGuard } from '../fs/path-guard.js';

const MAX_TEXT_PREVIEW_BYTES = 1024 * 1024;
const MAX_IMAGE_PREVIEW_BYTES = 5 * 1024 * 1024;

const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.log',
  '.jsonl',
  '.toml',
  '.yaml',
  '.yml',
  '.csv',
  '.tsv',
  '.js',
  '.ts',
  '.mjs',
  '.cjs',
  '.vue',
  '.css',
  '.scss',
  '.html',
  '.xml',
  '.sh',
  '.zsh',
  '.bash',
  '.py',
  '.rs',
  '.go',
  '.java',
  '.sql',
]);

const IMAGE_MIME_TYPES = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
]);

@Injectable()
export class FilesService {
  constructor(
    private readonly adapters: AdapterRegistry,
    private readonly pathGuard: PathGuard,
  ) {}

  /** Lists a directory inside a supported tool root. */
  async files(tool?: AiTool, relativePath = ''): Promise<ToolDirectoryListing> {
    const adapter = tool ? this.requireAdapter(tool) : this.adapters.all()[0];
    const dirPath = this.resolveToolPath(adapter, relativePath);
    const meta = await this.statExisting(dirPath);
    if (!meta.isDirectory()) throw new BadRequestException('Path is not a directory');

    const entries = await Promise.all((await readdir(dirPath)).map(async name => {
      const fullPath = resolve(dirPath, name);
      const entryMeta = await lstat(fullPath);
      const path = this.toRelativeToolPath(adapter, fullPath);
      return {
        tool: adapter.tool,
        name,
        path,
        kind: entryMeta.isDirectory() ? 'directory' : entryMeta.isSymbolicLink() ? 'symlink' : 'file',
        size: entryMeta.size,
        updatedAt: entryMeta.mtime.toISOString(),
        extension: entryMeta.isFile() ? extname(name).toLowerCase() : undefined,
      } satisfies ToolFileEntry;
    }));

    return {
      tool: adapter.tool,
      rootPath: adapter.rootPath,
      path: this.toRelativeToolPath(adapter, dirPath),
      breadcrumbs: this.breadcrumbs(adapter, dirPath),
      entries: entries.sort((a, b) => {
        if (a.kind === 'directory' && b.kind !== 'directory') return -1;
        if (a.kind !== 'directory' && b.kind === 'directory') return 1;
        return a.name.localeCompare(b.name, 'zh-CN');
      }),
    };
  }

  /** Returns text, markdown, JSON, or small image previews for a file. */
  async filePreview(tool?: AiTool, relativePath = ''): Promise<ToolFilePreview> {
    if (!tool) throw new BadRequestException('tool is required');
    if (!relativePath) throw new BadRequestException('path is required');

    const adapter = this.requireAdapter(tool);
    const filePath = this.resolveToolPath(adapter, relativePath);
    const meta = await this.statExisting(filePath);
    if (!meta.isFile()) throw new BadRequestException('Path is not a file');

    const name = basename(filePath);
    const base = {
      tool: adapter.tool,
      name,
      path: this.toRelativeToolPath(adapter, filePath),
      size: meta.size,
      updatedAt: meta.mtime.toISOString(),
    };
    const extension = extname(name).toLowerCase();
    const imageMimeType = IMAGE_MIME_TYPES.get(extension);

    if (imageMimeType) {
      if (meta.size > MAX_IMAGE_PREVIEW_BYTES) {
        return this.unsupportedPreview(base, '图片文件过大，暂不支持预览');
      }
      const content = (await readFile(filePath)).toString('base64');
      return {
        ...base,
        previewType: 'image',
        mimeType: imageMimeType,
        content: `data:${imageMimeType};base64,${content}`,
        supported: true,
      };
    }

    const previewType = this.textPreviewType(extension);
    if (!previewType) return this.unsupportedPreview(base, '暂不支持该文件类型预览');
    if (meta.size > MAX_TEXT_PREVIEW_BYTES) return this.unsupportedPreview(base, '文件过大，暂不支持预览');

    const raw = await readFile(filePath, 'utf8');
    return {
      ...base,
      previewType,
      mimeType: 'text/plain; charset=utf-8',
      content: previewType === 'json' ? this.formatJson(raw) : raw,
      supported: true,
    };
  }

  private requireAdapter(tool: AiTool) {
    const adapter = this.adapters.get(tool);
    if (!adapter) throw new NotFoundException(`Unsupported tool: ${tool}`);
    return adapter;
  }

  private resolveToolPath(adapter: AiToolAdapter, relativePath = ''): string {
    const normalized = relativePath.trim();
    const fullPath = resolve(adapter.rootPath, normalized || '.');
    const rel = relative(resolve(adapter.rootPath), fullPath);
    if (rel.startsWith('..') || rel.startsWith('/')) {
      throw new BadRequestException('Path is outside tool root');
    }
    this.pathGuard.assertReadable(fullPath);
    return fullPath;
  }

  private async statExisting(path: string) {
    if (!existsSync(path)) throw new NotFoundException('Path not found');
    return lstat(path);
  }

  private toRelativeToolPath(adapter: AiToolAdapter, path: string): string {
    const rel = relative(resolve(adapter.rootPath), path);
    return rel === '' ? '' : rel.split('\\').join('/');
  }

  private breadcrumbs(adapter: AiToolAdapter, dirPath: string): ToolFileBreadcrumb[] {
    const relativePath = this.toRelativeToolPath(adapter, dirPath);
    const segments = relativePath ? relativePath.split('/').filter(Boolean) : [];
    const crumbs: ToolFileBreadcrumb[] = [{ name: adapter.tool === 'codex' ? '.codex' : '.claude', path: '' }];
    segments.forEach((segment, index) => {
      crumbs.push({
        name: segment,
        path: segments.slice(0, index + 1).join('/'),
      });
    });
    return crumbs;
  }

  private textPreviewType(extension: string): Exclude<ToolFilePreviewType, 'image' | 'unsupported'> | undefined {
    if (extension === '.json') return 'json';
    if (extension === '.md' || extension === '.markdown') return 'markdown';
    if (TEXT_EXTENSIONS.has(extension)) return 'text';
    return undefined;
  }

  private formatJson(raw: string): string {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }

  private unsupportedPreview(
    base: Pick<ToolFilePreview, 'tool' | 'name' | 'path' | 'size' | 'updatedAt'>,
    reason: string,
  ): ToolFilePreview {
    return {
      ...base,
      previewType: 'unsupported',
      supported: false,
      reason,
    };
  }
}
