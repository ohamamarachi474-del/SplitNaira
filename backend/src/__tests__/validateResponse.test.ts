import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { z } from "zod";

vi.mock("../services/logger.js", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  withResponseValidation,
  getValidationFailureCount,
  resetValidationFailureCount,
} from "../middleware/validateResponse.js";

const schema = z.object({ id: z.number(), name: z.string() });

function buildApp(handler: express.RequestHandler) {
  const app = express();
  app.get("/test", withResponseValidation(schema, handler));
  return app;
}

function setEnv(nodeEnv: string, strict?: string) {
  process.env.NODE_ENV = nodeEnv;
  if (strict !== undefined) {
    process.env.STRICT_RESPONSE_VALIDATION = strict;
  } else {
    delete process.env.STRICT_RESPONSE_VALIDATION;
  }
}

describe("withResponseValidation — strict mode (production)", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    setEnv("production");
    resetValidationFailureCount();
  });

  afterEach(() => {
    setEnv(originalNodeEnv ?? "test");
  });

  it("returns 200 when the response matches the schema", async () => {
    const app = buildApp((_req, res) => {
      res.json({ id: 1, name: "Alice" });
    });
    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 1, name: "Alice" });
  });

  it("returns 500 on schema mismatch in production", async () => {
    const app = buildApp((_req, res) => {
      res.json({ id: 1 }); // name is missing
    });
    const res = await request(app).get("/test");
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("internal_error");
  });

  it("increments the failure counter on mismatch", async () => {
    const app = buildApp((_req, res) => {
      res.json({ id: "not-a-number" });
    });
    await request(app).get("/test");
    expect(getValidationFailureCount()).toBe(1);
    await request(app).get("/test");
    expect(getValidationFailureCount()).toBe(2);
  });
});

describe("withResponseValidation — lenient mode (development)", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    setEnv("development");
    resetValidationFailureCount();
  });

  afterEach(() => {
    setEnv(originalNodeEnv ?? "test");
  });

  it("forwards the original body even on schema mismatch", async () => {
    const app = buildApp((_req, res) => {
      res.json({ id: 1 }); // name missing
    });
    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 1 });
  });

  it("still increments the failure counter", async () => {
    const app = buildApp((_req, res) => {
      res.json({ id: 1 }); // name missing
    });
    await request(app).get("/test");
    expect(getValidationFailureCount()).toBe(1);
  });
});

describe("withResponseValidation — explicit STRICT_RESPONSE_VALIDATION flag", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalStrict = process.env.STRICT_RESPONSE_VALIDATION;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv ?? "test";
    if (originalStrict !== undefined) {
      process.env.STRICT_RESPONSE_VALIDATION = originalStrict;
    } else {
      delete process.env.STRICT_RESPONSE_VALIDATION;
    }
    resetValidationFailureCount();
  });

  it("returns 500 when STRICT_RESPONSE_VALIDATION=true regardless of NODE_ENV", async () => {
    setEnv("development", "true");
    const app = buildApp((_req, res) => {
      res.json({ id: 1 }); // name missing
    });
    const res = await request(app).get("/test");
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("internal_error");
  });

  it("forwards body when STRICT_RESPONSE_VALIDATION=false even in production", async () => {
    setEnv("production", "false");
    const app = buildApp((_req, res) => {
      res.json({ id: 1 }); // name missing
    });
    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 1 });
  });
});
