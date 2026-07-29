import { auth } from "@clerk/nextjs/server";
import { getOrCreateAccountForClerkUser } from "@/lib/db/accounts";

// Temporary placeholder to verify Unit 3's session -> Account resolution.
// Unit 4 replaces this with the real app/(dashboard)/ shell (shadcn sidebar).
export default async function DashboardPage() {
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 font-sans">
      <p>Signed in.</p>
      <p className="font-mono text-sm">Account ID: {account.id}</p>
    </div>
  );
}
