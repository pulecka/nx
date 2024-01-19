import { printDiagnostics, runTypeCheck } from '@nx/js';
import { join } from 'path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { ViteBuildExecutorOptions } from '../executors/build/schema';
import { ExecutorContext } from '@nx/devkit';
import { ViteDevServerExecutorOptions } from '../executors/dev-server/schema';
import {
  calculateProjectBuildableDependencies,
  createTmpTsConfig,
} from '@nx/js/src/utils/buildable-libs-utils';
import { getProjectTsConfigPath } from './options-utils';

export const executionContextStorage = new AsyncLocalStorage<ExecutorContext>();

export async function validateTypes(opts: {
  workspaceRoot: string;
  projectRoot: string;
  tsconfig: string;
}): Promise<void> {
  const result = await runTypeCheck({
    workspaceRoot: opts.workspaceRoot,
    tsConfigPath: join(opts.workspaceRoot, opts.tsconfig),
    mode: 'noEmit',
  });

  await printDiagnostics(result.errors, result.warnings);

  if (result.errors.length > 0) {
    throw new Error('Found type errors. See above.');
  }
}

export function createBuildableTsConfig(
  projectRoot: string,
  options: ViteBuildExecutorOptions | ViteDevServerExecutorOptions,
  context: ExecutorContext
) {
  const tsConfig = getProjectTsConfigPath(projectRoot);
  options['buildLibsFromSource'] ??= true;

  if (!options['buildLibsFromSource']) {
    const { dependencies } = calculateProjectBuildableDependencies(
      context.taskGraph,
      context.projectGraph,
      context.root,
      context.projectName,
      // When using incremental building and the serve target is called
      // we need to get the deps for the 'build' target instead.
      context.targetName === 'serve' ? 'build' : context.targetName,
      context.configurationName
    );
    // This tsconfig is used via the Vite ts paths plugin.
    // It can be also used by other user-defined Vite plugins (e.g. for creating type declaration files).
    const tmpTsConfigPath = createTmpTsConfig(
      tsConfig,
      context.root,
      projectRoot,
      dependencies
    );
    process.env.NX_TSCONFIG_PATH = tmpTsConfigPath;
  }
}

export function loadViteDynamicImport() {
  return Function('return import("vite")')() as Promise<typeof import('vite')>;
}

export const withExecutionContext = <T>(
  context: ExecutorContext,
  callback: () => T
): T => executionContextStorage.run(context, callback);

export const getExecutionContext = () => executionContextStorage.getStore();
