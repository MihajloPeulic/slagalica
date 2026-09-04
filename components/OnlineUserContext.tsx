"use client";

import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import { createClientSupabaseClient } from "@/utils/supabase/client";

type PresencePayload = {
    user_id?: string;
    online_at?: string;
};

interface OnlinePresenceContextValue {
    onlineUserIds: Set<string>;
    isUserOnline: (userId: string) => boolean;
    presenceReady: boolean;
}

const OnlinePresenceContext =
    createContext<OnlinePresenceContextValue | null>(null);

export function OnlinePresenceProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    /*
     * BITNO:
     * Supabase client pravimo samo jednom.
     *
     * Bez useMemo-a bi se mogao napraviti novi client
     * pri svakom renderu providera.
     */
    const supabase = useMemo(
        () => createClientSupabaseClient(),
        []
    );

    const [onlineUserIds, setOnlineUserIds] =
        useState<Set<string>>(
            () => new Set()
        );

    const [presenceReady, setPresenceReady] =
        useState(false);

    useEffect(() => {
        let mounted = true;

        /*
         * Pratimo da li je channel stvarno stigao
         * do SUBSCRIBED prije nego što pokušamo untrack().
         */
        let isSubscribed = false;
        let isTracked = false;

        const channel = supabase.channel(
            "global-online-users",
            {
                config: {
                    presence: {},
                },
            }
        );

        function syncPresence() {
            const state =
                channel.presenceState<PresencePayload>();

            const ids = new Set<string>();

            Object.values(state).forEach(
                (presences) => {
                    presences.forEach(
                        (presence) => {
                            if (
                                presence.user_id
                            ) {
                                ids.add(
                                    presence.user_id
                                );
                            }
                        }
                    );
                }
            );

            if (!mounted) {
                return;
            }

            setOnlineUserIds(ids);
            setPresenceReady(true);
        }

        async function initializePresence() {
            const {
                data: { user },
                error,
            } =
                await supabase.auth.getUser();

            if (error) {
                console.error(
                    "Presence auth error:",
                    error
                );

                return;
            }

            if (!user || !mounted) {
                return;
            }

            channel
                .on(
                    "presence",
                    {
                        event: "sync",
                    },
                    syncPresence
                )
                .on(
                    "presence",
                    {
                        event: "join",
                    },
                    syncPresence
                )
                .on(
                    "presence",
                    {
                        event: "leave",
                    },
                    syncPresence
                )
                .subscribe(
                    async (status) => {
                        if (
                            status !==
                            "SUBSCRIBED"
                        ) {
                            return;
                        }

                        /*
                         * Moguće je da se komponenta unmountala
                         * dok smo čekali konekciju.
                         */
                        if (!mounted) {
                            return;
                        }

                        isSubscribed = true;

                        const result =
                            await channel.track({
                                user_id:
                                    user.id,

                                online_at:
                                    new Date().toISOString(),
                            });

                        /*
                         * track() se izvršio tek nakon SUBSCRIBED.
                         */
                        if (
                            result === "ok"
                        ) {
                            isTracked = true;
                        }

                        syncPresence();
                    }
                );
        }

        initializePresence();

        return () => {
            mounted = false;

            /*
             * NIKAKAV untrack prije joinovanja.
             */
            if (
                isSubscribed &&
                isTracked
            ) {
                channel.untrack();
            }

            /*
             * Ovo svakako uklanja channel iz Supabase clienta.
             */
            supabase.removeChannel(
                channel
            );
        };
    }, [supabase]);

    const value =
        useMemo<OnlinePresenceContextValue>(
            () => ({
                onlineUserIds,

                isUserOnline: (
                    userId: string
                ) => {
                    return onlineUserIds.has(
                        userId
                    );
                },

                presenceReady,
            }),
            [
                onlineUserIds,
                presenceReady,
            ]
        );

    return (
        <OnlinePresenceContext.Provider
            value={value}
        >
            {children}
        </OnlinePresenceContext.Provider>
    );
}

export function useOnlinePresence() {
    const context = useContext(
        OnlinePresenceContext
    );

    if (!context) {
        throw new Error(
            "useOnlinePresence mora biti korišten unutar OnlinePresenceProvider-a"
        );
    }

    return context;
}