import { createPluginRuntime } from 'every-plugin';
import { loadBosConfig } from './config';

export interface PluginStatus {
  available: boolean;
  pluginName: string | null;
  error: string | null;
  errorDetails: string | null;
}

function resolveSecrets(
  secrets: Record<string, string>
): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(secrets)) {
    const match = value.match(/^\{\{(\w+)\}\}$/);
    if (match) {
      resolved[key] = process.env[match[1]] ?? '';
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

export interface PluginResult {
  runtime: ReturnType<typeof createPluginRuntime> | null;
  api: any | null;
  status: PluginStatus;
}

export async function initializePlugins(): Promise<PluginResult> {
  let currentPluginName: string | null = null;
  let currentPluginUrl: string | null = null;
  
  try {
    const config = await loadBosConfig();
    const entries = Object.entries(config.apiPlugins);

    if (entries.length === 0) {
      console.warn('[Plugins] No plugins configured in bos.config.json');
      return {
        runtime: null,
        api: null,
        status: {
          available: false,
          pluginName: null,
          error: 'No plugins configured',
          errorDetails: 'No plugins found in bos.config.json',
        },
      };
    }

    const [pluginName, pluginConfig] = entries[0]!;
    currentPluginName = pluginName;
    currentPluginUrl = pluginConfig.url;

    console.log(`[Plugins] Registering remote: ${pluginName} from ${pluginConfig.url}`);

    const runtime = createPluginRuntime({
      registry: {
        [pluginName]: {
          remote: pluginConfig.url,
        },
      },
      secrets: {},
    });

    const secrets = pluginConfig.secrets
      ? resolveSecrets(pluginConfig.secrets)
      : {};
    const variables = pluginConfig.variables ?? {};

    const api = await runtime.usePlugin(pluginName, {
      // @ts-expect-error no plugin types loaded
      variables,
      // @ts-expect-error no plugin types loaded
      secrets,
    });

    return {
      runtime,
      api,
      status: {
        available: true,
        pluginName,
        error: null,
        errorDetails: null,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('[Plugins] ❌ Failed to initialize plugin');
    
    if (errorMessage.includes('register-remote') || errorStack?.includes('register-remote')) {
      console.error(`[Plugins] Failed to register remote plugin: ${currentPluginName}`);
      console.error(`[Plugins] Remote URL: ${currentPluginUrl}`);
      console.error('[Plugins] Possible causes:');
      console.error('  • API server is not running at the configured URL');
      console.error('  • Wrong URL in bos.config.json');
      console.error('  • Network connectivity issue');
      console.error('  • CORS configuration problem');
      console.error(`[Plugins] Error: ${errorMessage}`);
    } else if (errorMessage.includes('validation') || errorMessage.includes('ZodError')) {
      console.error('[Plugins] Configuration validation failed');
      console.error('[Plugins] Check that all required secrets are set in your environment variables');
      console.error(`[Plugins] Error: ${errorMessage}`);
    } else if (errorMessage.includes('ENOTDIR') || errorMessage.includes('ENOENT')) {
      console.error('[Plugins] Plugin file not found - ensure API is running and built');
      console.error(`[Plugins] Attempted URL: ${currentPluginUrl}`);
      console.error(`[Plugins] Error: ${errorMessage}`);
    } else if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
      console.error('[Plugins] Network error - ensure API server is running at the configured URL');
      console.error(`[Plugins] URL: ${currentPluginUrl}`);
      console.error(`[Plugins] Error: ${errorMessage}`);
    } else {
      console.error(`[Plugins] Plugin: ${currentPluginName}`);
      console.error(`[Plugins] URL: ${currentPluginUrl}`);
      console.error(`[Plugins] Error: ${errorMessage}`);
    }
    
    console.warn('[Plugins] Server will continue without plugin functionality');

    return {
      runtime: null,
      api: null,
      status: {
        available: false,
        pluginName: currentPluginName,
        error: errorMessage,
        errorDetails: errorStack ?? null,
      },
    };
  }
}

export type Plugins = Awaited<ReturnType<typeof initializePlugins>>;
