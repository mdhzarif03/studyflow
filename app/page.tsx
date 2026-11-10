import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (await getUser()) redirect("/dashboard");

  return (
    <main className="auth">
      <div className="card auth-card">
        <h1>StudyFlow</h1>
        <p className="muted">
          Keep your study tasks in one place and stay focused with a built-in Pomodoro timer. Your tasks and focus
          history are saved to your account.
        </p>
        <Link href="/register" className="btn primary">
          Get started
        </Link>
        <Link href="/login" className="btn">
          Log in
        </Link>
      </div>
    </main>
  );
}
