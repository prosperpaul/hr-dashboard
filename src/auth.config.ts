import type { NextAuthConfig } from "next-auth";

/*
  The LIGHTWEIGHT auth config, shared by the full auth (src/auth.ts) and the
  route-protection gate (src/proxy.ts).

  Crucially, this file imports NO database code (Prisma) and NO bcrypt — so the
  proxy/middleware that uses it stays tiny and cold-starts fast. The heavy
  Credentials provider (which needs Prisma + bcrypt to check passwords) is
  added only in src/auth.ts, which runs during login, not on every page load.
*/
export const authConfig = {
  pages: {
    signIn: "/login",
  },

  // Session lives in a signed cookie (JWT) — required with Credentials login,
  // and it means the gate can read the session WITHOUT touching the database.
  session: { strategy: "jwt" },

  // Providers are added in src/auth.ts. The gate only READS the session.
  providers: [],

  callbacks: {
    // Copy id + role into the token on sign-in (pure — no DB).
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },

    // Expose id + role on the session object (pure — no DB).
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
