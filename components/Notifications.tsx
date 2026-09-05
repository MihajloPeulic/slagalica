"use client";

import { useState, useEffect } from "react";
import { Bell, Check, X, Loader2 } from "lucide-react";
import { getFriendRequests, FriendRequest } from "@/data/friends";
import { AcceptFriendRequest, RejectFriendRequest } from "@/actions/friends";

export default function Notifications() {
    const [isOpen, setIsOpen] = useState(false);
    const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);

    useEffect(() => {
        const getFriendReq = async () => {
            const friendReq = await getFriendRequests();
            setFriendRequests(friendReq);
        }; 
        
        getFriendReq(); 
    }, []);

    const unreadCount = friendRequests.length; 

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("sr-RS", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    };

    return (
        <div className="relative flex items-center justify-center z-50">
            {/* Zvonce Dugme */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`cursor-pointer relative transition-colors ${
                    isOpen 
                        ? "text-text" 
                        : unreadCount > 0 
                            ? "text-primary hover:text-primary/80" 
                            : "text-text-secondary hover:text-text"
                }`}
            >
                <Bell className="h-6 w-6 stroke-[1.5]" />
                
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm border border-background">
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* Modal Popup */}
            {isOpen && (
                <>
                    <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setIsOpen(false)}
                    />

                    <div className="absolute bottom-full right-[-15%] translate-x-1/2 mb-4 w-[300px] sm:w-[340px] bg-surface border border-border p-3 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] animate-modal-in z-50 flex flex-col">
                        
                        {/* Header Modala */}
                        <div className="flex items-center justify-between mb-2 border-b border-border/50 px-2 pb-2">
                            <h3 className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                                Obavještenja
                            </h3>
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                                {unreadCount}
                            </span>
                        </div>
                        
                        {/* Lista zahteva */}
                        <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto custom-scrollbar pt-1 pr-1">
                            {friendRequests.length > 0 ? (
                                friendRequests.map((req) => (
                                    <FriendRequestItem 
                                        key={req.id} 
                                        req={req} 
                                        formatDate={formatDate}
                                        onActionComplete={(reqId) => {
                                            // Kada se akcija završi, uklanjamo taj zahtev iz liste da se ne prikazuje više
                                            setFriendRequests(prev => prev.filter(item => item.id !== reqId));
                                        }}
                                    />
                                ))
                            ) : (
                                <div className="py-8 text-center text-xs font-medium text-text-secondary">
                                    Trenutno nema obavještenja.
                                </div>
                            )}
                        </div>

                    </div>
                </>
            )}
        </div>
    );
}

// ==========================================
// POMÓDNA KOMPONENTA ZA JEDAN ZAHTEV
// ==========================================
function FriendRequestItem({ req, formatDate, onActionComplete }: { req: FriendRequest; formatDate: (d: string) => string; onActionComplete: (id: number) => void }) {
    const [loading, setLoading] = useState(false);
    const [actionStatus, setActionStatus] = useState<"idle" | "accepted" | "declined">("idle");

    const handleAccept = async () => {
        setLoading(true);
        const res = await AcceptFriendRequest(req.id);
        setLoading(false);

        if (res?.success) {
            setActionStatus("accepted");
            setTimeout(() => {
                onActionComplete(req.id); // Uklanja iz liste nakon kratke poruke uspeha
            }, 1000);
        }
    };

    const handleDecline = async () => {
        setLoading(true);
        const res = await RejectFriendRequest(req.id);
        setLoading(false);
        if (res?.success) {
            setActionStatus("declined");
            setTimeout(() => {
                onActionComplete(req.id); // Uklanja iz liste nakon kratke poruke uspeha
            }, 1000);
        }
    }
    return (
        <div className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-surface-light/40 hover:bg-surface-light transition-colors gap-2">
            
            {/* LEVA STRANA: Uvek ista (Korisničko ime, XP i Datum) */}
            <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 truncate">
                    <span className="font-semibold text-text text-xs truncate">
                        {req.sender.username}
                    </span>
                    <span className="text-[10px] font-bold text-primary shrink-0">
                        ({req.sender.experience} XP)
                    </span>
                </div>
                <span className="text-[10px] font-medium text-text-secondary mt-0.5">
                    {formatDate(req.created_at)}
                </span>
            </div>
            
            {/* DESNA STRANA: Prikazuje loader, poruku o uspehu/neuspjehu ili dugmad */}
            <div className="flex items-center gap-1.5 shrink-0">
                {loading ? (
                    <div className="flex h-7 w-14 items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </div>
                ) : actionStatus === "accepted" ? (
                    <span className="text-[11px] font-bold text-green-500 animate-in fade-in px-1">
                        Prihvaćeno!
                    </span>
                ) : actionStatus === "declined" ? (
                    <span className="text-[11px] font-bold text-red-500 animate-in fade-in px-1">
                        Odbijeno.
                    </span>
                ) : (
                    <>
                        <button 
                            onClick={handleAccept}
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500 hover:text-white transition-all cursor-pointer"
                            title="Prihvati"
                        >
                            <Check className="h-4 w-4 stroke-[2.5]" />
                        </button>

                        <button 
                            onClick={handleDecline}
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all cursor-pointer"
                            title="Odbij"
                        >
                            <X className="h-4 w-4 stroke-[2.5]" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}