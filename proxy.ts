import { NextRequest, NextResponse } from "next/server";
import { rateLimits } from "@/lib/rate-limit";
import { getClientIpFromRequest } from "@/lib/get-client-ip";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Bitno: rate-limited stranica mora biti dostupna
  // čak i kada je korisnik već prešao limit.
  if (pathname === "/rate-limited") {
    return NextResponse.next();
  }

  const ip = getClientIpFromRequest(request);

  const {
    success,
    limit,
    remaining,
    reset,
  } = await rateLimits.general.limit(ip);

  if (!success) {
    const url = request.nextUrl.clone();

    url.pathname = "/rate-limited";

    // Očisti query parametre originalne stranice.
    url.search = "";

    const response = NextResponse.redirect(url);

    response.headers.set(
      "X-RateLimit-Limit",
      limit.toString(),
    );

    response.headers.set(
      "X-RateLimit-Remaining",
      remaining.toString(),
    );

    response.headers.set(
      "X-RateLimit-Reset",
      reset.toString(),
    );

    return response;
  }

  const response = NextResponse.next();

  response.headers.set(
    "X-RateLimit-Limit",
    limit.toString(),
  );

  response.headers.set(
    "X-RateLimit-Remaining",
    remaining.toString(),
  );

  response.headers.set(
    "X-RateLimit-Reset",
    reset.toString(),
  );

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};