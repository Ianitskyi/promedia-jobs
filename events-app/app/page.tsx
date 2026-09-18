import Link from "next/link";
import { Button } from "@/components/Button";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-24">
      <h1 className="font-serif text-4xl italic">ProMedia Events</h1>
      <p className="mt-4 max-w-md text-muted">
        Create events, accept registrations, issue QR tickets, and check
        attendees in at the door.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/login">
          <Button>Organizer sign in</Button>
        </Link>
      </div>
    </main>
  );
}
