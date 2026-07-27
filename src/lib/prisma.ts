import { PrismaClient } from "@prisma/client";

/*
  One shared Prisma connection for the whole app.

  In development, Next.js reloads code often — without this guard we'd
  open a new database connection on every reload and eventually run out.
  So we stash the connection on the global object and reuse it.
*/
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
