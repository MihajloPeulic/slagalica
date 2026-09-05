"use server";

import { createServerSupabaseClient } from "@/utils/supabase/server";
import { rateLimits } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/get-client-ip";
import { redirect } from "next/navigation";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*\d)(?=.*[A-Z]).{8,}$/;

export async function RegisterAction(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  const password = String(
    formData.get("password") ?? ""
  );

  const confirmPassword = String(
    formData.get("confirm_password") ?? ""
  );

  const username = String(
    formData.get("username") ?? ""
  ).trim();

  // -------------------------
  // INPUT VALIDATION
  // -------------------------

  if (!EMAIL_REGEX.test(email)) {
    return {
      error: "Ovo nije pravi email.",
    };
  }

  if (username.length < 3 || username.length > 16) {
    return {
      error:
        "Username mora imati između 3 i 16 karaktera.",
    };
  }

  if (!PASSWORD_REGEX.test(password)) {
    return {
      error:
        "Lozinka mora imati najmanje 8 karaktera, bar jedno veliko slovo i bar jedan broj.",
    };
  }

  if (password !== confirmPassword) {
    return {
      error: "Lozinke se ne poklapaju.",
    };
  }

  // -------------------------
  // RATE LIMIT
  // -------------------------

  const ip = await getClientIp();

  const { success } =
    await rateLimits.register.limit(ip);

  if (!success) {
    return {
      error:
        "Previše pokušaja registracije. Pokušaj ponovo za nekoliko minuta.",
    };
  }

  // -------------------------
  // SUPABASE
  // -------------------------

  const supabase =
    await createServerSupabaseClient();

  const { error: authError } =
    await supabase.auth.signUp({
      email,
      password,

      options: {
        data: {
          username,
        },
      },
    });

  if (authError) {
    return {
      error: authError.message,
    };
  }

  redirect("/home");
}

export async function LoginAction(formData: FormData) {
  const email = String(
    formData.get("email") ?? ""
  )
    .trim()
    .toLowerCase();

  const password = String(
    formData.get("password") ?? ""
  );

  // -------------------------
  // INPUT VALIDATION
  // -------------------------

  if (!email || !password) {
    return {
      error: "Email i lozinka su obavezni.",
    };
  }

  if (!EMAIL_REGEX.test(email)) {
    return {
      error: "Email ili lozinka nisu ispravni.",
    };
  }

  // -------------------------
  // RATE LIMIT
  // -------------------------

  const ip = await getClientIp();

  const { success } =
    await rateLimits.login.limit(ip);

  if (!success) {
    return {
      error:
        "Previše pokušaja prijave. Pokušaj ponovo za minut.",
    };
  }

  // -------------------------
  // SUPABASE
  // -------------------------

  const supabase =
    await createServerSupabaseClient();

  const { error: authError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (authError) {
    return {
      error:
        "Email ili lozinka nisu ispravni.",
    };
  }

  redirect("/home");
}

export async function LogOutAction() {
  const supabase =
    await createServerSupabaseClient();

  const { error: authError } =
    await supabase.auth.signOut();

  if (authError) {
    return {
      error: authError.message,
    };
  }

  redirect("/login");
}