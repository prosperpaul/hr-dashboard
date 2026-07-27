import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/*
  This file configures Auth.js (NextAuth v5) — the "brain" of logging in.

  It exports four helpers we'll use around the app:
    - handlers : the GET/POST endpoints Auth.js needs (wired up in the API route)
    - signIn   : call from a server action to log a user in
    - signOut  : call to log a user out
    - auth     : read the current session on the server (pages, actions, proxy)
*/

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Where our custom login page lives, so Auth.js redirects here instead of
  // its own built-in page.
  pages: {
    signIn: "/login",
  },

  // Store the session in a signed cookie (a JWT). This is required when using
  // the Credentials provider — database sessions aren't supported with it.
  session: { strategy: "jwt" },

  providers: [
    Credentials({
      // The fields Auth.js expects for this provider.
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      /*
        The heart of login. Auth.js calls this with whatever the user typed.
        Return a user object => login succeeds. Return null => login fails
        (Auth.js turns that into a generic "invalid credentials" error, so we
        never reveal WHICH part was wrong — that would help attackers).
      */
      async authorize(credentials) {
        // Normalize the email (trim + lowercase) so a stray space or an
        // auto-capitalized first letter still matches the stored account.
        const email = (credentials?.email as string | undefined)?.trim().toLowerCase();
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        // 1. Find the account by email.
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        // 2. Compare the typed password against the stored bcrypt hash.
        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) return null;

        // 3. Success — return the safe fields (NEVER the password hash).
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],

  callbacks: {
    /*
      The JWT callback runs whenever the token is created/updated. On first
      sign-in `user` is present, so we copy id + role INTO the token. On later
      requests only `token` exists, and it already carries these values.
    */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },

    /*
      The session callback shapes what `auth()` / `useSession()` return. We copy
      id + role from the token onto session.user so the whole app can read them.
    */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});
