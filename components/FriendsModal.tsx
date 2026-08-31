"use client";

import { useEffect, useState } from "react";
import { User, UserPlus, Loader2, Swords, X } from "lucide-react";
import { AddAFriend } from "@/actions/friends";
import { getFriends } from "@/data/friends"; 
import { useRouter } from "next/navigation";
import { createGameRoom } from "@/actions/game"; // Pretpostavljam putanju do tvoje akcije

export default function FriendsModal(username: string) {
    const router = useRouter();

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

    return (
        <div className="w-[280px] sm:w-[320px] bg-surface border border-border p-3 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] animate-modal-in flex flex-col z-50">
            
            {/* Header sa Tabovima */}
            <div className="flex items-center gap-4 mb-2 border-b border-border/50 px-2">
                <button
                    onClick={() => {
                        setActiveTab("friends");
                        setSelectedFriendId(null); // Resetuj selekciju pri promeni taba
                    }}
                    className={`text-[11px] font-bold uppercase tracking-wider pb-2 border-b-2 transition-colors -mb-[1px]
                        ${activeTab === "friends" ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text"}
                    `}
                >
                    Tvoji prijatelji
                </button>
                <button
                    onClick={() => {
                        setActiveTab("add");
                        setErrorMessage("");
                        setSuccessMessage("");
                        setSelectedFriendId(null);
                    }}
                    className={`text-[11px] font-bold uppercase tracking-wider pb-2 border-b-2 transition-colors -mb-[1px]
                        ${activeTab === "add" ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text"}
                    `}
                >
                    Dodaj prijatelja
                </button>
            </div>
            
            {/* Scrollable sadržaj */}
            <div className="flex flex-col gap-1 max-h-[300px] min-h-[150px] overflow-y-auto custom-scrollbar pr-1 pt-1">
                
                {/* TAB: TVOJI PRIJATELJI */}
                {activeTab === "friends" && (
                    <>
                        {isLoadingFriends ? (
                            <div className="flex h-[100px] items-center justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
                            </div>
                        ) : friends.length > 0 ? (
                            friends.map((friend, index) => (
                                <div 
                                    key={friend.id || friend.username || index} 
                                    className="group flex flex-col justify-center min-h-[52px] p-2 rounded-xl border border-transparent hover:border-border hover:bg-surface-light transition-all cursor-pointer"
                                    onClick={() => {
                                        // Ako nije već selektovan, selektuj ga
                                        if (selectedFriendId !== friend.id) {
                                            setSelectedFriendId(friend.id);
                                        }
                                    }}
                                >
                                    {selectedFriendId === friend.id ? (
                                        // PRIKAZ: DUGMIĆI ZA INVITE (Kada se klikne na prijatelja)
                                        <div className="flex items-center justify-between gap-2 w-full animate-in fade-in zoom-in-95 duration-200">
                                            <button
                                                disabled={isInviting}
                                                onClick={(e) => { 
                                                    e.stopPropagation(); // Sprečava da se zatvori zbog onClick-a parent diva
                                                    handleInvite(friend.id); 
                                                }}
                                                className="flex-1 flex items-center justify-center gap-2 bg-primary text-black text-xs font-bold h-9 rounded-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70"
                                            >
                                                {isInviting ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Swords className="h-4 w-4" />
                                                )}
                                                {isInviting ? "Povezivanje..." : "Izazovi"}
                                            </button>
                                            
                                            <button
                                                disabled={isInviting}
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    setSelectedFriendId(null); 
                                                }}
                                                className="flex items-center justify-center h-9 w-9 bg-surface border border-border text-text-secondary hover:text-text hover:bg-surface-light rounded-lg transition-colors"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        // PRIKAZ: NORMALNE INFORMACIJE (Ime, slika, XP)
                                        <div className="flex items-center justify-between w-full animate-in fade-in duration-200">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-black transition-colors">
                                                    <User className="h-4 w-4" />
                                                </div>
                                                <span className="font-semibold text-text text-sm">{friend.username}</span>
                                            </div>
                                            
                                            <div className="text-right">
                                                <span className="text-sm font-bold text-text">{friend.experience}</span>
                                                <span className="text-[10px] font-medium text-text-secondary ml-1">XP</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="py-10 text-center text-xs font-medium text-text-secondary">
                                Još uvek nemaš dodatih prijatelja.
                            </div>
                        )}
                    </>
                )}

                {/* TAB: DODAJ PRIJATELJA */}
                {activeTab === "add" && (
                    <div className="flex flex-col gap-3 p-2">
                        {/* ... tvoj netaknuti kod za dodavanje prijatelja ... */}
                        <p className="text-[11px] text-text-secondary leading-relaxed">
                            Unesi korisničko ime prijatelja kako bi mu poslao zahtev.
                        </p>
                        
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
                                    className={`flex-1 bg-background border rounded-xl px-3 py-2 text-sm font-medium text-text focus:outline-none focus:border-primary transition-colors
                                        ${errorMessage ? 'border-red-500/50' : successMessage ? 'border-green-500/50' : 'border-border'}
                                    `}
                                    disabled={loading}
                                />
                                <button 
                                    disabled={!searchQuery.trim() || loading}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleAdd();
                                    }}
                                    className="flex h-9 w-10 shrink-0 items-center justify-center bg-primary text-black rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
                                >
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                                </button>
                            </div>

                            {errorMessage && (
                                <p className="text-[11px] font-medium text-red-500 pl-1 animate-in fade-in slide-in-from-top-1">
                                    {errorMessage}
                                </p>
                            )}
                            {successMessage && (
                                <p className="text-[11px] font-medium text-green-500 pl-1 animate-in fade-in slide-in-from-top-1">
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