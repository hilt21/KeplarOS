import { beforeEach, describe, expect, it, vi } from "vitest";

import { createJsonRequest, expectApiError, expectApiOk } from "./route-test-harness";

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
}));

const mockVerifyPassword = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/client", () => ({
  getDb: () => mockDb,
}));

vi.mock("@/lib/auth/password", () => ({
  verifyPassword: mockVerifyPassword,
}));

type SelectRow = Record<string, unknown> | null | undefined;

function queueSelectResults(...rows: SelectRow[]): void {
  const pending = [...rows];

  mockDb.select.mockImplementation(() => ({
    from: () => ({
      innerJoin: () => ({
        where: () => ({
          get: () => pending.shift(),
        }),
      }),
      where: () => ({
        get: () => pending.shift(),
      }),
    }),
  }));
}

function captureUpdates(): Array<Record<string, unknown>> {
  const updates: Array<Record<string, unknown>> = [];

  mockDb.update.mockImplementation(() => ({
    set: (values: Record<string, unknown>) => ({
      where: () => ({
        run: () => {
          updates.push(values);
        },
      }),
    }),
  }));

  return updates;
}

describe("auth API (F2-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KEPLAR_SESSION_SECRET = "test-session-secret";
  });

  it("POST /api/v1/auth/login returns 200 and sets an HttpOnly session cookie", async () => {
    queueSelectResults({
      userId: "user-1",
      name: "Alice",
      email: "alice@example.com",
      role: "chain_user",
      passwordHash: "stored-hash",
      failedLoginAttempts: 2,
      lockedUntil: null,
    });
    const updates = captureUpdates();
    mockVerifyPassword.mockResolvedValue(true);

    const { POST } = await import("@/app/api/v1/auth/login/route");
    const response = await POST(
      createJsonRequest("/api/v1/auth/login", "POST", {
        email: "alice@example.com",
        password: "correct-password",
      }),
    );

    const json = await expectApiOk<{
      user: { id: string; email: string; role: string };
      expires_at: string;
    }>(response);
    expect(json.data.user).toMatchObject({
      id: "user-1",
      email: "alice@example.com",
      role: "chain_user",
    });
    expect(new Date(json.data.expires_at).toISOString()).toBe(json.data.expires_at);

    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("Max-Age=1800");

    expect(updates).toEqual([
      {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      {
        lastLoginAt: expect.any(String),
      },
    ]);
  });

  it("POST /api/v1/auth/login returns 401 for invalid credentials and increments failed attempts", async () => {
    queueSelectResults({
      userId: "user-1",
      name: "Alice",
      email: "alice@example.com",
      role: "chain_user",
      passwordHash: "stored-hash",
      failedLoginAttempts: 1,
      lockedUntil: null,
    });
    const updates = captureUpdates();
    mockVerifyPassword.mockResolvedValue(false);

    const { POST } = await import("@/app/api/v1/auth/login/route");
    const response = await POST(
      createJsonRequest("/api/v1/auth/login", "POST", {
        email: "alice@example.com",
        password: "wrong-password",
      }),
    );

    await expectApiError(response, "UNAUTHORIZED", 401);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(updates).toEqual([
      {
        failedLoginAttempts: 2,
      },
    ]);
  });

  it("POST /api/v1/auth/login returns 401 when the credential is locked", async () => {
    queueSelectResults({
      userId: "user-1",
      name: "Alice",
      email: "alice@example.com",
      role: "chain_user",
      passwordHash: "stored-hash",
      failedLoginAttempts: 3,
      lockedUntil: "2999-01-01T00:00:00.000Z",
    });
    captureUpdates();

    const { POST } = await import("@/app/api/v1/auth/login/route");
    const response = await POST(
      createJsonRequest("/api/v1/auth/login", "POST", {
        email: "alice@example.com",
        password: "correct-password",
      }),
    );

    await expectApiError(response, "UNAUTHORIZED", 401);
    expect(mockVerifyPassword).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("GET /api/v1/auth/me returns the current user for a valid session cookie", async () => {
    queueSelectResults(
      {
        id: "user-1",
        role: "chain_user",
      },
      {
        id: "user-1",
        name: "Alice",
        email: "alice@example.com",
        role: "chain_user",
      },
    );

    const { createSession } = await import("@/lib/auth/session");
    const session = await createSession("user-1");
    const { GET } = await import("@/app/api/v1/auth/me/route");

    const response = await GET(
      createJsonRequest("/api/v1/auth/me", "GET", undefined, {
        headers: {
          cookie: `${session.name}=${session.value}`,
        },
      }),
    );

    const json = await expectApiOk<{ user: { id: string; email: string; role: string } }>(response);
    expect(json.data.user).toMatchObject({
      id: "user-1",
      email: "alice@example.com",
      role: "chain_user",
    });
  });

  it("GET /api/v1/auth/me returns 401 without a valid authenticated session", async () => {
    const { GET } = await import("@/app/api/v1/auth/me/route");
    const response = await GET(createJsonRequest("/api/v1/auth/me", "GET"));

    await expectApiError(response, "UNAUTHORIZED", 401);
  });

  it("GET /api/v1/auth/me returns 401 for a tampered session cookie", async () => {
    const { createSession } = await import("@/lib/auth/session");
    const session = await createSession("user-1");
    const tamperedValue = `${session.value}tampered`;
    const { GET } = await import("@/app/api/v1/auth/me/route");

    const response = await GET(
      createJsonRequest("/api/v1/auth/me", "GET", undefined, {
        headers: {
          cookie: `${session.name}=${tamperedValue}`,
        },
      }),
    );

    await expectApiError(response, "UNAUTHORIZED", 401);
  });

  it("GET /api/v1/auth/me returns 401 when the session user no longer exists", async () => {
    queueSelectResults(null);

    const { createSession } = await import("@/lib/auth/session");
    const session = await createSession("missing-user");
    const { GET } = await import("@/app/api/v1/auth/me/route");

    const response = await GET(
      createJsonRequest("/api/v1/auth/me", "GET", undefined, {
        headers: {
          cookie: `${session.name}=${session.value}`,
        },
      }),
    );

    await expectApiError(response, "UNAUTHORIZED", 401);
  });

  it("GET /api/v1/auth/me returns 401 for an expired session cookie", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    try {
      queueSelectResults({
        id: "user-1",
        role: "chain_user",
      });

      const { createSession } = await import("@/lib/auth/session");
      const session = await createSession("user-1");
      const { GET } = await import("@/app/api/v1/auth/me/route");

      vi.setSystemTime(new Date("2026-01-01T00:31:00.000Z"));

      const response = await GET(
        createJsonRequest("/api/v1/auth/me", "GET", undefined, {
          headers: {
            cookie: `${session.name}=${session.value}`,
          },
        }),
      );

      await expectApiError(response, "UNAUTHORIZED", 401);
    } finally {
      vi.useRealTimers();
    }
  });

  it("session cookie uses Secure in production", async () => {
    const env = process.env as Record<string, string | undefined>;
    const previousNodeEnv = env.NODE_ENV;
    const previousSessionSecret = env.KEPLAR_SESSION_SECRET;
    env.NODE_ENV = "production";
    env.KEPLAR_SESSION_SECRET = "test-session-secret";

    try {
      const { createSession } = await import("@/lib/auth/session");
      const session = await createSession("user-1");
      expect(session.header).toContain("Secure");
      expect(session.header).toContain("SameSite=Lax");
    } finally {
      env.NODE_ENV = previousNodeEnv;
      env.KEPLAR_SESSION_SECRET = previousSessionSecret;
    }
  });

  it("POST /api/v1/auth/logout clears the session cookie", async () => {
    const { POST } = await import("@/app/api/v1/auth/logout/route");
    const response = await POST();

    const json = await expectApiOk<{ loggedOut: boolean }>(response);
    expect(json.data.loggedOut).toBe(true);

    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("Max-Age=0");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
  });
});
