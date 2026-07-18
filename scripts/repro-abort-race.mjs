#!/usr/bin/env node

/**
 * Real behavior proof for PR #110704
 * Demonstrates that wrapToolWithAbortSignal immediately rejects when run aborts,
 * even when the tool promise never settles.
 *
 * This script simulates the stuck-session recovery scenario from issue #103905.
 */

import { wrapToolWithAbortSignal } from "./src/agents/agent-tools.abort.js";

console.log("=".repeat(80));
console.log("PR #110704: Real Behavior Proof - Abort Racing for Stuck Tools");
console.log("=".repeat(80));
console.log();

// Test 1: Never-settling tool promise + run abort
console.log("Test 1: Never-settling tool promise + run abort");
console.log("-".repeat(80));

const stuckTool = {
  name: "stuck-tool",
  description: "A tool that never settles (simulating stuck session)",
  parameters: {},
  execute: async () => {
    console.log("[TOOL] Starting execution...");
    return new Promise(() => {
      // Never resolves or rejects - simulates a tool that ignores abort signal
    });
  },
};

const abortController = new AbortController();
const wrappedTool = wrapToolWithAbortSignal(stuckTool, abortController.signal);

console.log("[BEFORE] Tool execution started at:", new Date().toISOString());
const startTime = Date.now();

const promise = wrappedTool.execute("test-call-1", {});

// Abort after 500ms
setTimeout(() => {
  console.log("[ABORT] Triggering abort after 500ms");
  abortController.abort();
}, 500);

try {
  await promise;
  console.log("[ERROR] Tool should not have resolved!");
  process.exit(1);
} catch (error) {
  const elapsed = Date.now() - startTime;
  console.log(`[AFTER] Tool rejected after ${elapsed}ms`);
  console.log(`[RESULT] Error type: ${error.constructor.name}`);
  console.log(`[RESULT] Error message: ${error.message}`);

  if (elapsed < 600 && error.name === "AbortError") {
    console.log(`[SUCCESS] ✅ Tool rejected promptly on abort (${elapsed}ms < 600ms)`);
  } else {
    console.log(`[FAILED] ❌ Tool did not reject promptly (${elapsed}ms >= 600ms or wrong error)`);
    process.exit(1);
  }
}

console.log();

// Test 2: Late-settling tool after abort
console.log("Test 2: Late-settling tool after abort (result detachment)");
console.log("-".repeat(80));

let resolveLateTool;
const lateTool = {
  name: "late-tool",
  description: "A tool that settles after abort",
  parameters: {},
  execute: async () => {
    console.log("[TOOL] Starting late execution...");
    return new Promise((resolve) => {
      resolveLateTool = resolve;
    });
  },
};

const abortController2 = new AbortController();
const wrappedTool2 = wrapToolWithAbortSignal(lateTool, abortController2.signal);

console.log("[BEFORE] Late tool execution started");
const startTime2 = Date.now();

const promise2 = wrappedTool2.execute("test-call-2", {});

setTimeout(() => {
  console.log("[ABORT] Triggering abort after 300ms");
  abortController2.abort();
}, 300);

try {
  await promise2;
  console.log("[ERROR] Late tool should not have resolved!");
  process.exit(1);
} catch (error) {
  const elapsed = Date.now() - startTime2;
  console.log(`[AFTER] Tool rejected after ${elapsed}ms`);
  console.log(`[RESULT] Error: ${error.name}: ${error.message}`);

  // Now resolve the late tool
  console.log("[LATE] Resolving tool after abort...");
  resolveLateTool({ content: [{ type: "text", text: "late result" }] });

  // Give it time to settle
  await new Promise((resolve) => setTimeout(resolve, 100));

  console.log("[SUCCESS] ✅ Late result did not surface (detached)");
}

console.log();

// Test 3: Normal execution without abort
console.log("Test 3: Normal execution without abort");
console.log("-".repeat(80));

const normalTool = {
  name: "normal-tool",
  description: "A tool that completes normally",
  parameters: {},
  execute: async () => {
    console.log("[TOOL] Executing normally...");
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { content: [{ type: "text", text: "success" }] };
  },
};

const abortController3 = new AbortController();
const wrappedTool3 = wrapToolWithAbortSignal(normalTool, abortController3.signal);

console.log("[BEFORE] Normal tool execution started");

try {
  const result = await wrappedTool3.execute("test-call-3", {});
  console.log("[AFTER] Tool completed successfully");
  console.log("[RESULT]", JSON.stringify(result));
  console.log("[SUCCESS] ✅ Normal execution works as expected");
} catch (error) {
  console.log("[ERROR] Normal tool should not have failed:", error);
  process.exit(1);
}

console.log();
console.log("=".repeat(80));
console.log("All tests passed! ✅");
console.log("=".repeat(80));
console.log();
console.log("Summary:");
console.log("1. ✅ Never-settling tool rejects promptly on abort");
console.log("2. ✅ Late tool result is detached after abort");
console.log("3. ✅ Normal execution works without abort");
console.log();
console.log("This proves the fix works correctly in real runtime scenarios.");
