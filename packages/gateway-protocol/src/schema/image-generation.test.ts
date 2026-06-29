// Gateway Protocol tests for image generation schemas.
import { describe, expect, it } from "vitest";
import {
  ImageProviderCapabilitySupportSchema,
  ImageProviderCapabilitiesSchema,
  ImageProviderSchema,
  ImageProvidersResultSchema,
  ImageProviderCapabilitySupport,
  ImageProviderCapabilities,
  ImageProvider,
  ImageProvidersResult,
} from "./image-generation.js";

describe("Image generation schema exports", () => {
  it("exports ImageProviderCapabilitySupportSchema", () => {
    expect(ImageProviderCapabilitySupportSchema).toBeDefined();
  });

  it("exports ImageProviderCapabilitiesSchema", () => {
    expect(ImageProviderCapabilitiesSchema).toBeDefined();
  });

  it("exports ImageProviderSchema", () => {
    expect(ImageProviderSchema).toBeDefined();
  });

  it("exports ImageProvidersResultSchema", () => {
    expect(ImageProvidersResultSchema).toBeDefined();
  });
});

describe("ImageProviderCapabilitySupport type", () => {
  it("includes maxInputImages property", () => {
    const capability: ImageProviderCapabilitySupport = {
      maxCount: 4,
      maxInputImages: 1,
      supportsSize: true,
    };
    expect(capability.maxInputImages).toBe(1);
  });

  it("works without optional fields", () => {
    const capability: ImageProviderCapabilitySupport = {};
    expect(capability.maxInputImages).toBeUndefined();
  });
});

describe("ImageProviderCapabilities type", () => {
  it("accepts maxInputImages in edit capability", () => {
    const capabilities: ImageProviderCapabilities = {
      generate: true,
      edit: { maxInputImages: 1, supportsSize: true },
      geometry: true,
      output: ["png", "webp"],
    };
    expect((capabilities.edit as { maxInputImages?: number }).maxInputImages).toBe(1);
  });

  it("accepts boolean edit", () => {
    const capabilities: ImageProviderCapabilities = {
      generate: true,
      edit: false,
      geometry: true,
      output: true,
    };
    expect(capabilities.edit).toBe(false);
  });
});

describe("ImageProvider type", () => {
  it("accepts full provider with capabilities", () => {
    const provider: ImageProvider = {
      id: "openai",
      label: "OpenAI",
      configured: true,
      defaultModel: "dall-e-3",
      models: ["dall-e-3", "dall-e-2"],
      capabilities: {
        generate: true,
        edit: { maxInputImages: 1 },
        geometry: { sizes: ["1024x1024"] },
        output: ["png", "webp"],
      },
    };
    expect(provider.id).toBe("openai");
  });
});

describe("ImageProvidersResult type", () => {
  it("accepts result with null active", () => {
    const result: ImageProvidersResult = {
      providers: [],
      active: null,
    };
    expect(result.active).toBeNull();
  });

  it("accepts result with string active", () => {
    const result: ImageProvidersResult = {
      providers: [
        {
          id: "openai",
          label: "OpenAI",
          configured: true,
          models: [],
          capabilities: {
            generate: true,
            edit: false,
            geometry: false,
            output: true,
          },
        },
      ],
      active: "openai",
    };
    expect(result.active).toBe("openai");
  });
});
