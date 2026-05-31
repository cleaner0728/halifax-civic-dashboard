"use client";

import { createContext, useContext, useState, useCallback } from "react";

type AccordionCtx = {
  openId: string | null;
  toggle: (id: string) => void;
};

const Ctx = createContext<AccordionCtx>({ openId: null, toggle: () => {} });

export function AccordionGroup({ children }: { children: React.ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const toggle = useCallback(
    (id: string) => setOpenId(prev => (prev === id ? null : id)),
    [],
  );
  return <Ctx.Provider value={{ openId, toggle }}>{children}</Ctx.Provider>;
}

export function useAccordion() {
  return useContext(Ctx);
}
