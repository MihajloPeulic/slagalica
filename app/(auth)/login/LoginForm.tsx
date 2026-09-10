"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {PasswordInput} from "@/components/ui/PasswordInput";
import { LoginAction } from "@/actions/auth";

import { FormField } from "@/components/ui/FormField";
import { FormMessage } from "@/components/ui/FormMessage";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function LoginForm() {
  const searchParams = useSearchParams();

  const urlError =
    searchParams.get("error");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(
      urlError === "unauthorized"
        ? "Niste ulogovani."
        : urlError,
    );

  async function handleLogin(
    e: React.FormEvent<HTMLFormElement>,
  ) {
    e.preventDefault();

    setLoading(true);
    setError(null);

    const formData =
      new FormData(e.currentTarget);

    const res =
      await LoginAction(formData);

    if (res?.error) {
      setError(res.error);
      setLoading(false);

      return;
    }
  }

  return (
    <>
      <FormMessage
        error={error ?? undefined}
      />

      <form
        onSubmit={handleLogin}
        className="flex flex-col gap-4"
      >
        <FormField label="Email adresa">
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="tvoj@email.com"
          />
        </FormField>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-[10px] font-black uppercase tracking-[0.16em] text-text-secondary"
            >
              Lozinka
            </label>

            <Link
              href="/forgot-password"
              className="text-xs font-bold text-primary transition-colors hover:text-primary-hover"
            >
              Zaboravljena lozinka?
            </Link>
          </div>

          <PasswordInput
            id="password"
            name="password"
            required
            disabled={loading}
            autoComplete="new-password"
            placeholder="••••••••"
          />
        </div>

        <Button
          type="submit"
          fullWidth
          disabled={loading}
          className="mt-2"
        >
          {loading
            ? "Prijavljivanje..."
            : "Prijavi se"}
        </Button>
      </form>
    </>
  );
}
