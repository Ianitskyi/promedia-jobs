import { redirect } from "next/navigation";

/**
 * The organizer entry point goes straight to the sign-in form — there is
 * no separate marketing/landing step. Branding and the language switcher
 * live on `/login` itself (see app/login/page.tsx). Authenticated users
 * are forwarded on to the dashboard by the middleware once they reach
 * `/login`.
 */
export default function HomePage() {
  redirect("/login");
}
