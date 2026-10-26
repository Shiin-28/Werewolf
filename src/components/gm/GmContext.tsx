"use client";

import { createContext, useContext } from "react";

/** Lets deep GM components nudge every device to refetch (needed after kicks, which realtime can't deliver). */
export const GmContext = createContext<{ broadcastRefresh: () => void }>({ broadcastRefresh: () => {} });

export const useGm = () => useContext(GmContext);
