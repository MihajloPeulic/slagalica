"use client";

import {
    ChevronRight,
    X,
} from "lucide-react";


import {
    ReactNode,
    useState,
} from "react";

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
                onClick={() =>
                    setOpen(true)
                }
                className="group flex w-full items-center justify-between px-4 py-4 text-left transition-colors hover:bg-surface-light/50"
            >
                <div className="flex items-center gap-3">

                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        {icon}
                    </div>

                    <div>

                        <div className="text-xs font-bold text-text-secondary">
                            {label}
                        </div>

                        <div className="mt-0.5 max-w-[190px] truncate text-sm font-black">
                            {value}
                        </div>

                    </div>

                </div>

                <div className="flex items-center gap-2">

                    <span className="hidden text-[10px] font-bold text-text-secondary group-hover:block">
                        Promijeni
                    </span>

                    <ChevronRight className="h-4 w-4 text-text-secondary" />

                </div>

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



function EditProfileModal({
    type,
    currentValue,
    onClose,
}: {
    type: FieldType;
    currentValue: string;
    onClose: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">

            <div className="w-full max-w-sm rounded-3xl border border-border bg-surface p-5 shadow-2xl">

                <div className="flex items-center justify-between">

                    <h2 className="font-black">
                        Promijeni{" "}
                        {type === "username"
                            ? "username"
                            : type === "email"
                              ? "email"
                              : "password"}
                    </h2>

                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-light"
                    >
                        <X className="h-4 w-4" />
                    </button>

                </div>

                <input
                    defaultValue={
                        type ===
                        "password"
                            ? ""
                            : currentValue
                    }
                    type={
                        type ===
                        "password"
                            ? "password"
                            : type ===
                                "email"
                              ? "email"
                              : "text"
                    }
                    placeholder={
                        type ===
                        "password"
                            ? "Nova lozinka"
                            : undefined
                    }
                    className="mt-5 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm font-semibold outline-none focus:border-primary"
                />

                <button className="mt-4 h-11 w-full rounded-xl bg-primary text-sm font-black text-black">
                    Sačuvaj promjene
                </button>

            </div>

        </div>
    );
}