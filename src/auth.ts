import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";

/*
  The FULL Auth.js config. It reuses the lightweight base (auth.config.ts) and
  adds the Credentials provider, which needs Prisma + bcrypt to verify
  passwords. This heavy code only runs during LOGIN and on the /api/auth
  endpoints — NOT on every page navigation (the proxy uses the light config).

  Exports:
    - handlers : the GET/POST endpoints (wired up in the API route)
    - signIn   : call from a server action to log a user in
    - signOut  : call to log a user out
    - auth     : read the current session on the server (pages, actions)
*/
export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,

  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      /*
        The heart of login. Return a user object => success. Return null =>
        failure (Auth.js turns that into a generic "invalid credentials" error,
        so we never reveal WHICH part was wrong).
      */
      async authorize(credentials) {
        // Normalize the email (trim + lowercase) so a stray space or an
        // auto-capitalized first letter still matches the stored account.
        const email = (credentials?.email as string | undefined)?.trim().toLowerCase();
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) return null;

        // Return only the safe fields (NEVER the password hash).
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
});
