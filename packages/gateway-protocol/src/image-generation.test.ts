import { Type } from "typebox";
// Type-level tests to verify schema and TypeScript types are aligned.
import { describe, expect, it } from "vitest";
import type {
  ImageProviderCapabilityOutput,
  ImageProviderCapabilitySupport,
} from "./schema/image-generation.js";
import {
  ImageProviderCapabilityOutputSchema,
  ImageProviderCapabilitySupportSchema,
} from "./schema/image-generation.js";

describe("ImageProviderCapabilitySupport schema alignment", () => {
  it("includes maxInputImagesByModel fields in schema", () => {
    const props = ImageProviderCapabilitySupportSchema.properties;
    expect(props.maxInputImages).toBeDefined();
    expect(props.maxInputImagesByModel).toBeDefined();
    expect(props.maxInputImagesByModelPrefix).toBeDefined();
  });

  it("accepts object with model-specific edit limits", () => {
    const value: ImageProviderCapabilitySupport = {
      maxInputImages: 5,
      maxInputImagesByModel: { "model-a": 3, "model-b": 1 },
      maxInputImagesByModelPrefix: { "prefix-": 2 },
    };
    expect(value.maxInputImagesByModel?.["model-a"]).toBe(3);
    expect(value.maxInputImagesByModelPrefix?.["prefix-"]).toBe(2);
  });

  it("accepts empty maxInputImagesByModel fields", () => {
    const value: ImageProviderCapabilitySupport = { maxInputImagesByModel: {} };
    expect(value.maxInputImagesByModel).toEqual({});
  });
});

describe("ImageProviderCapabilityOutput type alignment", () => {
  it("accepts boolean", () => {
    const value: ImageProviderCapabilityOutput = true;
    expect(value).toBe(true);
  });

  it("accepts string array", () => {
    const value: ImageProviderCapabilityOutput = ["png", "webp"];
    expect(value).toEqual(["png", "webp"]);
  });

  it("accepts empty array", () => {
    const value: ImageProviderCapabilityOutput = [];
    expect(value).toEqual([]);
  });

  it("accepts object with formats", () => {
    const value: ImageProviderCapabilityOutput = {
      formats: ["png", "jpeg"],
      qualities: ["low", "high"],
      backgrounds: ["transparent"],
    };
    expect(value).toEqual({
      formats: ["png", "jpeg"],
      qualities: ["low", "high"],
      backgrounds: ["transparent"],
    });
  });

  it("schema has three union branches", () => {
    const schema = ImageProviderCapabilityOutputSchema;
    expect(schema.anyOf).toBeDefined();
    expect(schema.anyOf?.length).toBe(3);
    expect(schema.anyOf?.[0]).toEqual(Type.Boolean());
    expect(schema.anyOf?.[1]).toEqual(Type.Array(Type.String()));
    expect(schema.anyOf?.[2]?.type).toBe("object");
  });
});
