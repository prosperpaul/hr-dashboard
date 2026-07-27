import { DefaultSession } from "next-auth";

/*
  By default, Auth.js only knows that a session user has name/email/image.
  We added `id` and `role`, so we teach TypeScript about them here. This is
  called "module augmentation" — we're extending Auth.js's own types.

  Without this file, `session.user.role` would be a type error.
*/

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }

  // The object returned from `authorize()` — add `role` here too.
  interface User {
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
  }
}
