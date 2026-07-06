import { NextResponse, type NextRequest } from "next/server";

// When this deployment is running as the public marketing domain (a second,
// free Railway service pointed at the same app — see DEPLOY.md), it should
// only ever serve the landing page and the waitlist API. Everything else
// (login, signup, the app itself) is blocked here, at the routing layer, not
// just left unlinked — so the real app domain can stay unpublicized without
// relying on obscurity alone.
const ALLOWED_PREFIXES = ["/landing", "/api/waitlist", "/_next", "/favicon.ico", "/icon.svg"];

export function middleware(req: NextRequest) {
  if (process.env.LANDING_ONLY !== "true") return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/landing";
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except static assets Next.js already serves directly.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
