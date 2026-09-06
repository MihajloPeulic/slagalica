"use client";

import { useEffect, useState } from "react";
import {
  ChevronRight,
  Loader2,
  Swords,
  Trophy,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { AddAFriend } from "@/actions/friends";
import { createGameRoom } from "@/actions/game";
import { getFriends } from "@/data/friends";

import { useOnlinePresence } from "./OnlineUserContext";

import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { FormMessage } from "@/components/ui/FormMessage";

type Friend = {
  id: string;
  username: string;
  experience: number;
};

type Tab = "friends" | "add";

export default function FriendsModal() {
  const router = useRouter();

  const {
    isUserOnline,
    presenceReady,
  } = useOnlinePresence();

  const [activeTab, setActiveTab] =
    useState<Tab>("friends");

  const [searchQuery, setSearchQuery] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [loading, setLoading] =
    useState(false);

  const [friends, setFriends] =
    useState<Friend[]>([]);

  const [
    isLoadingFriends,
    setIsLoadingFriends,
  ] = useState(true);

  const [
    selectedFriendId,
    setSelectedFriendId,
  ] = useState<string | null>(null);

  const [isInviting, setIsInviting] =
    useState(false);

  useEffect(() => {
    async function fetchFriendsData() {
      setIsLoadingFriends(true);

      try {
        const data = await getFriends();

        setFriends(data || []);
      } catch (error) {
        console.error(
          "Greška pri učitavanju prijatelja:",
          error,
        );
      } finally {
        setIsLoadingFriends(false);
      }
    }

    fetchFriendsData();
  }, []);

  async function handleAdd() {
    const username = searchQuery.trim();

    if (!username) return;

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    const res = await AddAFriend(username);

    if (res?.error) {
      setErrorMessage(res.error);
      setLoading(false);

      return;
    }

    if (res?.success) {
      setSuccessMessage(res.success);
      setSearchQuery("");
    }

    setLoading(false);
  }

  async function handleInvite(
    friendId: string,
  ) {
    setIsInviting(true);

    try {
      const res =
        await createGameRoom(friendId);

      if (res?.roomId) {
        router.push(
          `/igra/${res.roomId}`,
        );

        return;
      }

      console.error(
        "Greška pri kreiranju sobe:",
        res?.error,
      );
    } catch (error) {
      console.error(
        "Neočekivana greška:",
        error,
      );
    } finally {
      setIsInviting(false);
      setSelectedFriendId(null);
    }
  }

  function handleOpenProfile(
    friendId: string,
  ) {
    router.push(
      `/prijatelj/${friendId}`,
    );
  }

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    setSelectedFriendId(null);

    if (tab === "add") {
      setErrorMessage("");
      setSuccessMessage("");
    }
  }

  function getInitial(
    username: string,
  ) {
    return (
      username
        ?.trim()
        ?.charAt(0)
        ?.toUpperCase() || "?"
    );
  }

  const onlineCount = friends.filter(
    (friend) =>
      presenceReady &&
      isUserOnline(friend.id),
  ).length;

  return (
    <div className="card-base animate-modal-in flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden shadow-lg">
      {/* Header */}
      <header className="border-b border-border p-4">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">
              Social
            </p>

            <h2 className="section-title">
              Prijatelji
            </h2>
          </div>

          {activeTab === "friends" && (
            <OnlineCounter
              count={onlineCount}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-background p-1">
          <TabButton
            active={
              activeTab === "friends"
            }
            onClick={() =>
              handleTabChange("friends")
            }
          >
            Prijatelji
          </TabButton>

          <TabButton
            active={activeTab === "add"}
            onClick={() =>
              handleTabChange("add")
            }
          >
            Dodaj
          </TabButton>
        </div>
      </header>

      {/* Content */}
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        {activeTab === "friends" ? (
          <FriendsTab
            friends={friends}
            loading={isLoadingFriends}
            selectedFriendId={
              selectedFriendId
            }
            isInviting={isInviting}
            presenceReady={
              presenceReady
            }
            isUserOnline={
              isUserOnline
            }
            getInitial={getInitial}
            onSelectFriend={
              setSelectedFriendId
            }
            onOpenProfile={
              handleOpenProfile
            }
            onInvite={handleInvite}
          />
        ) : (
          <AddFriendTab
            searchQuery={searchQuery}
            loading={loading}
            errorMessage={errorMessage}
            successMessage={
              successMessage
            }
            onSearchChange={(value) => {
              setSearchQuery(value);

              if (
                errorMessage ||
                successMessage
              ) {
                setErrorMessage("");
                setSuccessMessage("");
              }
            }}
            onAdd={handleAdd}
          />
        )}
      </div>
    </div>
  );
}

/* =========================================
   TABS
   ========================================= */

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        h-9
        rounded-lg
        text-xs
        font-black
        transition-colors
        ${
          active
            ? "bg-surface-light text-text"
            : "text-text-secondary hover:text-text"
        }
      `}
    >
      {children}
    </button>
  );
}

/* =========================================
   ONLINE COUNTER
   ========================================= */

function OnlineCounter({
  count,
}: {
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-background px-2.5 py-1">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

      <span className="text-[10px] font-bold text-text-secondary">
        {count} online
      </span>
    </div>
  );
}

/* =========================================
   FRIENDS TAB
   ========================================= */

function FriendsTab({
  friends,
  loading,
  selectedFriendId,
  isInviting,
  presenceReady,
  isUserOnline,
  getInitial,
  onSelectFriend,
  onOpenProfile,
  onInvite,
}: {
  friends: Friend[];
  loading: boolean;
  selectedFriendId: string | null;
  isInviting: boolean;
  presenceReady: boolean;
  isUserOnline: (
    id: string,
  ) => boolean;
  getInitial: (
    username: string,
  ) => string;
  onSelectFriend: (
    id: string | null,
  ) => void;
  onOpenProfile: (
    id: string,
  ) => void;
  onInvite: (
    id: string,
  ) => void;
}) {
  if (loading) {
    return (
      <div className="flex min-h-48 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (friends.length === 0) {
    return <EmptyFriends />;
  }

  return (
    <div className="flex flex-col gap-2">
      {friends.map((friend) => {
        const selected =
          selectedFriendId ===
          friend.id;

        const online =
          presenceReady &&
          isUserOnline(friend.id);

        return (
          <FriendRow
            key={friend.id}
            friend={friend}
            selected={selected}
            online={online}
            presenceReady={
              presenceReady
            }
            isInviting={
              isInviting
            }
            initial={getInitial(
              friend.username,
            )}
            onToggle={() =>
              onSelectFriend(
                selected
                  ? null
                  : friend.id,
              )
            }
            onClose={() =>
              onSelectFriend(null)
            }
            onOpenProfile={() =>
              onOpenProfile(friend.id)
            }
            onInvite={() =>
              onInvite(friend.id)
            }
          />
        );
      })}
    </div>
  );
}

/* =========================================
   FRIEND ROW
   ========================================= */

function FriendRow({
  friend,
  selected,
  online,
  presenceReady,
  isInviting,
  initial,
  onToggle,
  onClose,
  onOpenProfile,
  onInvite,
}: {
  friend: Friend;
  selected: boolean;
  online: boolean;
  presenceReady: boolean;
  isInviting: boolean;
  initial: string;
  onToggle: () => void;
  onClose: () => void;
  onOpenProfile: () => void;
  onInvite: () => void;
}) {
  return (
    <div
      className={`
        overflow-hidden
        rounded-2xl
        border
        transition-colors
        ${
          selected
            ? "border-primary/40 bg-primary/5"
            : "border-border bg-background hover:bg-surface-light/40"
        }
      `}
    >
      <button
        type="button"
        onClick={onToggle}
        className="group flex w-full items-center gap-3 p-3 text-left"
      >
        <FriendAvatar
          initial={initial}
          online={online}
          selected={selected}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-black text-text">
              {friend.username}
            </span>

            {online && (
              <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-black text-emerald-500">
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

            <span className="text-text-muted">
              •
            </span>

            <span
              className={`text-[10px] font-semibold ${
                online
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
          className={`
            h-4
            w-4
            shrink-0
            transition-transform
            ${
              selected
                ? "rotate-90 text-primary"
                : "text-text-secondary"
            }
          `}
        />
      </button>

      {selected && (
        <FriendActions
          loading={isInviting}
          onOpenProfile={
            onOpenProfile
          }
          onInvite={onInvite}
          onClose={onClose}
        />
      )}
    </div>
  );
}

/* =========================================
   FRIEND AVATAR
   ========================================= */

function FriendAvatar({
  initial,
  online,
  selected,
}: {
  initial: string;
  online: boolean;
  selected: boolean;
}) {
  return (
    <div className="relative shrink-0">
      <div
        className={`
          flex
          h-10
          w-10
          items-center
          justify-center
          rounded-xl
          border
          text-sm
          font-black
          ${
            selected
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border bg-surface-light text-text"
          }
        `}
      >
        {initial}
      </div>

      <span
        className={`
          absolute
          -bottom-1
          -right-1
          h-3
          w-3
          rounded-full
          border-2
          border-surface
          ${
            online
              ? "bg-emerald-500"
              : "bg-text-muted"
          }
        `}
      />
    </div>
  );
}

/* =========================================
   FRIEND ACTIONS
   ========================================= */

function FriendActions({
  loading,
  onOpenProfile,
  onInvite,
  onClose,
}: {
  loading: boolean;
  onOpenProfile: () => void;
  onInvite: () => void;
  onClose: () => void;
}) {
  return (
    <div className="border-t border-border bg-background p-2">
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={loading}
          onClick={onOpenProfile}
        >
          <UserRound className="h-4 w-4" />
          Profil
        </Button>

        <Button
          type="button"
          size="sm"
          disabled={loading}
          onClick={onInvite}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Swords className="h-4 w-4" />
          )}

          {loading
            ? "Čekaj..."
            : "Izazovi"}
        </Button>

        <IconButton
          type="button"
          label="Zatvori akcije"
          disabled={loading}
          onClick={onClose}
          className="h-9 w-9"
        >
          <X className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  );
}

