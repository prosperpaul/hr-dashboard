/*
  Auth.js needs a set of HTTP endpoints under /api/auth/* (for session,
  callbacks, csrf, etc.). This catch-all route just re-exports the GET/POST
  handlers we built in src/auth.ts — that's the whole file.
*/
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
