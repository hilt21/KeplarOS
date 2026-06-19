import { apiOk } from "@/lib/api/response";
import { clearSessionCookie } from "@/lib/auth/session";

export async function POST(): Promise<Response> {
  return apiOk(
    {
      loggedOut: true,
    },
    {
      headers: {
        "set-cookie": clearSessionCookie(),
      },
    },
  );
}
