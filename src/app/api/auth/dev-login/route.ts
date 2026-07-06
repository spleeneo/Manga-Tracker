import { NextResponse } from "next/server";
import { createDevFamilySession, isDevFamilyLoginEnabled, parseDevFamilyRole } from "@/lib/dev-family";

export async function POST(request: Request) {
  if (!isDevFamilyLoginEnabled()) {
    return NextResponse.json({ error: "Development login is unavailable" }, { status: 404 });
  }

  const form = await request.formData();
  const role = parseDevFamilyRole(form.get("role"));
  if (!role) return NextResponse.json({ error: "Choose parent or child" }, { status: 400 });

  const { sessionToken, expires } = await createDevFamilySession(role);
  const response = new NextResponse(null, { status: 303, headers: { Location: "/" } });
  response.cookies.set("authjs.session-token", sessionToken, {
    expires,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return response;
}
