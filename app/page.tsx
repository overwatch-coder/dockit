import { SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center gap-6 bg-zinc-50 font-sans dark:bg-black">
      <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
        Dockit
      </h1>
      <Show when="signed-out">
        <div className="flex gap-4">
          <SignInButton />
          <SignUpButton />
        </div>
      </Show>
      <Show when="signed-in">
        <div className="flex items-center gap-4">
          <UserButton />
          <Link
            href="/dashboard"
            className="text-sm font-medium text-black underline dark:text-zinc-50"
          >
            Go to dashboard
          </Link>
        </div>
      </Show>
    </div>
  );
}
