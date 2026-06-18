const originalEmitWarning = process.emitWarning.bind(process);

process.emitWarning = ((warning: string | Error, ...args: unknown[]) => {
  const message = warning instanceof Error ? warning.message : warning;
  if (typeof message === 'string' && message.includes('SQLite is an experimental feature')) {
    return;
  }
  return originalEmitWarning(warning as string, ...(args as Parameters<typeof process.emitWarning> extends [unknown, ...infer Rest] ? Rest : never));
}) as typeof process.emitWarning;
