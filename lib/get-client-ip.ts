// src/lib/get-client-ip.ts

import type { NextRequest } from "next/server";
import { headers } from "next/headers";

function parseForwardedFor(value: string | null): string | null {
  if (!value) return null;

  const ip = value.split(",")[0]?.trim();

  return ip || null;
}

export function getClientIpFromRequest(
  request: NextRequest,
): string {
  const forwardedIp = parseForwardedFor(
    request.headers.get("x-forwarded-for"),
  );

  if (forwardedIp) {
    return forwardedIp;
  }

  const realIp = request.headers.get("x-real-ip");

  if (realIp) {
    return realIp.trim();
  }

  if (process.env.NODE_ENV === "development") {
    return "127.0.0.1";
  }

  throw new Error(
    "Client IP is unavailable in production.",
  );
}

export async function getClientIp(): Promise<string> {
  const headersList = await headers();

  const forwardedIp = parseForwardedFor(
    headersList.get("x-forwarded-for"),
  );

  if (forwardedIp) {
    return forwardedIp;
  }

  const realIp = headersList.get("x-real-ip");

  if (realIp) {
    return realIp.trim();
  }

  if (process.env.NODE_ENV === "development") {
    return "127.0.0.1";
  }

  throw new Error(
    "Client IP is unavailable in production.",
  );
}