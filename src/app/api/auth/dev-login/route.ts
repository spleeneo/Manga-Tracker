import { NextResponse } from "next/server";
import { createDevFamilySession, devFamilyRoleForHost, devFamilySessionCookieName, isDevFamilyLoginEnabled } from "@/lib/dev-family";

export async function POST(request: Request) {
  if (!isDevFamilyLoginEnabled()) {
    return NextResponse.json({ error: "Development login is unavailable" }, { status: 404 });
  }

  const role = devFamilyRoleForHost(request.headers.get("host"));
  if (!role) return NextResponse.json({ error: "Use a supported local family-test origin" }, { status: 400 });

  await request.formData();

  const { sessionToken, expires } = await createDevFamilySession(role);
  const response = new NextResponse(null, { status: 303, headers: { Location: "/" } });
  response.cookies.set(devFamilySessionCookieName(role), sessionToken, {
    expires,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return response;
}
