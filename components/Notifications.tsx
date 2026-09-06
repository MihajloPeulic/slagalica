"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  Check,
  Loader2,
  X,
} from "lucide-react";

import {
  AcceptFriendRequest,
  RejectFriendRequest,
} from "@/actions/friends";

import {
  FriendRequest,
  getFriendRequests,
} from "@/data/friends";

import { IconButton } from "@/components/ui/IconButton";

export default function Notifications() {
  const [isOpen, setIsOpen] =
    useState(false);

  const [
    friendRequests,
    setFriendRequests,
  ] = useState<FriendRequest[]>([]);

  useEffect(() => {
    async function fetchFriendRequests() {
      const requests =
        await getFriendRequests();

      setFriendRequests(
        requests || [],
      );
    }

    fetchFriendRequests();
  }, []);

  const unreadCount =
    friendRequests.length;

  function formatDate(
    dateString: string,
  ) {
    return new Date(
      dateString,
    ).toLocaleDateString("sr-RS", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function removeRequest(
    requestId: number,
  ) {
    setFriendRequests((prev) =>
      prev.filter(
        (request) =>
          request.id !== requestId,
      ),
    );
  }

  return (
    <div className="relative z-50 flex items-center justify-center">
      <div className="relative">
        <IconButton
          type="button"
          label="Obavještenja"
          onClick={() =>
            setIsOpen(
              (prev) => !prev,
            )
          }
          className={`
            border-0
            bg-transparent
            ${
              isOpen
                ? "text-text"
                : unreadCount > 0
                  ? "text-primary"
                  : "text-text-secondary"
            }
          `}
        >
          <Bell className="h-5 w-5" />
        </IconButton>

        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-background bg-red-500 px-1 text-[10px] font-black text-white">
            {unreadCount > 9
              ? "9+"
              : unreadCount}
          </span>
        )}
      </div>

      {isOpen && (
        <>
          <button
            type="button"
            aria-label="Zatvori obavještenja"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() =>
              setIsOpen(false)
            }
          />

          <div
            className="
                card-base
                animate-modal-in
                fixed
                bottom-20
                left-1/2
                z-50
                flex
                w-[calc(100vw-2rem)]
                max-w-[340px]
                -translate-x-1/2
                flex-col
                overflow-hidden
                shadow-lg
            "
            >
            <header className="flex items-center justify-between border-b border-border p-4">
              <div>
                <p className="eyebrow">
                  Nalog
                </p>

                <h3 className="card-title mt-0.5">
                  Obavještenja
                </h3>
              </div>

              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary/10 px-2 text-[10px] font-black text-primary">
                {unreadCount}
              </span>
            </header>

            <div className="custom-scrollbar flex max-h-[300px] flex-col gap-2 overflow-y-auto p-2">
              {friendRequests.length >
              0 ? (
                friendRequests.map(
                  (request) => (
                    <FriendRequestItem
                      key={
                        request.id
                      }
                      req={request}
                      formatDate={
                        formatDate
                      }
                      onActionComplete={
                        removeRequest
                      }
                    />
                  ),
                )
              ) : (
                <NotificationsEmpty />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FriendRequestItem({
  req,
  formatDate,
  onActionComplete,
}: {
  req: FriendRequest;
  formatDate: (
    date: string,
  ) => string;
  onActionComplete: (
    id: number,
  ) => void;
}) {
  const [loading, setLoading] =
    useState(false);

  const [
    actionStatus,
    setActionStatus,
  ] = useState<
    "idle" | "accepted" | "declined"
  >("idle");

  async function handleAccept() {
    setLoading(true);

    try {
      const res =
        await AcceptFriendRequest(
          req.id,
        );

      if (res?.success) {
        setActionStatus(
          "accepted",
        );

        setTimeout(() => {
          onActionComplete(req.id);
        }, 1000);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDecline() {
    setLoading(true);

    try {
      const res =
        await RejectFriendRequest(
          req.id,
        );

      if (res?.success) {
        setActionStatus(
          "declined",
        );

        setTimeout(() => {
          onActionComplete(req.id);
        }, 1000);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-4 transition-colors hover:bg-surface-light/40">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs font-black text-text">
            {req.sender.username}
          </span>

          <span className="shrink-0 text-[10px] font-bold text-primary">
            {
              req.sender
                .experience
            }{" "}
            XP
          </span>
        </div>

        <p className="secondary-text mt-1">
          {formatDate(
            req.created_at,
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {loading ? (
          <div className="flex h-8 w-16 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        ) : actionStatus ===
          "accepted" ? (
          <span className="text-[10px] font-bold text-emerald-500">
            Prihvaćeno
          </span>
        ) : actionStatus ===
          "declined" ? (
          <span className="text-[10px] font-bold text-red-500">
            Odbijeno
          </span>
        ) : (
          <>
            <IconButton
              type="button"
              label="Prihvati zahtjev"
              onClick={handleAccept}
              className="
                h-8
                w-8
                border-emerald-500/20
                bg-emerald-500/10
                text-emerald-500
                hover:border-emerald-500/30
                hover:bg-emerald-500/20
                hover:text-emerald-500
              "
            >
              <Check className="h-3.5 w-3.5" />
            </IconButton>

            <IconButton
              type="button"
              label="Odbij zahtjev"
              onClick={
                handleDecline
              }
              className="
                h-8
                w-8
                border-red-500/20
                bg-red-500/10
                text-red-500
                hover:border-red-500/30
                hover:bg-red-500/20
                hover:text-red-500
              "
            >
              <X className="h-3.5 w-3.5" />
            </IconButton>
          </>
        )}
      </div>
    </div>
  );
}

function NotificationsEmpty() {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center px-4 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-surface-light text-text-secondary">
        <Bell className="h-4 w-4" />
      </div>

      <p className="card-title">
        Nema obavještenja
      </p>

      <p className="secondary-text mt-1">
        Novi zahtjevi za prijateljstvo
        će se pojaviti ovdje.
      </p>
    </div>
  );
}