"use server";

import { getCurrentUserWithProfile } from "@/data/auth";
import { createServerSupabaseClient } from "@/utils/supabase/server";


export async function ChangeUsername(new_username: string, current_username: string){

    if(new_username === current_username) {
        return {error: "Ovo je vaš trenutni username."}
    }

    if (new_username.length < 3 || new_username.length > 16) {
        return {
        error:
            "Username mora imati između 3 i 16 karaktera.",
        };
    }

    const {user, profile} = await getCurrentUserWithProfile()

    if (profile.username_changed_at) {
        const lastChanged = new Date(profile.username_changed_at);
        const now = new Date();

        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

        if (now.getTime() - lastChanged.getTime() < thirtyDaysMs) {
            const nextChangeDate = new Date(
            lastChanged.getTime() + thirtyDaysMs,
            );

            return {
                error: `Username možeš ponovo promijeniti nakon ${nextChangeDate.toLocaleDateString("bs-BA")}.`,
            };
        }
    }

    const supabase = await createServerSupabaseClient()


    const {error} = await supabase
        .from("profiles")
        .update({
            username: new_username
        })
        .eq("id", user?.id);

    if(error){
        console.error(error?.message)
        return {error: "Greska na serveru ili username već postoji."}
    }

    return {success: "Uspješno ste promijenili username."}
    
}



export async function ChangeEmail(
  new_email: string,
  current_email: string,
) {
  if (new_email === current_email) {
    return {
      error: "Ovo je vaš trenutni email.",
    };
  }

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!EMAIL_REGEX.test(new_email)) {
    return {
      error: "Ovo nije pravilan email.",
    };
  }

  const { profile } =
    await getCurrentUserWithProfile();

  if (profile.email_changed_at) {
    const lastChanged = new Date(
      profile.email_changed_at,
    );

    const now = new Date();

    const thirtyDaysMs =
      30 * 24 * 60 * 60 * 1000;

    if (
      now.getTime() -
        lastChanged.getTime() <
      thirtyDaysMs
    ) {
      const nextChangeDate = new Date(
        lastChanged.getTime() +
          thirtyDaysMs,
      );

      return {
        error: `Email možeš ponovo promijeniti nakon ${nextChangeDate.toLocaleDateString(
          "bs-BA",
        )}.`,
      };
    }
  }

  const supabase =
    await createServerSupabaseClient();

  const { error } =
    await supabase.auth.updateUser({
      email: new_email,
    });

  if (error) {
    console.error("CHANGE EMAIL ERROR:", error);

    return {
      error: "Greška na serveru.",
    };
  }

  return {
    success:
      "Zahtjev za promjenu emaila je uspješno poslan.",
  };
}


export async function ChangePassword(
  old_password: string,
  new_password: string,
  confirmed_password: string,
) {
  if (
    !old_password ||
    !new_password ||
    !confirmed_password
  ) {
    return {
      error: "Sva polja su obavezna.",
    };
  }

  // Stara i nova lozinka ne smiju biti iste
  if (old_password === new_password) {
    return {
      error:
        "Nova lozinka mora biti drugačija od trenutne lozinke.",
    };
  }

  // Provjeri confirmation
  if (new_password !== confirmed_password) {
    return {
      error:
        "Nova lozinka i potvrda lozinke se ne podudaraju.",
    };
  }

  // Minimalni zahtjevi
  const PASSWORD_REGEX =
    /^(?=.*\d)(?=.*[A-Z]).{8,}$/;

  if (!PASSWORD_REGEX.test(new_password)) {
    return {
      error:
        "Lozinka mora imati najmanje 8 karaktera, bar jedno veliko slovo i bar jedan broj.",
    };
  }

  const { profile } = await getCurrentUserWithProfile();

  // 30 dana cooldown
    if (profile.password_changed_at) {
        const lastChanged = new Date(
        profile.password_changed_at,
        );

        const now = new Date();

        const thirtyDaysMs =
        30 * 24 * 60 * 60 * 1000;

        if (
        now.getTime() -
        lastChanged.getTime() <
        thirtyDaysMs
        ) {
        const nextChangeDate = new Date(
        lastChanged.getTime() +
            thirtyDaysMs,
        );

        return {
            error: `Lozinku možeš ponovo promijeniti nakon ${nextChangeDate.toLocaleDateString(
            "bs-BA",
            )}`,
        };
        }
    }

  const supabase = await createServerSupabaseClient();

  const { error } =
    await supabase.auth.updateUser({
      password: new_password,
      current_password: old_password,
    });

  if (error) {
    console.error("CHANGE PASSWORD ERROR:", {
        code: error.code,
        message: error.message,
        status: error.status,
    });

    if (error.code === "current_password_invalid") {
        return {
        error: "Trenutna lozinka nije ispravna.",
        };
    }

    if (error.code === "current_password_required") {
        return {
        error: "Moraš unijeti trenutnu lozinku.",
        };
    }

    if (error.code === "same_password") {
        return {
        error:
            "Nova lozinka mora biti drugačija od trenutne.",
        };
    }

    if (error.code === "weak_password") {
        return {
        error: "Nova lozinka nije dovoljno jaka.",
        };
    }

    return {
        error:
        "Došlo je do greške pri promjeni lozinke.",
    };
    }

  return {
    success:
      "Lozinka je uspješno promijenjena.",
  };
}