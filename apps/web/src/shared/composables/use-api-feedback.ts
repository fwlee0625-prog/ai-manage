import { ElMessage } from 'element-plus';

export interface ApiFeedbackOptions {
  success?: string;
}

export function apiErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runWithApiFeedback<T>(
  action: () => Promise<T>,
  options: ApiFeedbackOptions = {},
): Promise<T | undefined> {
  try {
    const result = await action();
    if (options.success) ElMessage.success(options.success);
    return result;
  } catch (error) {
    ElMessage.error(apiErrorMessage(error));
    return undefined;
  }
}
