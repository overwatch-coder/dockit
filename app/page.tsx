import { SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center gap-6 bg-background font-sans">
      <h1 className="text-page-title font-semibold tracking-tight text-foreground">
        Dockit
      </h1>
      <Show when="signed-out">
        <div className="flex gap-4">
          <SignInButton>
            <Button>Sign in</Button>
          </SignInButton>
          <SignUpButton>
            <Button variant="outline">Sign up</Button>
          </SignUpButton>
        </div>
      </Show>
      <Show when="signed-in">
        <div className="flex items-center gap-4">
          <UserButton />
          <Button render={<Link href="/dashboard" />}>Go to dashboard</Button>
        </div>
      </Show>
    </div>
  );
}
