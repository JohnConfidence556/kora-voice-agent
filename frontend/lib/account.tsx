"use client";

import {
  createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  api, ApiError, CatalogItem, clearToken, getToken, Order, Profile, Transaction,
} from "@/lib/api";
import { useToast } from "@/lib/toast";

export type BuyRequest =
  | { kind: "data"; item_id: string }
  | { kind: "airtime"; amount: number };

type AccountState = {
  status: "loading" | "ready" | "offline";
  profile: Profile | null;
  transactions: Transaction[];
  pending: Order[];
  catalog: CatalogItem[];
  refresh: () => Promise<void>;
  retry: () => void;
  // The user pressed "Pay" in the review dialog: prepare the order, then confirm it.
  buy: (body: BuyRequest) => Promise<Order>;
  // Orders prepared by the AI assistant wait for the user here.
  confirmOrder: (id: string) => Promise<void>;
  cancelOrder: (id: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AccountContext = createContext<AccountState | null>(null);

// Raw state, used by the app shell (it also has to handle "loading" and "offline").
export function useAccountState(): AccountState {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccountState must be used inside <AccountProvider>");
  return ctx;
}

// For pages: the shell only renders a page once the profile has loaded, so it is never null here.
export type AccountReady = Omit<AccountState, "profile"> & { profile: Profile };
export function useAccount(): AccountReady {
  return useAccountState() as AccountReady;
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const toast = useToast();
  const [status, setStatus] = useState<AccountState["status"]>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pending, setPending] = useState<Order[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [p, t, o] = await Promise.all([
        api<Profile>("/me"),
        api<Transaction[]>("/transactions"),
        api<Order[]>("/orders/pending"),
      ]);
      setProfile(p);
      setTransactions(t);
      setPending(o);
      setStatus("ready");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      // If we already have data on screen, keep showing it instead of an error page
      setStatus((s) => (s === "ready" ? "ready" : "offline"));
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    refresh();
    api<CatalogItem[]>("/catalog").then(setCatalog).catch(() => {});

    // Poll so orders prepared by the assistant (chat or voice) appear without a reload
    const tick = () => {
      if (!document.hidden) refresh();
    };
    const id = setInterval(tick, 4000);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", tick);
    };
  }, [router, refresh]);

  const retry = useCallback(() => {
    setStatus("loading");
    refresh();
  }, [refresh]);

  const buy = useCallback(
    async (body: BuyRequest) => {
      const order = await api<Order>("/orders", { method: "POST", body: JSON.stringify(body) });
      await api(`/orders/${order.id}/confirm`, { method: "POST" });
      await refresh();
      return order;
    },
    [refresh]
  );

  const confirmOrder = useCallback(
    async (id: string) => {
      try {
        await api(`/orders/${id}/confirm`, { method: "POST" });
        toast("Purchase confirmed. Your balance is updated.", "success");
      } catch (e) {
        toast(e instanceof Error ? e.message : "Could not confirm this purchase.", "error");
      }
      await refresh();
    },
    [refresh, toast]
  );

  const cancelOrder = useCallback(
    async (id: string) => {
      await api(`/orders/${id}/cancel`, { method: "POST" }).catch(() => {});
      await refresh();
    },
    [refresh]
  );

  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    clearToken();
    router.push("/login");
  }, [router]);

  const value = useMemo(
    () => ({
      status, profile, transactions, pending, catalog,
      refresh, retry, buy, confirmOrder, cancelOrder, logout,
    }),
    [status, profile, transactions, pending, catalog, refresh, retry, buy, confirmOrder, cancelOrder, logout]
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}
