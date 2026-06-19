import { describe, expect, it } from "vitest";

import {
  apiCreated,
  apiError,
  apiNoContent,
  apiOk,
  type ApiError,
  type ApiResponse,
} from "@/lib/api/response";

describe("api response helpers", () => {
  it("apiOk wraps data with success=true, data, and timestamp", async () => {
    const response = apiOk({ value: 1 });
    const json = (await response.json()) as ApiResponse<{ value: number }>;

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(json.success).toBe(true);
    expect(json.data).toEqual({ value: 1 });
    expect(new Date(json.timestamp).toISOString()).toBe(json.timestamp);
  });

  it("apiOk respects explicit response init", async () => {
    const response = apiOk(
      { value: 2 },
      {
        status: 202,
        headers: {
          "x-trace-id": "trace-123",
        },
      },
    );
    const json = (await response.json()) as ApiResponse<{ value: number }>;

    expect(response.status).toBe(202);
    expect(response.headers.get("x-trace-id")).toBe("trace-123");
    expect(json.success).toBe(true);
    expect(json.data).toEqual({ value: 2 });
    expect(new Date(json.timestamp).toISOString()).toBe(json.timestamp);
  });

  it("apiCreated returns 201", async () => {
    const response = apiCreated({ id: "goal-1" });
    const json = (await response.json()) as ApiResponse<{ id: string }>;

    expect(response.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data).toEqual({ id: "goal-1" });
    expect(new Date(json.timestamp).toISOString()).toBe(json.timestamp);
  });

  it("apiNoContent returns 204 with empty body", async () => {
    const response = apiNoContent();

    expect(response.status).toBe(204);
    await expect(response.text()).resolves.toBe("");
  });

  it("apiError uses typed status defaults and error envelope", async () => {
    const response = apiError("UNAUTHORIZED", "Missing actor");
    const json = (await response.json()) as ApiError;

    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(json.success).toBe(false);
    expect(json.error).toEqual({
      code: "UNAUTHORIZED",
      message: "Missing actor",
    });
    expect(new Date(json.timestamp).toISOString()).toBe(json.timestamp);
  });

  it("apiError allows explicit status override", async () => {
    const response = apiError("INVALID_FIELD", "name must be a string", {
      status: 422,
      headers: {
        "x-error-source": "validation",
      },
    });
    const json = (await response.json()) as ApiError;

    expect(response.status).toBe(422);
    expect(response.headers.get("x-error-source")).toBe("validation");
    expect(json.success).toBe(false);
    expect(json.error).toEqual({
      code: "INVALID_FIELD",
      message: "name must be a string",
    });
    expect(new Date(json.timestamp).toISOString()).toBe(json.timestamp);
  });

  it("apiError includes optional details when provided", async () => {
    const response = apiError(
      "INVALID_FIELD",
      "Validation failed",
      {},
      {
        name: ["name is required"],
      },
    );
    const json = (await response.json()) as ApiError;

    expect(json.error).toEqual({
      code: "INVALID_FIELD",
      message: "Validation failed",
      details: {
        name: ["name is required"],
      },
    });
  });
});
