"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register } from "@/app/actions";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [state, action, pending] = useActionState(mode === "login" ? login : register, undefined);
  const isLogin = mode === "login";

  return (
    <main className="auth">
      <form action={action} className="card auth-card">
        <h1>{isLogin ? "Welcome back" : "Create your account"}</h1>
        <p className="muted">{isLogin ? "Log in to your study planner." : "Plan tasks. Focus. Repeat."}</p>

        {!isLogin && (
          <label>
            Name
            <input name="name" autoComplete="name" required maxLength={60} />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            minLength={isLogin ? undefined : 8}
            required
          />
        </label>

        {state?.error && (
          <p className="error" role="alert">
            {state.error}
          </p>
        )}

        <button className="btn primary" disabled={pending}>
          {pending ? "Please wait…" : isLogin ? "Log in" : "Sign up"}
        </button>

        <p className="muted small">
          {isLogin ? (
            <>
              New here? <Link href="/register">Create an account</Link>
            </>
          ) : (
            <>
              Already registered? <Link href="/login">Log in</Link>
            </>
          )}
        </p>
      </form>
    </main>
  );
}
