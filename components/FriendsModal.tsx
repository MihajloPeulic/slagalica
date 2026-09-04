"use client";

import { useEffect, useState } from "react";
import { UserPlus, Loader2, Swords, X, ChevronRight, Trophy, UserRound } from "lucide-react";
import { AddAFriend } from "@/actions/friends";
import { getFriends } from "@/data/friends"; 
import { useRouter } from "next/navigation";
import { createGameRoom } from "@/actions/game";
import { useOnlinePresence } from "./OnlineUserContext";

export default function FriendsModal() {
    const router = useRouter();

    const {
        isUserOnline,
        presenceReady,
    } = useOnlinePresence();

    // 1. Tabovi i pretraga
    const [activeTab, setActiveTab] = useState<"friends" | "add">("friends");
    const [searchQuery, setSearchQuery] = useState("");

    // 2. Stanja za dodavanje prijatelja
    const [errorMessage, setErrorMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");

    // 3. Stanja za listu prijatelja
    const [friends, setFriends] = useState<{id: string, username: string, experience: number}[]>([]);
    const [isLoadingFriends, setIsLoadingFriends] = useState(true);

    // 4. Stanja za pozivanje u igru (Invite)
    const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
    const [isInviting, setIsInviting] = useState(false);

    useEffect(() => {
        const fetchFriendsData = async () => {
            setIsLoadingFriends(true);
            try {
                const data = await getFriends(); 
                setFriends(data || []);
            } catch (err) {
                console.error("Greška pri učitavanju prijatelja:", err);
            } finally {
                setIsLoadingFriends(false);
            }
        };

        fetchFriendsData();
    }, []);

    async function handleAdd(){
        setLoading(true);
        setErrorMessage("");
        setSuccessMessage(""); 

        const res = await AddAFriend(searchQuery);

        if(res?.error){
            setErrorMessage(res.error);
            setLoading(false);
            return;
        }

        if(res?.success){
            setSuccessMessage(res.success);
            setSearchQuery(""); 
            setLoading(false);
            return;
        }

        setLoading(false);
    }

    // Funkcija koja se poziva klikom na "Izazovi"
    async function handleInvite(friendId: string) {
        setIsInviting(true);
        try {
            // Ovde u akciju sada moramo poslati ID prijatelja kog izazivamo
            const res = await createGameRoom(friendId);
            
            if (res?.roomId) {
                router.push(`/igra/${res.roomId}`);
            } else {
                console.error("Greška pri kreiranju sobe:", res?.error);
            }
        } catch (error) {
            console.error("Neočekivana greška:", error);
        } finally {
            setIsInviting(false);
            setSelectedFriendId(null);
        }
    }


    function handleOpenProfile(friendId: string) {
        router.push(`/prijatelj/${friendId}`);
    }

    function getInitial(username: string) {
        return username?.trim()?.charAt(0)?.toUpperCase() || "?";
    }

    return (
        <div className="w-[340px] sm:w-[390px] overflow-hidden rounded-3xl border border-border/70 bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.55)] animate-modal-in flex flex-col z-50">
            <div className="px-4 pt-4 pb-3 border-b border-border/60 bg-gradient-to-b from-surface-light/60 to-transparent">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                            Social
                        </p>
                        <h2 className="text-base font-black text-text">
                            Prijatelji
                        </h2>
                    </div>

                    {activeTab === "friends" && (
                        <div className="flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-2.5 py-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <span className="text-[10px] font-bold text-text-secondary">
                                {friends.filter(friend => presenceReady && isUserOnline(friend.id)).length} online
                            </span>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-1 rounded-xl border border-border/60 bg-background/60 p-1">
                    <button
                        type="button"
                        onClick={() => {
                            setActiveTab("friends");
                            setSelectedFriendId(null);
                        }}
                        className={`h-8 rounded-lg text-[11px] font-black uppercase tracking-wide transition-all ${
                            activeTab === "friends"
                                ? "bg-surface-light text-text shadow-sm"
                                : "text-text-secondary hover:text-text"
                        }`}
                    >
                        Prijatelji
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setActiveTab("add");
                            setErrorMessage("");
                            setSuccessMessage("");
                            setSelectedFriendId(null);
                        }}
                        className={`h-8 rounded-lg text-[11px] font-black uppercase tracking-wide transition-all ${
                            activeTab === "add"
                                ? "bg-surface-light text-text shadow-sm"
                                : "text-text-secondary hover:text-text"
                        }`}
                    >
                        Dodaj
                    </button>
                </div>
            </div>

            <div className="flex max-h-[420px] min-h-[190px] flex-col overflow-y-auto custom-scrollbar p-3">
                {activeTab === "friends" && (
                    <>
                        {isLoadingFriends ? (
                            <div className="flex min-h-[180px] items-center justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-primary/60" />
                            </div>
                        ) : friends.length > 0 ? (
                            <div className="flex flex-col gap-2">
                                {friends.map((friend, index) => {
                                    const selected = selectedFriendId === friend.id;
                                    const online = presenceReady && isUserOnline(friend.id);

                                    return (
                                        <div
                                            key={friend.id || friend.username || index}
                                            className={`overflow-hidden rounded-2xl border transition-all ${
                                                selected
                                                    ? "border-primary/35 bg-primary/[0.04] shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
                                                    : "border-border/60 bg-background/35 hover:border-border hover:bg-surface-light/40"
                                            }`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedFriendId(
                                                        selected ? null : friend.id
                                                    );
                                                }}
                                                className="group flex w-full items-center gap-3 p-3 text-left"
                                            >
                                                <div className="relative shrink-0">
                                                    <div
                                                        className={`cursor-pointer flex h-11 w-11 items-center justify-center rounded-xl border text-base font-black transition-all ${
                                                            selected
                                                                ? "border-primary/40 bg-primary/15 text-primary"
                                                                : "border-border bg-surface-light text-text group-hover:border-primary/25 group-hover:text-primary"
                                                        }`}
                                                    >
                                                        {getInitial(friend.username)}
                                                    </div>

                                                    <span
                                                        className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-[3px] border-surface ${
                                                            online
                                                                ? "bg-emerald-500"
                                                                : "bg-zinc-600"
                                                        }`}
                                                    />
                                                </div>

                                                <div className="cursor-pointer min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="truncate text-sm font-black text-text">
                                                            {friend.username}
                                                        </span>

                                                        {online && (
                                                            <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-emerald-500">
                                                                Online
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="mt-1 flex items-center gap-2">
                                                        <div className="flex items-center gap-1 text-text-secondary">
                                                            <Trophy className="h-3 w-3" />
                                                            <span className="text-[10px] font-bold">
                                                                {friend.experience} XP
                                                            </span>
                                                        </div>

                                                        <span className="text-text-secondary/30">•</span>

                                                        <span
                                                            className={`text-[10px] font-semibold ${
                                                                !presenceReady
                                                                    ? "text-text-secondary"
                                                                    : online
                                                                    ? "text-emerald-500"
                                                                    : "text-text-secondary"
                                                            }`}
                                                        >
                                                            {!presenceReady
                                                                ? "Provjera..."
                                                                : online
                                                                ? "Dostupan"
                                                                : "Offline"}
                                                        </span>
                                                    </div>
                                                </div>

                                                <ChevronRight
                                                    className={`h-4 w-4 shrink-0 text-text-secondary transition-transform ${
                                                        selected
                                                            ? "rotate-90 text-primary"
                                                            : "group-hover:translate-x-0.5"
                                                    }`}
                                                />
                                            </button>

                                            {selected && (
                                                <div className="animate-in slide-in-from-top-1 fade-in duration-200 border-t border-border/50 bg-background/35 p-2.5">
                                                    <div className="grid grid-cols-[1fr_1fr_40px] gap-2">
                                                        <button
                                                            type="button"
                                                            disabled={isInviting}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOpenProfile(friend.id);
                                                            }}
                                                            className="cursor-pointer flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-surface text-xs font-black text-text transition-all hover:border-primary/30 hover:bg-surface-light hover:text-primary active:scale-[0.98] disabled:opacity-60"
                                                        >
                                                            <UserRound className="h-4 w-4" />
                                                            Profil
                                                        </button>

                                                        <button
                                                            type="button"
                                                            disabled={isInviting}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleInvite(friend.id);
                                                            }}
                                                            className="cursor-pointer flex h-10 items-center justify-center gap-2 rounded-xl bg-primary text-xs font-black text-black transition-all hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
                                                            title="Izazovi u igru"
                                                        >
                                                            {isInviting ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Swords className="h-4 w-4" />
                                                            )}
                                                            {isInviting ? "Čekaj..." : "Izazovi"}
                                                        </button>

                                                        <button
                                                            type="button"
                                                            disabled={isInviting}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedFriendId(null);
                                                            }}
                                                            className="cursor-pointer flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-text-secondary transition-all hover:bg-surface-light hover:text-text active:scale-95 disabled:opacity-60"
                                                            aria-label="Zatvori akcije"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </div>

                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background/20 px-6 text-center">
                                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-surface-light text-text-secondary">
                                    <UserPlus className="h-5 w-5" />
                                </div>

                                <p className="text-sm font-black text-text">
                                    Lista je prazna
                                </p>

                                <p className="mt-1 text-[10px] leading-relaxed text-text-secondary">
                                    Dodaj prijatelje i izazovi ih direktno u partiju.
                                </p>
                            </div>
                        )}
                    </>
                )}

                {activeTab === "add" && (
                    <div className="flex flex-col gap-4 p-1">
                        <div className="rounded-2xl border border-border/60 bg-background/35 p-3">
                            <p className="text-xs font-black text-text">
                                Pronađi igrača
                            </p>

                            <p className="mt-1 text-[10px] leading-relaxed text-text-secondary">
                                Unesi tačno korisničko ime igrača kojeg želiš dodati.
                            </p>
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);

                                        if (errorMessage || successMessage) {
                                            setErrorMessage("");
                                            setSuccessMessage("");
                                        }
                                    }}
                                    placeholder="Korisničko ime..."
                                    className={`h-11 min-w-0 flex-1 rounded-xl border bg-background px-3 text-sm font-bold text-text outline-none transition-colors placeholder:text-text-secondary/50 ${
                                        errorMessage
                                            ? "border-red-500/50 focus:border-red-500"
                                            : successMessage
                                            ? "border-emerald-500/50 focus:border-emerald-500"
                                            : "border-border focus:border-primary"
                                    }`}
                                    disabled={loading}
                                />

                                <button
                                    type="button"
                                    disabled={!searchQuery.trim() || loading}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleAdd();
                                    }}
                                    className="cursor-pointer flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-black transition-all hover:brightness-105 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
                                >
                                    {loading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <UserPlus className="h-4 w-4" />
                                    )}
                                </button>
                            </div>

                            {errorMessage && (
                                <p className="animate-in fade-in slide-in-from-top-1 rounded-lg bg-red-500/10 px-2.5 py-2 text-[10px] font-bold text-red-500">
                                    {errorMessage}
                                </p>
                            )}

                            {successMessage && (
                                <p className="animate-in fade-in slide-in-from-top-1 rounded-lg bg-emerald-500/10 px-2.5 py-2 text-[10px] font-bold text-emerald-500">
                                    {successMessage}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
