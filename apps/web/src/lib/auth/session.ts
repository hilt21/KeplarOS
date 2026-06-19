import { createHmac, timingSafeEqual } from "node:crypto";

import { getDb } from "@/lib/db/client";
import type { Actor } from "@/lib/authorization/types";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";

export interface SessionCookie {
  readonly name: string;
  readonly value: string;
  readonly header: string;
  readonly expiresAt: string;
}

const SESSION_COOKIE_NAME = "keplar_session";
const SESSION_VERSION = "v1";
const SESSION_TTL_SECONDS = 60 * 30;

function getSessionSecret(): string {
  const configuredSecret = process.env.KEPLAR_SESSION_SECRET;
  if (configuredSecret && configuredSecret.length > 0) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("KEPLAR_SESSION_SECRET must be configured in production.");
  }

  return "keplar-dev-session-secret";
}

function isSecureCookie(): boolean {
  return process.env.NODE_ENV === "production";
}

function encodePayload(payload: { sub: string; exp: number }): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(encoded: string): {
  sub: string;
  exp: number;
} | null {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
      sub?: unknown;
      exp?: unknown;
    };

    if (typeof parsed.sub !== "string" || typeof parsed.exp !== "number") {
      return null;
    }

    return { sub: parsed.sub, exp: parsed.exp };
  } catch {
    return null;
  }
}

function signPayload(encodedPayload: string): string {
  return createHmac("sha256", getSessionSecret()).update(encodedPayload).digest("base64url");
}

function serializeCookie(name: string, value: string, maxAge: number): string {
  const parts = [`${name}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`];

  if (maxAge === 0) {
    parts.push("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  }

  if (isSecureCookie()) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function readCookieValue(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(/;\s*/)) {
    const [cookieName, ...rest] = part.split("=");
    if (cookieName === name) {
      return rest.join("=");
    }
  }

  return null;
}

function verifySessionValue(value: string): { userId: string } | null {
  const parts = value.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [version, encodedPayload, signature] = parts;

  if (version !== SESSION_VERSION || !encodedPayload || !signature) {
    return null;
  }

  let expectedSignature: string;
  try {
    expectedSignature = signPayload(encodedPayload);
  } catch {
    return null;
  }
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (actualBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  const payload = decodePayload(encodedPayload);
  if (!payload || payload.exp <= Date.now()) {
    return null;
  }

  return { userId: payload.sub };
}

export async function createSession(userId: string): Promise<SessionCookie> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  const encodedPayload = encodePayload({
    sub: userId,
    exp: Date.now() + SESSION_TTL_SECONDS * 1000,
  });
  const signature = signPayload(encodedPayload);
  const value = `${SESSION_VERSION}.${encodedPayload}.${signature}`;

  return {
    name: SESSION_COOKIE_NAME,
    value,
    header: serializeCookie(SESSION_COOKIE_NAME, value, SESSION_TTL_SECONDS),
    expiresAt,
  };
}

export async function getSessionActor(request: Request): Promise<Actor | null> {
  const sessionValue = readCookieValue(request, SESSION_COOKIE_NAME);
  if (!sessionValue) {
    return null;
  }

  const payload = verifySessionValue(sessionValue);
  if (!payload) {
    return null;
  }

  const db = getDb();
  const user = db
    .select({
      id: users.id,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, payload.userId))
    .get();

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    role: user.role,
  };
}

export function clearSessionCookie(): string {
  return serializeCookie(SESSION_COOKIE_NAME, "", 0);
}
