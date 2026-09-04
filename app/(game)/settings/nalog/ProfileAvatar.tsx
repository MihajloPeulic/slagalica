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
    const supabase =
        createClientSupabaseClient();

    const inputRef =
        useRef<HTMLInputElement>(null);

    const [image, setImage] =
        useState(avatarUrl);

    const [loading, setLoading] =
        useState(false);

    const initial =
        username
            ?.charAt(0)
            .toUpperCase() || "?";

    async function handleImage(
        e: ChangeEvent<HTMLInputElement>
    ) {
        const file =
            e.target.files?.[0];

        if (!file) return;

        setLoading(true);

        try {
            const extension =
                file.name
                    .split(".")
                    .pop();

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
                    }
                );

            if (uploadError) {
                throw uploadError;
            }

            const {
                data: publicData,
            } = supabase.storage
                .from("avatars")
                .getPublicUrl(path);

            const url =
                `${publicData.publicUrl}?t=${Date.now()}`;

            const {
                error: profileError,
            } = await supabase
                .from("profiles")
                .update({
                    avatar_url: url,
                })
                .eq(
                    "id",
                    userId
                );

            if (profileError) {
                throw profileError;
            }

            setImage(url);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    console.log(image)
    return (
        <div className="relative">

            <button
                onClick={() =>
                    inputRef.current?.click()
                }
                disabled={loading}
                className="group relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-2 border-primary/30 bg-primary/10 shadow-[0_0_35px_rgba(255,255,255,0.04)]"
            >
                {image !== "profile.avatar_url" ? (
                    <img
                        src={image as string}
                        alt={username}
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <span className="text-4xl font-black text-primary">
                        {initial}
                    </span>
                )}

                <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">

                    {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-white" />
                    ) : (
                        <Camera className="h-5 w-5 text-white" />
                    )}

                </div>

            </button>

            <button
                onClick={() =>
                    inputRef.current?.click()
                }
                className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full border-4 border-surface bg-primary text-black"
            >
                <Camera className="h-3.5 w-3.5" />
            </button>

            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={handleImage}
                className="hidden"
            />

        </div>
    );
}