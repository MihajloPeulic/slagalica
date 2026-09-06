"use client";

import {
  Camera,
  Loader2,
} from "lucide-react";

import {
  ChangeEvent,
  useRef,
  useState,
} from "react";

import { createClientSupabaseClient } from "@/utils/supabase/client";

interface Props {
  userId: string;
  username: string;
  avatarUrl?: string | null;
}

export function ProfileAvatar({
  userId,
  username,
  avatarUrl,
}: Props) {
  const [supabase] = useState(
    () => createClientSupabaseClient(),
  );

  const inputRef =
    useRef<HTMLInputElement>(null);

  const [image, setImage] =
    useState<string | null>(
      avatarUrl ?? null,
    );

  const [loading, setLoading] =
    useState(false);

  const initial =
    username
      .charAt(0)
      .toUpperCase() || "?";

  function openFilePicker() {
    if (loading) return;

    inputRef.current?.click();
  }

  async function handleImage(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    setLoading(true);

    try {
      const extension =
        file.name
          .split(".")
          .pop()
          ?.toLowerCase();

      if (!extension) {
        throw new Error(
          "Neispravan format slike.",
        );
      }

      const path =
        `${userId}/avatar.${extension}`;

      const {
        error: uploadError,
      } = await supabase.storage
        .from("avatars")
        .upload(
          path,
          file,
          {
            upsert: true,
            contentType: file.type,
          },
        );

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: publicData,
      } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);

      const avatarUrlWithCacheBust =
        `${publicData.publicUrl}?t=${Date.now()}`;

      const {
        error: profileError,
      } = await supabase
        .from("profiles")
        .update({
          avatar_url:
            avatarUrlWithCacheBust,
        })
        .eq("id", userId);

      if (profileError) {
        throw profileError;
      }

      setImage(
        avatarUrlWithCacheBust,
      );
    } catch (error) {
      console.error(
        "Greška pri promjeni avatara:",
        error,
      );
    } finally {
      setLoading(false);

      event.target.value = "";
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Promijeni profilnu sliku"
        onClick={openFilePicker}
        disabled={loading}
        className="
          group
          relative
          flex
          h-24
          w-24
          items-center
          justify-center
          overflow-hidden
          rounded-full
          border
          border-primary/30
          bg-primary/10
          transition-colors
          hover:border-primary/50
          disabled:cursor-not-allowed
        "
      >
        {image ? (
          <img
            src={image}
            alt={username}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-3xl font-black text-primary">
            {initial}
          </span>
        )}

        <div
          className={`
            absolute
            inset-0
            flex
            items-center
            justify-center
            bg-black/60
            transition-opacity
            ${
              loading
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100"
            }
          `}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          ) : (
            <Camera className="h-5 w-5 text-white" />
          )}
        </div>
      </button>

      <button
        type="button"
        aria-label="Odaberi profilnu sliku"
        onClick={openFilePicker}
        disabled={loading}
        className="
          absolute
          bottom-0
          right-0
          flex
          h-8
          w-8
          items-center
          justify-center
          rounded-full
          border-2
          border-surface
          bg-primary
          text-black
          transition-colors
          hover:bg-primary-hover
          active:scale-[0.98]
          disabled:cursor-not-allowed
          disabled:opacity-50
        "
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Camera className="h-3.5 w-3.5" />
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleImage}
        className="hidden"
      />
    </div>
  );
}
