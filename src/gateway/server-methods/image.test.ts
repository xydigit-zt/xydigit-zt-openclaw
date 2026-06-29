import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCodes } from "../../../packages/gateway-protocol/src/index.js";
import { imageHandlers } from "./image.js";

vi.mock("../../image-generation/provider-registry.js", () => ({
  listImageGenerationProviders: vi.fn(() => [
    {
      id: "openai",
      label: "OpenAI",
      defaultModel: "dall-e-3",
      models: ["dall-e-3", "dall-e-2"],
      capabilities: {
        generate: true,
        edit: false,
        geometry: { sizes: ["1024x1024"] },
        output: ["png", "webp"],
      },
    },
    {
      id: "gemini",
      label: "Google Gemini",
      models: ["imagen-3"],
      isConfigured: vi.fn(() => true),
      capabilities: {
        generate: { maxCount: 4 },
        edit: true,
        geometry: true,
        output: [],
      },
    },
    {
      id: "replicate",
      label: "Replicate",
      models: [],
      capabilities: { generate: true, edit: false, geometry: false, output: true },
    },
    {
      id: "env-provider",
      label: "Env Provider",
      models: ["env-model"],
      capabilities: { generate: true, edit: false, geometry: false, output: true },
    },
    {
      id: "auth-provider",
      label: "Auth Provider",
      models: ["auth-model"],
      capabilities: { generate: true, edit: false, geometry: false, output: true },
    },
  ]),
}));

vi.mock("../../agents/agent-scope.js", () => ({
  resolveDefaultAgentDir: vi.fn(() => "/tmp/agents/main"),
}));

vi.mock("../../agents/auth-profiles.js", () => ({
  loadAuthProfileStoreForRuntime: vi.fn(() => ({ profiles: {} })),
  listProfilesForProvider: vi.fn(() => []),
}));

vi.mock("../../agents/model-auth-env.js", () => ({
  resolveEnvApiKey: vi.fn(() => null),
}));

type RespondCall = [boolean, unknown?, { code: number; message: string }?];

function respondCall(respond: ReturnType<typeof vi.fn>): RespondCall {
  const call = respond.mock.calls[0] as RespondCall | undefined;
  if (!call) {
    throw new Error("expected respond call");
  }
  return call;
}

function expectSuccess(respond: ReturnType<typeof vi.fn>): {
  providers: unknown[];
  active: string | null;
} {
  const call = respondCall(respond);
  expect(call[0]).toBe(true);
  return call[1] as { providers: unknown[]; active: string | null };
}

function expectError(respond: ReturnType<typeof vi.fn>, code: number, message: string) {
  const call = respondCall(respond);
  expect(call[0]).toBe(false);
  expect(call[2]?.code).toBe(code);
  expect(call[2]?.message).toContain(message);
}

function createInvokeParams(cfg: Record<string, unknown>) {
  const respond = vi.fn();
  return {
    respond,
    invoke: async () =>
      await imageHandlers["image.providers"]({
        respond: respond as never,
        context: { getRuntimeConfig: () => cfg } as never,
      }),
  };
}

