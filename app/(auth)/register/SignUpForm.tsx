"use client";

import {
  useState,
} from "react";

import {
  RegisterAction,
} from "@/actions/auth";

import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { FormMessage } from "@/components/ui/FormMessage";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";

export default function SignUpForm() {
  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  async function handleRegister(
    e: React.FormEvent<HTMLFormElement>,
  ) {
    e.preventDefault();

    if (loading) return;

    setLoading(true);
    setError(null);

    const formData =
      new FormData(e.currentTarget);

    const res =
      await RegisterAction(formData);

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
        onSubmit={handleRegister}
        className="flex flex-col gap-4"
      >
        <FormField label="Korisničko ime">
          <Input
            id="username"
            name="username"
            type="text"
            required
            disabled={loading}
            autoComplete="username"
            placeholder="igrac123"
          />
        </FormField>

        <FormField label="Email adresa">
          <Input
            id="email"
            name="email"
            type="email"
            required
            disabled={loading}
            autoComplete="email"
            placeholder="tvoj@email.com"
          />
        </FormField>

        <FormField
          label="Lozinka"
          hint="Najmanje 8 karaktera, jedno veliko slovo i jedan broj."
        >
          <PasswordInput
            id="password"
            name="password"
            required
            disabled={loading}
            autoComplete="new-password"
            placeholder="••••••••"
          />
        </FormField>

        <FormField label="Potvrdi lozinku">
          <PasswordInput
            id="confirm_password"
            name="confirm_password"
            required
            disabled={loading}
            autoComplete="new-password"
            placeholder="••••••••"
          />
        </FormField>

        <Button
          type="submit"
          fullWidth
          disabled={loading}
          className="mt-2"
        >
          {loading
            ? "Pravljenje naloga..."
            : "Registruj se"}
        </Button>
      </form>
    </>
  );
}
