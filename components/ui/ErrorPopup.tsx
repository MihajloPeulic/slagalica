"use client";

import Link from "next/link";
import { ShieldAlert, X } from "lucide-react";

type ErrorPopupProps = {
    message: string | null;
    onClose: () => void;

    /*
        Generički optional action.
        Popup ne zna ništa o game roomovima.
    */
    action?: {
        href: string;
        label: string;
    };
};

export function ErrorPopup({ message, onClose, action }: ErrorPopupProps) {
    if (!message) return null;

    return (
        <div
            className="
                fixed inset-0 z-[200]
                flex items-center justify-center
                bg-black/60
                px-4
            "
            onClick={onClose}
        >
            <div
                role="alertdialog"
                aria-modal="true"
                aria-label="Greška"
                onClick={(e) => e.stopPropagation()}
                className="
                    relative
                    w-full max-w-[340px]
                    rounded-2xl
                    border border-red-500/20
                    bg-surface
                    px-6 py-7
                "
            >
                <button
                    type="button"
                    aria-label="Zatvori"
                    onClick={onClose}
                    className="
                        absolute
                        right-3 top-3
                        flex h-8 w-8
                        cursor-pointer
                        items-center justify-center
                        rounded-lg
                        text-text-secondary
                        transition-colors
                        hover:bg-surface-light
                        hover:text-text
                    "
                >
                    <X className="h-4 w-4" />
                </button>

                <div className="flex flex-col items-center gap-4 text-center">
                    <ShieldAlert className="h-10 w-10 text-red-500" strokeWidth={1.8} />

                    <p className="max-w-[260px] text-sm font-medium leading-6 text-text">{message}</p>

                    {action && (
                        <Link
                            href={action.href}
                            className="
                                mt-1
                                inline-flex
                                h-9
                                items-center
                                justify-center
                                rounded-xl
                                bg-primary
                                px-4
                                text-xs
                                font-black
                                text-background
                                transition-colors
                                hover:bg-primary-hover
                            "
                        >
                            {action.label}
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
