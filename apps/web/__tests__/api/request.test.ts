import { describe, expect, it } from "vitest";

import type { Actor } from "@/lib/authorization/types";
import { ApiRequestError } from "@/lib/api/errors";
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parsePagination,
} from "@/lib/api/pagination";
import { parseCurrentActor, readJsonBody, requireString, optionalString } from "@/lib/api/request";
import { apiError, apiOk } from "@/lib/api/response";
import {
  createJsonRequest,
  expectApiError,
  expectApiOk,
  withTestSession,
} from "./route-test-harness";

describe("request helpers", () => {
  it("readJsonBody parses typed JSON payloads", async () => {
    const request = createJsonRequest("/api/test", "POST", {
      name: "alpha",
    });

    await expect(readJsonBody<{ name: string }>(request)).resolves.toEqual({
      name: "alpha",
    });
  });

  it("readJsonBody throws INVALID_JSON for malformed payloads", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "{bad json",
    });

    await expect(readJsonBody(request)).rejects.toMatchObject({
      code: "INVALID_JSON",
      status: 400,
      message: "Request body must be valid JSON.",
    } satisfies Pick<ApiRequestError, "code" | "status" | "message">);
  });

  it("requireString returns a string field", () => {
    expect(requireString("alpha", "name")).toBe("alpha");
  });

  it("requireString rejects missing values", () => {
    expect(() => requireString(undefined, "name")).toThrowError(ApiRequestError);
    expect(() => requireString(undefined, "name")).toThrow("name is required.");
  });

  it("optionalString accepts undefined and strings", () => {
    expect(optionalString(undefined, "nickname")).toBeUndefined();
    expect(optionalString("beta", "nickname")).toBe("beta");
  });

  it("optionalString rejects non-string values", () => {
    expect(() => optionalString(42, "nickname")).toThrowError(ApiRequestError);
    expect(() => optionalString(42, "nickname")).toThrow("nickname must be a string.");
  });

  it("parseCurrentActor returns the injected test actor", async () => {
    const actor: Actor = {
      id: "user-1",
      role: "chain_user",
    };
    const request = createJsonRequest("/api/test", "GET", undefined, withTestSession(actor));

    await expect(parseCurrentActor(request)).resolves.toEqual(actor);
  });

  it("parseCurrentActor rejects missing actor context", async () => {
    const request = createJsonRequest("/api/test", "GET");

    await expect(parseCurrentActor(request)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
      message: "Authentication required.",
    } satisfies Pick<ApiRequestError, "code" | "status" | "message">);
  });

  it("parseCurrentActor rejects invalid role values", async () => {
    const request = createJsonRequest(
      "/api/test",
      "GET",
      undefined,
      withTestSession({
        id: "user-1",
        role: "admin" as Actor["role"],
      }),
    );

    await expect(parseCurrentActor(request)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
      message: "Invalid current actor role.",
    } satisfies Pick<ApiRequestError, "code" | "status" | "message">);
  });

  it("parseCurrentActor rejects test header outside test runtime", async () => {
    const env = process.env as Record<string, string | undefined>;
    const previousNodeEnv = env.NODE_ENV;
    const previousVitestEnv = env.VITEST;
    env.NODE_ENV = "production";
    delete env.VITEST;

    try {
      const request = createJsonRequest(
        "/api/test",
        "GET",
        undefined,
        withTestSession({
          id: "user-1",
          role: "chain_user",
        }),
      );

      await expect(parseCurrentActor(request)).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        status: 401,
        message: "Authentication required.",
      } satisfies Pick<ApiRequestError, "code" | "status" | "message">);
    } finally {
      env.NODE_ENV = previousNodeEnv;
      if (previousVitestEnv === undefined) {
        delete env.VITEST;
      } else {
        env.VITEST = previousVitestEnv;
      }
    }
  });
});

describe("pagination helpers", () => {
  it("parsePagination returns documented defaults", () => {
    expect(parsePagination(new URLSearchParams())).toEqual({
      page: DEFAULT_PAGE,
      limit: DEFAULT_PAGE_SIZE,
    });
  });

  it("parsePagination caps limit at the documented maximum", () => {
    expect(parsePagination(new URLSearchParams("page=2&limit=999"))).toEqual({
      page: 2,
      limit: MAX_PAGE_SIZE,
    });
  });

  it("parsePagination rejects invalid positive integer inputs", () => {
    expect(() => parsePagination(new URLSearchParams("page=0"))).toThrow(
      "page must be a positive integer.",
    );
    expect(() => parsePagination(new URLSearchParams("limit=abc"))).toThrow(
      "limit must be a positive integer.",
    );
  });
});

describe("route test harness", () => {
  it("createJsonRequest sets method, json body, and merged headers", async () => {
    const request = createJsonRequest(
      "/api/test",
      "PATCH",
      { title: "Updated" },
      {
        headers: {
          "x-extra": "yes",
        },
      },
    );

    expect(request.method).toBe("PATCH");
    expect(request.headers.get("content-type")).toBe("application/json");
    expect(request.headers.get("x-extra")).toBe("yes");
    await expect(request.json()).resolves.toEqual({ title: "Updated" });
  });

  it("expectApiOk asserts success envelopes and returns parsed json", async () => {
    const response = apiOk({ id: "goal-1" });

    await expect(expectApiOk<{ id: string }>(response)).resolves.toEqual({
      success: true,
      data: { id: "goal-1" },
      timestamp: expect.any(String),
    });
  });

  it("expectApiError asserts error envelope, code, and status", async () => {
    const response = apiError("INVALID_FIELD", "name is required.");

    await expect(expectApiError(response, "INVALID_FIELD", 400)).resolves.toEqual({
      success: false,
      error: {
        code: "INVALID_FIELD",
        message: "name is required.",
      },
      timestamp: expect.any(String),
    });
  });
});
