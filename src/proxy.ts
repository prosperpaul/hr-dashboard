import { auth } from "@/auth";
import { NextResponse } from "next/server";

/*
  Route protection. In THIS version of Next.js the old `middleware.ts` file is
  deprecated and renamed to `proxy.ts` — same idea: code that runs on the
  server before a page renders.

  We wrap it with Auth.js's `auth()` helper, which reads the session and hangs
  it on `req.auth`. Then we redirect based on login state.

  Note: this is a fast "optimistic" gate for good UX. It is NOT the only line of
  defense — pages and server actions still check the session close to the data.
*/
export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isOnLogin = req.nextUrl.pathname === "/login";

  // Logged-out user heading anywhere except the login page → send to login.
  if (!isLoggedIn && !isOnLogin) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  // Already logged in but sitting on the login page → send to the dashboard.
  if (isLoggedIn && isOnLogin) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return NextResponse.next();
});

/*
  Which paths this runs on. We EXCLUDE:
    - /api/*          (includes Auth.js's own /api/auth endpoints — must stay open)
    - _next/static, _next/image  (build assets)
    - favicon.ico and image files
  Everything else (all real pages) goes through the check above.
*/
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico)$).*)"],
};
