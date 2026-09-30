import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = fileURLToPath(new URL('..', import.meta.url));
const srcDir = join(webRoot, 'src');
const registryFile = join(srcDir, 'plugins/element-plus.ts');

/**
 * Recursively lists every source file under a directory.
 */
function walk(dir) {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/**
 * Converts one kebab-case Element Plus tag into its PascalCase export name.
 */
function exportName(tag) {
  return `El${tag.slice(3).split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('')}`;
}

const registry = readFileSync(registryFile, 'utf8');
const problems = [];

for (const file of walk(srcDir).filter(name => name.endsWith('.vue'))) {
  const source = readFileSync(file, 'utf8');
  const tags = new Set([...source.matchAll(/<(el-[a-z0-9-]+)/g)].map(match => match[1]));
  for (const tag of tags) {
    const name = exportName(tag);
    const pattern = new RegExp(`\\b${name}\\b`);
    if (!pattern.test(registry) && !pattern.test(source)) {
      problems.push(`${relative(webRoot, file)}: <${tag}> needs ${name} in src/plugins/element-plus.ts or a local import`);
    }
  }
}

if (problems.length) {
  console.error('Unregistered Element Plus components detected:\n' + problems.join('\n'));
  process.exit(1);
}
console.log(`Element Plus registration check passed (${srcDir} scanned).`);
