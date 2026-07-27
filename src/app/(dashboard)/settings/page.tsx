import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import AccountSettings from "@/components/settings/AccountSettings";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      role: true,
      employee: { select: { name: true } },
    },
  });
  if (!user) redirect("/login");

  return (
    <AccountSettings
      account={{
        name: user.name,
        email: user.email,
        role: user.role,
        employeeName: user.employee?.name ?? null,
      }}
    />
  );
}
