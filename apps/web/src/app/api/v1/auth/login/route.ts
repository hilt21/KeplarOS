import { eq } from "drizzle-orm";

import { ApiRequestError } from "@/lib/api/errors";
import { readJsonBody, requireString } from "@/lib/api/request";
import { apiError, apiOk } from "@/lib/api/response";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { authCredentials, users } from "@db/schema";

interface LoginBody {
  email?: unknown;
  password?: unknown;
}

function unauthorized(): Response {
  return apiError("UNAUTHORIZED", "Invalid email or password.");
}

function toIsoNow(): string {
  return new Date().toISOString();
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonBody<LoginBody>(request);
    const email = requireString(body.email, "email").trim().toLowerCase();
    const password = requireString(body.password, "password");

    const db = getDb();
    const credential = db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        passwordHash: authCredentials.passwordHash,
        failedLoginAttempts: authCredentials.failedLoginAttempts,
        lockedUntil: authCredentials.lockedUntil,
      })
      .from(users)
      .innerJoin(authCredentials, eq(authCredentials.userId, users.id))
      .where(eq(users.email, email))
      .get();

    if (!credential) {
      return unauthorized();
    }

    if (credential.lockedUntil && new Date(credential.lockedUntil).getTime() > Date.now()) {
      return unauthorized();
    }

    const isValid = await verifyPassword(credential.passwordHash, password);

    if (!isValid) {
      db.update(authCredentials)
        .set({
          failedLoginAttempts: credential.failedLoginAttempts + 1,
        })
        .where(eq(authCredentials.userId, credential.userId))
        .run();

      return unauthorized();
    }

    db.update(authCredentials)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
      })
      .where(eq(authCredentials.userId, credential.userId))
      .run();

    db.update(users)
      .set({
        lastLoginAt: toIsoNow(),
      })
      .where(eq(users.id, credential.userId))
      .run();

    const session = await createSession(credential.userId);

    return apiOk(
      {
        user: {
          id: credential.userId,
          name: credential.name,
          email: credential.email,
          role: credential.role,
        },
        expires_at: session.expiresAt,
      },
      {
        headers: {
          "set-cookie": session.header,
        },
      },
    );
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return apiError(error.code, error.message, { status: error.status });
    }

    return apiError("INTERNAL_ERROR", "Unexpected error.");
  }
}
