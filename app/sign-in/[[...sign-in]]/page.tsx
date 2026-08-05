import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      {/* Deliberately no forceRedirectUrl here (unlike app/page.tsx's
          SignInButton): a signed-out visit to a protected page (e.g.
          /products/[id]) hits auth.protect(), which redirects here with its
          own real redirect_url query param — that's the deep link we want
          to honor after sign-in, not override. The env var
          NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL (/dashboard)
          already covers the "no redirect_url present at all" case. */}
      <SignIn />
    </div>
  );
}
