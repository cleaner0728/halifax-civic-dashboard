"use client";

import { createContext, useContext, useState, useCallback } from "react";

type AccordionCtx = {
  openId: string | null;
  toggle: (id: string) => void;
};

const Ctx = createContext<AccordionCtx>({ openId: null, toggle: () => {} });

export function AccordionGroup({
  children,
  defaultOpenId = null,
}: {
  children: React.ReactNode;
  // Initial expanded section. Lets the desktop board start with the Waste
  // Collection panel already open without affecting the mobile screen,
  // which uses the same component and defaults to all-closed.
  defaultOpenId?: string | null;
}) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId);
  const toggle = useCallback(
    (id: string) => setOpenId(prev => (prev === id ? null : id)),
    [],
  );
  return <Ctx.Provider value={{ openId, toggle }}>{children}</Ctx.Provider>;
}

export function useAccordion() {
  return useContext(Ctx);
}
