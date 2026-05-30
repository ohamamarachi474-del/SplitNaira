import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import cors from "cors";

function buildApp(corsOriginEnv: string | undefined) {
  const app = express();
  const origins = corsOriginEnv
    ? corsOriginEnv.split(",").map((o) => o.trim()).filter(Boolean)
    : ["http://localhost:3000"];
  app.use(cors({ origin: origins.length > 0 ? origins : false }));
  app.get("/ping", (_req, res) => res.json({ ok: true }));
  return app;
}

describe("CORS preflight behaviour", () => {
  it("allows preflight from an explicitly allowed origin", async () => {
    const app = buildApp("https://app.splitnaira.com");
    const res = await request(app)
      .options("/ping")
      .set("Origin", "https://app.splitnaira.com")
      .set("Access-Control-Request-Method", "GET");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("https://app.splitnaira.com");
  });

  it("blocks preflight from an origin not in the allowlist", async () => {
    const app = buildApp("https://app.splitnaira.com");
    const res = await request(app)
      .options("/ping")
      .set("Origin", "https://evil.example.com")
      .set("Access-Control-Request-Method", "GET");

    // cors middleware omits the header when origin is not allowed
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("allows multiple comma-separated origins", async () => {
    const app = buildApp("https://app.splitnaira.com,https://splitnaira.com");

    const res1 = await request(app)
      .options("/ping")
      .set("Origin", "https://app.splitnaira.com")
      .set("Access-Control-Request-Method", "GET");
    expect(res1.headers["access-control-allow-origin"]).toBe("https://app.splitnaira.com");

    const res2 = await request(app)
      .options("/ping")
      .set("Origin", "https://splitnaira.com")
      .set("Access-Control-Request-Method", "GET");
    expect(res2.headers["access-control-allow-origin"]).toBe("https://splitnaira.com");
  });
});

describe("CORS production env validation", () => {
  // Minimal env that satisfies all required schema fields
  const requiredEnv: Record<string, string> = {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://user:pass@localhost:5432/splitnaira",
    HORIZON_URL: "https://horizon-testnet.stellar.org",
    SOROBAN_RPC_URL: "https://soroban-testnet.stellar.org",
    SOROBAN_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
    CONTRACT_ID: "CBLASIRZ7CUKC7S5IS3VSNMQGKZ5FTRWLHZZXH7H4YG6ZLRFPJF5H2LR",
    SIMULATOR_ACCOUNT: "test_account",
  };

  beforeEach(() => {
    Object.entries(requiredEnv).forEach(([k, v]) => vi.stubEnv(k, v));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects wildcard CORS_ORIGIN in production", async () => {
    vi.stubEnv("CORS_ORIGIN", "*");
    const { validateEnv, clearEnvCache } = await import("../config/env.js");
    clearEnvCache();
    expect(() => validateEnv()).toThrow(/must not contain '\*'/i);
  });

  it("rejects missing CORS_ORIGIN in production", async () => {
    vi.unstubAllEnvs();
    Object.entries({ ...requiredEnv }).forEach(([k, v]) => vi.stubEnv(k, v));
    // Ensure CORS_ORIGIN is explicitly absent
    vi.stubEnv("CORS_ORIGIN", "");
    const { validateEnv, clearEnvCache } = await import("../config/env.js");
    clearEnvCache();
    expect(() => validateEnv()).toThrow(/CORS_ORIGIN is required in production/i);
  });

  it("accepts explicit origin(s) in production", async () => {
    vi.stubEnv("CORS_ORIGIN", "https://app.splitnaira.com");
    const { validateEnv, clearEnvCache } = await import("../config/env.js");
    clearEnvCache();
    const result = validateEnv();
    expect(result.CORS_ORIGIN).toBe("https://app.splitnaira.com");
  });
});
