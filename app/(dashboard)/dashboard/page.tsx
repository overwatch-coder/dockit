import { auth } from "@clerk/nextjs/server";
import { getOrCreateAccountForClerkUser } from "@/lib/db/accounts";

// Temporary placeholder to verify Unit 3's session -> Account resolution.
// Unit 8 replaces this body with the real product list at this same route.
export default async function DashboardPage() {
  // Call protect() here too (not just a non-null assertion on the layout's
  // check) so a cold-start race that slips past the layout still redirects
  // instead of crashing on a null userId.
  const { userId } = await auth.protect();
  const account = await getOrCreateAccountForClerkUser(userId);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 font-sans">
      <p>Signed in.</p>
      <p className="font-mono text-sm">Account ID: {account.id}</p>
    </div>
  );
}
