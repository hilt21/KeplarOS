import { eq } from "drizzle-orm";

import { apiError, apiOk } from "@/lib/api/response";
import { getSessionActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { users } from "@db/schema";

export async function GET(request: Request): Promise<Response> {
  const actor = await getSessionActor(request);

  if (!actor) {
    return apiError("UNAUTHORIZED", "Authentication required.");
  }

  const db = getDb();
  const user = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, actor.id))
    .get();

  if (!user) {
    return apiError("UNAUTHORIZED", "Authentication required.");
  }

  return apiOk({
    user,
  });
}