describe("imageHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns provider list", async () => {
    const { respond, invoke } = createInvokeParams({
      models: { providers: {} },
      plugins: { entries: {} },
      auth: { profiles: {} },
      agents: {},
    });
    await invoke();
    const result = expectSuccess(respond);
    expect(result.providers).toHaveLength(5);
    expect(result.providers[0]).toMatchObject({ id: "openai", label: "OpenAI" });
  });

  it("marks provider configured when auth profile exists in config", async () => {
    const { respond, invoke } = createInvokeParams({
      models: { providers: {} },
      plugins: { entries: {} },
      auth: { profiles: { openai: { type: "api-key" } } },
      agents: {},
    });
    await invoke();
    const result = expectSuccess(respond);
    const openai = result.providers.find((p) => (p as { id: string }).id === "openai");
    expect((openai as { configured: boolean }).configured).toBe(true);
  });

  it("marks provider configured when model config exists", async () => {
    const { respond, invoke } = createInvokeParams({
      models: { providers: { openai: {} } },
      plugins: { entries: {} },
      auth: { profiles: {} },
      agents: {},
    });
    await invoke();
    const result = expectSuccess(respond);
    const openai = result.providers.find((p) => (p as { id: string }).id === "openai");
    expect((openai as { configured: boolean }).configured).toBe(true);
  });

  it("marks provider configured when plugin config exists", async () => {
    const { respond, invoke } = createInvokeParams({
      models: { providers: {} },
      plugins: { entries: { openai: { config: {} } } },
      auth: { profiles: {} },
      agents: {},
    });
    await invoke();
    const result = expectSuccess(respond);
    const openai = result.providers.find((p) => (p as { id: string }).id === "openai");
    expect((openai as { configured: boolean }).configured).toBe(true);
  });

  it("uses provider isConfigured override when available", async () => {
    const { respond, invoke } = createInvokeParams({
      models: { providers: {} },
      plugins: { entries: {} },
      auth: { profiles: {} },
      agents: {},
    });
    await invoke();
    const result = expectSuccess(respond);
    const gemini = result.providers.find((p) => (p as { id: string }).id === "gemini");
    expect((gemini as { configured: boolean }).configured).toBe(true);
  });

  it("resolves active from string format imageGenerationModel", async () => {
    const { respond, invoke } = createInvokeParams({
      models: { providers: {} },
      plugins: { entries: {} },
      auth: { profiles: { openai: { type: "api-key" } } },
      agents: { defaults: { imageGenerationModel: "openai/dall-e-3" } },
    });
    await invoke();
    const result = expectSuccess(respond);
    expect(result.active).toBe("openai");
  });

  it("resolves active from object format imageGenerationModel.primary", async () => {
    const { respond, invoke } = createInvokeParams({
      models: { providers: {} },
      plugins: { entries: {} },
      auth: { profiles: { gemini: { type: "api-key" } } },
      agents: { defaults: { imageGenerationModel: { primary: "gemini" } } },
    });
    await invoke();
    const result = expectSuccess(respond);
    expect(result.active).toBe("gemini");
  });

  it("returns null active when no imageGenerationModel is set", async () => {
    const { respond, invoke } = createInvokeParams({
      models: { providers: {} },
      plugins: { entries: {} },
      auth: { profiles: { openai: { type: "api-key" } } },
      agents: {},
    });
    await invoke();
    const result = expectSuccess(respond);
    expect(result.active).toBe(null);
  });

  it("returns null active when config primary is not configured", async () => {
    const { respond, invoke } = createInvokeParams({
      models: { providers: {} },
      plugins: { entries: {} },
      auth: { profiles: {} },
      agents: { defaults: { imageGenerationModel: "unknown-provider" } },
    });
    await invoke();
    const result = expectSuccess(respond);
    expect(result.active).toBe(null);
  });

  it("returns capabilities with defaults", async () => {
    const { respond, invoke } = createInvokeParams({
      models: { providers: {} },
      plugins: { entries: {} },
      auth: { profiles: {} },
      agents: {},
    });
    await invoke();
    const result = expectSuccess(respond);
    const replicate = result.providers.find((p) => (p as { id: string }).id === "replicate");
    expect((replicate as { capabilities: unknown }).capabilities).toMatchObject({
      generate: true,
      edit: false,
      geometry: false,
      output: true,
    });
  });

  describe("readiness paths", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("marks provider configured when env credentials present", async () => {
      const { respond, invoke } = createInvokeParams({
        models: { providers: {} },
        plugins: { entries: {} },
        auth: { profiles: {} },
        agents: {},
      });

      // Mock env-backed provider has credentials
      const { resolveEnvApiKey } = await import("../../agents/model-auth-env.js");
      vi.mocked(resolveEnvApiKey).mockImplementation((provider: string) => {
        if (provider === "env-provider") {
          return { apiKey: "test-key" };
        }
        return null;
      });

      await invoke();
      const result = expectSuccess(respond);
      const envProvider = result.providers.find((p) => (p as { id: string }).id === "env-provider");
      expect((envProvider as { configured: boolean }).configured).toBe(true);
    });

    it("marks provider configured when auth profile exists in store", async () => {
      const { respond, invoke } = createInvokeParams({
        models: { providers: {} },
        plugins: { entries: {} },
        auth: { profiles: {} },
        agents: {},
      });

      // Mock auth-profile-backed provider has profile
      const { listProfilesForProvider } = await import("../../agents/auth-profiles.js");
      vi.mocked(listProfilesForProvider).mockImplementation((store: unknown, provider: string) => {
        if (provider === "auth-provider") {
          return ["auth-profile-1"];
        }
        return [];
      });

      await invoke();
      const result = expectSuccess(respond);
      const authProvider = result.providers.find(
        (p) => (p as { id: string }).id === "auth-provider",
      );
      expect((authProvider as { configured: boolean }).configured).toBe(true);
    });

    it("marks provider not configured for empty config object", async () => {
      const { respond, invoke } = createInvokeParams({
        models: { providers: { openai: {} } }, // Empty object should not count as configured
        plugins: { entries: { openai: { config: undefined } } }, // undefined config
        auth: { profiles: { openai: { type: "api-key" } } }, // This should still count
        agents: {},
      });
      await invoke();
      const result = expectSuccess(respond);
      // openai has auth profile in config, so it's configured
      const openai = result.providers.find((p) => (p as { id: string }).id === "openai");
      expect((openai as { configured: boolean }).configured).toBe(true);

      // replicate has no config at all
      const replicate = result.providers.find((p) => (p as { id: string }).id === "replicate");
      expect((replicate as { configured: boolean }).configured).toBe(false);
    });
  });
});
