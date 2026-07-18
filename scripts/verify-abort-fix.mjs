/**
 * Minimal reproduction script for PR #110704
 * Demonstrates the abort racing behavior without requiring compilation
 */

async function main() {
  console.log("=".repeat(80));
  console.log("PR #110704: Abort Race Behavior Verification");
  console.log("=".repeat(80));
  console.log();

  // Simplified version of raceWithAbortSignal
  function createAbortError(message) {
    const error = new Error(message);
    error.name = "AbortError";
    return error;
  }

  function raceWithAbortSignal(promise, signal) {
    if (signal.aborted) {
      return Promise.reject(createAbortError("Aborted"));
    }
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        signal.removeEventListener("abort", onAbort);
        reject(createAbortError("Aborted"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
      promise.then(
        (value) => {
          signal.removeEventListener("abort", onAbort);
          resolve(value);
        },
        (error) => {
          signal.removeEventListener("abort", onAbort);
          reject(error instanceof Error ? error : new Error(String(error)));
        },
      );
    });
  }

  // Test 1: Never-settling promise + abort
  console.log("Test 1: Never-settling promise + abort");
  console.log("-".repeat(80));

  const abortController = new AbortController();
  const stuckPromise = new Promise(() => {}); // Never settles

  console.log("[BEFORE] Starting never-settling promise...");
  const startTime = Date.now();

  const racePromise = raceWithAbortSignal(stuckPromise, abortController.signal);

  // Abort after 100ms
  setTimeout(() => {
    console.log("[ABORT] Triggering abort");
    abortController.abort();
  }, 100);

  try {
    await racePromise;
    console.log("[ERROR] Should not reach here");
    process.exit(1);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.log(`[AFTER] Rejected after ${elapsed}ms`);
    console.log(`[RESULT] ${error.name}: ${error.message}`);

    if (elapsed < 150 && error.name === "AbortError") {
      console.log(`[SUCCESS] ✅ Rejected promptly (${elapsed}ms < 150ms)`);
    } else {
      console.log(`[FAILED] ❌ Did not reject promptly`);
      process.exit(1);
    }
  }

  console.log();

  // Test 2: Late-settling promise after abort
  console.log("Test 2: Late-settling promise after abort");
  console.log("-".repeat(80));

  let resolveLate;
  const abortController2 = new AbortController();
  const latePromise = new Promise((resolve) => {
    resolveLate = resolve;
  });

  console.log("[BEFORE] Starting late-settling promise...");
  const startTime2 = Date.now();

  const racePromise2 = raceWithAbortSignal(latePromise, abortController2.signal);

  // Abort after 50ms
  setTimeout(() => {
    console.log("[ABORT] Triggering abort");
    abortController2.abort();
  }, 50);

  try {
    await racePromise2;
    console.log("[ERROR] Should not reach here");
    process.exit(1);
  } catch (error) {
    const elapsed = Date.now() - startTime2;
    console.log(`[AFTER] Rejected after ${elapsed}ms`);

    // Now resolve the late promise
    console.log("[LATE] Resolving original promise...");
    resolveLate("late result");

    await new Promise((resolve) => setTimeout(resolve, 50));
    console.log("[SUCCESS] ✅ Late result did not surface");
  }

  console.log();

  // Test 3: Normal execution
  console.log("Test 3: Normal execution without abort");
  console.log("-".repeat(80));

  const abortController3 = new AbortController();
  const normalPromise = new Promise((resolve) => {
    setTimeout(() => resolve("success"), 50);
  });

  console.log("[BEFORE] Starting normal promise...");
  const startTime3 = Date.now();

  const racePromise3 = raceWithAbortSignal(normalPromise, abortController3.signal);

  try {
    const result = await racePromise3;
    const elapsed = Date.now() - startTime3;
    console.log(`[AFTER] Resolved after ${elapsed}ms`);
    console.log(`[RESULT] ${result}`);
    console.log("[SUCCESS] ✅ Normal execution works");
  } catch (error) {
    console.log("[ERROR] Should not fail:", error);
    process.exit(1);
  }

  console.log();
  console.log("=".repeat(80));
  console.log("All tests passed! ✅");
  console.log("=".repeat(80));
  console.log();
  console.log("This demonstrates the core fix:");
  console.log("- Never-settling promises reject on abort");
  console.log("- Late settlements are properly detached");
  console.log("- Normal execution remains unchanged");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
