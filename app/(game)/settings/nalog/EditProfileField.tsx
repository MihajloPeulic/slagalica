"use client";

import {
  ChevronRight,
  X,
} from "lucide-react";

import {
  ReactNode,
  useState,
} from "react";

import {
  ChangeEmail,
  ChangePassword,
  ChangeUsername,
} from "@/actions/profile";

import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { FormField } from "@/components/ui/FormField";
import { FormMessage } from "@/components/ui/FormMessage";
import { FormActions } from "@/components/ui/FormActions";

type FieldType =
  | "username"
  | "email"
  | "password";

interface Props {
  type: FieldType;
  label: string;
  value: string;
  icon: ReactNode;
}

export function EditProfileField({
  type,
  label,
  value,
  icon,
}: Props) {
  const [open, setOpen] =
    useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="
          group
          flex
          min-h-16
          w-full
          items-center
          justify-between
          gap-3
          px-4
          py-3
          text-left
          transition-colors
          hover:bg-surface-light
        "
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>

          <div className="min-w-0">
            <p className="secondary-text">
              {label}
            </p>

            <p className="card-title mt-0.5 truncate">
              {type === "password"
                ? "••••••••"
                : value}
            </p>
          </div>
        </div>

        <ChevronRight className="h-4 w-4 shrink-0 text-text-muted transition-colors group-hover:text-primary" />
      </button>

      {open && (
        <EditProfileModal
          type={type}
          currentValue={value}
          onClose={() =>
            setOpen(false)
          }
        />
      )}
    </>
  );
}

/* =========================================
   MODAL
   ========================================= */

function EditProfileModal({
  type,
  currentValue,
  onClose,
}: {
  type: FieldType;
  currentValue: string;
  onClose: () => void;
}) {
  const content =
    getModalContent(type);

  return (
    <div
      className="
        fixed
        inset-0
        z-[100]
        flex
        items-end
        justify-center
        bg-black/70
        p-4
        sm:items-center
      "
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
        className="
          card-base
          animate-modal-in
          w-full
          max-w-sm
          p-4
          shadow-lg
        "
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow">
              Postavke profila
            </p>

            <h2 className="section-title mt-1">
              {content.title}
            </h2>

            <p className="secondary-text mt-1.5 leading-relaxed">
              {content.description}
            </p>
          </div>

          <IconButton
            type="button"
            label="Zatvori"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="my-4 border-t border-border" />

        {renderEditForm({
          type,
          currentValue,
          onClose,
        })}
      </div>
    </div>
  );
}

/* =========================================
   FORMS
   ========================================= */

function renderEditForm({
  type,
  currentValue,
  onClose,
}: {
  type: FieldType;
  currentValue: string;
  onClose: () => void;
}) {
  switch (type) {
    case "username":
      return (
        <UsernameForm
          currentValue={
            currentValue
          }
          onClose={onClose}
        />
      );

    case "email":
      return (
        <EmailForm
          currentValue={
            currentValue
          }
          onClose={onClose}
        />
      );

    case "password":
      return (
        <PasswordForm
          onClose={onClose}
        />
      );
  }
}

/* =========================================
   USERNAME
   ========================================= */

function UsernameForm({
  currentValue,
  onClose,
}: {
  currentValue: string;
  onClose: () => void;
}) {
  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (loading) return;

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const formData =
        new FormData(
          event.currentTarget,
        );

      const newUsername =
        formData.get(
          "username",
        ) as string;

      const res =
        await ChangeUsername(
          newUsername,
          currentValue,
        );

      if (res?.error) {
        setError(res.error);
        return;
      }

      if (res?.success) {
        setSuccess(
          res.success,
        );
      }
    } catch {
      setError(
        "Došlo je do greške. Pokušaj ponovo.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <FormMessage
        error={error || undefined}
        success={
          success || undefined
        }
      />

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        <FormField label="Novi username">
          <Input
            name="username"
            type="text"
            required
            autoFocus
            autoComplete="username"
            disabled={loading}
            placeholder={
              currentValue
            }
          />
        </FormField>

        <FormActions
          onCancel={onClose}
          loading={loading}
        />
      </form>
    </>
  );
}

/* =========================================
   EMAIL
   ========================================= */

function EmailForm({
  currentValue,
  onClose,
}: {
  currentValue: string;
  onClose: () => void;
}) {
  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (loading) return;

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const formData =
        new FormData(
          event.currentTarget,
        );

      const newEmail =
        formData.get(
          "email",
        ) as string;

      const res =
        await ChangeEmail(
          newEmail,
          currentValue,
        );

      if (res?.error) {
        setError(res.error);
        return;
      }

      if (res?.success) {
        setSuccess(
          res.success,
        );
      }
    } catch {
      setError(
        "Došlo je do greške. Pokušaj ponovo.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <FormMessage
        error={error || undefined}
        success={
          success || undefined
        }
      />

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        <FormField label="Nova email adresa">
          <Input
            name="email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            disabled={loading}
            placeholder={
              currentValue
            }
          />
        </FormField>

        <FormActions
          onCancel={onClose}
          loading={loading}
        />
      </form>
    </>
  );
}

/* =========================================
   PASSWORD
   ========================================= */

function PasswordForm({
  onClose,
}: {
  onClose: () => void;
}) {
  const [
    oldPassword,
    setOldPassword,
  ] = useState("");

  const [
    newPassword,
    setNewPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (loading) return;

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res =
        await ChangePassword(
          oldPassword,
          newPassword,
          confirmPassword,
        );

      if (res?.error) {
        setError(res.error);
        return;
      }

      if (res?.success) {
        setSuccess(
          res.success,
        );

        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setError(
        "Došlo je do greške. Pokušaj ponovo.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <FormMessage
        error={error || undefined}
        success={
          success || undefined
        }
      />

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        <FormField label="Trenutna lozinka">
          <PasswordInput
            value={oldPassword}
            onChange={
              setOldPassword
            }
            autoComplete="current-password"
            placeholder="Unesi trenutnu lozinku"
          />
        </FormField>

        <FormField
          label="Nova lozinka"
          hint="Najmanje 8 karaktera, jedno veliko slovo i jedan broj."
        >
          <PasswordInput
            value={newPassword}
            onChange={
              setNewPassword
            }
            autoComplete="new-password"
            placeholder="Unesi novu lozinku"
          />
        </FormField>

        <FormField label="Potvrdi lozinku">
          <PasswordInput
            value={
              confirmPassword
            }
            onChange={
              setConfirmPassword
            }
            autoComplete="new-password"
            placeholder="Ponovi novu lozinku"
          />
        </FormField>

        <FormActions
          onCancel={onClose}
          loading={loading}
        />
      </form>
    </>
  );
}

/* =========================================
   CONTENT
   ========================================= */

function getModalContent(
  type: FieldType,
) {
  switch (type) {
    case "username":
      return {
        title:
          "Promijeni username",
        description:
          "Odaberi novi username koji će biti prikazan drugim igračima.",
      };

    case "email":
      return {
        title:
          "Promijeni email",
        description:
          "Unesi novu email adresu povezanu sa svojim nalogom.",
      };

    case "password":
      return {
        title:
          "Promijeni lozinku",
        description:
          "Potvrdi trenutnu lozinku, a zatim postavi novu.",
      };
  }
}