import {
  ErrorCodes,
  errorShape,
  validateImageProvidersResult,
  formatValidationErrors,
} from "../../../packages/gateway-protocol/src/index.js";
import { resolveDefaultAgentDir } from "../../agents/agent-scope.js";
import {
  loadAuthProfileStoreForRuntime,
  listProfilesForProvider,
} from "../../agents/auth-profiles.js";
import { resolveEnvApiKey } from "../../agents/model-auth-env.js";
// Gateway RPC handlers for image generation provider inventory.
import type { OpenClawConfig } from "../../config/types.openclaw.js";
import { listImageGenerationProviders } from "../../image-generation/provider-registry.js";
import { formatForLog } from "../ws-log.js";
import type { GatewayRequestHandlers } from "./types.js";

/**
 * Check if a provider has credentials configured via env, auth profile store, or non-empty config.
 * Uses read-only auth profile store to avoid disk writes.
 * Aligns with CLI semantics in src/cli/capability-cli.ts and isProviderApiKeyConfigured.
 */
function hasOwnKeys(obj: unknown): boolean {
  return typeof obj === "object" && obj !== null && Object.keys(obj).length > 0;
}

function isProviderReady(cfg: OpenClawConfig, providerId: string, agentDir: string): boolean {
  // 1. Check env credentials
  if (resolveEnvApiKey(providerId)?.apiKey) {
    return true;
  }

  // 2. Check auth profile store (read-only, no disk writes)
  const store = loadAuthProfileStoreForRuntime(agentDir, { readOnly: true });
  const profileIds = listProfilesForProvider(store, providerId);
  if (profileIds.length > 0) {
    return true;
  }

  // 3. Check config object has non-empty values (reject empty config objects)
  const modelsProviders = (cfg.models?.providers ?? {}) as Record<string, unknown>;
  const pluginEntries = (cfg.plugins?.entries ?? {}) as Record<string, { config?: unknown }>;
  // Use delimiter matching to avoid prefix collision (e.g., openai vs openai-azure)
  const matchesProvider = (key: string): boolean =>
    key === providerId || key.startsWith(providerId + ":") || key.startsWith(providerId + "/");

  const hasModelConfig = Object.entries(modelsProviders).some(
    ([key, val]) => matchesProvider(key) && hasOwnKeys(val),
  );
  const hasPluginConfig = Object.entries(pluginEntries).some(
    ([key, val]) => matchesProvider(key) && hasOwnKeys(val.config),
  );
  const hasAuthProfileInConfig = Object.entries(cfg.auth?.profiles ?? {}).some(
    ([key, val]) => matchesProvider(key) && hasOwnKeys(val),
  );

  return hasModelConfig || hasPluginConfig || hasAuthProfileInConfig;
}

/**
 * Resolve the active image generation provider from config.
 * Uses agents.defaults.imageGenerationModel.primary if set.
 */
function resolveActiveImageProvider(cfg: OpenClawConfig): string | null {
  const imageConfig = cfg.agents?.defaults?.imageGenerationModel;
  if (!imageConfig) {
    return null;
  }

  // Handle string format like "openai" or "openai/dall-e-3"
  if (typeof imageConfig === "string") {
    const [providerId] = imageConfig.split("/");
    return providerId || imageConfig;
  }

  // Handle object format with primary field
  const primary = imageConfig.primary;
  if (primary) {
    const [providerId] = primary.split("/");
    return providerId || primary;
  }

  return null;
}

/** Gateway request handlers for image generation provider inventory. */
export const imageHandlers: GatewayRequestHandlers = {
  "image.providers": async ({ respond, context }) => {
    try {
      const cfg = context.getRuntimeConfig();
      // Use default agent directory for provider readiness checks
      const agentDir = resolveDefaultAgentDir(cfg);

      const providers = listImageGenerationProviders(cfg).map((provider) => {
        const isConfigured = isProviderReady(cfg, provider.id, agentDir);
        return {
          id: provider.id,
          label: provider.label ?? provider.id,
          configured: isConfigured,
          defaultModel: provider.defaultModel,
          models: provider.models ?? [],
          capabilities: {
            generate: provider.capabilities?.generate ?? true,
            edit: provider.capabilities?.edit ?? false,
            geometry: provider.capabilities?.geometry ?? false,
            output: provider.capabilities?.output ?? [],
          },
        };
      });

      // Return the explicitly configured provider as active, even when credentials missing.
      // Settings UI needs to distinguish "no selection" (active: null) from "selected but not configured" (active: providerId).
      const configActive = resolveActiveImageProvider(cfg);
      let activeProvider: string | null = null;
      if (configActive) {
        const matched = providers.find((p) => p.id === configActive);
        activeProvider = matched?.id ?? null;
      }

      const result = { providers, active: activeProvider };
      // Validate response against protocol schema before returning
      if (!validateImageProvidersResult(result)) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            `image.providers response failed schema validation: ${formatValidationErrors(validateImageProvidersResult.errors)}`,
          ),
        );
        return;
      }
      respond(true, result);
    } catch (err) {
      // All errors return UNAVAILABLE (no INTERNAL_ERROR in ErrorCodes)
      const code = ErrorCodes.UNAVAILABLE;
      // Log detailed error internally, return generic message to client
      console.error("[image.providers] Error:", formatForLog(err));
      respond(false, undefined, errorShape(code, "Failed to retrieve image providers"));
    }
  },
};