/* =========================================
   EMPTY STATE
   ========================================= */

function EmptyFriends() {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-surface-light text-text-secondary">
        <UserPlus className="h-4 w-4" />
      </div>

      <p className="card-title">
        Lista je prazna
      </p>

      <p className="secondary-text mt-1 max-w-52 leading-relaxed">
        Dodaj prijatelje i izazovi ih
        direktno u partiju.
      </p>
    </div>
  );
}

/* =========================================
   ADD FRIEND TAB
   ========================================= */

function AddFriendTab({
  searchQuery,
  loading,
  errorMessage,
  successMessage,
  onSearchChange,
  onAdd,
}: {
  searchQuery: string;
  loading: boolean;
  errorMessage: string;
  successMessage: string;
  onSearchChange: (
    value: string,
  ) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="card-title">
          Pronađi igrača
        </h3>

        <p className="secondary-text mt-1 leading-relaxed">
          Unesi tačno korisničko ime
          igrača kojeg želiš dodati.
        </p>
      </div>

      <FormMessage
        error={
          errorMessage || undefined
        }
        success={
          successMessage || undefined
        }
      />

      <div className="flex gap-2">
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) =>
            onSearchChange(
              e.target.value,
            )
          }
          placeholder="Korisničko ime..."
          disabled={loading}
        />

        <Button
          type="button"
          size="md"
          disabled={
            !searchQuery.trim() ||
            loading
          }
          onClick={onAdd}
          aria-label="Dodaj prijatelja"
          className="w-11 shrink-0 px-0"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}