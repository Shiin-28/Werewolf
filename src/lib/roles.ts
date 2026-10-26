import { Drama, Eye, Ghost, Shield, User } from "lucide-react";
import { WolfPaw } from "@/components/icons/WolfPaw";
import type { RoleId, Team } from "./types";

export interface RoleInfo {
  id: RoleId;
  name: string;
  ja: string;
  team: Team;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  /** Solid card background + foreground. */
  card: string;
  /** Soft chip style for lists. */
  chip: string;
  description: string;
  win: string;
  max?: number;
}

export const ROLE_ORDER: RoleId[] = ["villager", "fortune_teller", "shaman", "knight", "werewolf", "madman"];

export const ROLES: Record<RoleId, RoleInfo> = {
  villager: {
    id: "villager", name: "Villager", ja: "村人", team: "village", icon: User,
    card: "bg-linear-to-br from-stone-600 to-stone-900 text-stone-100", chip: "bg-stone-500/25 text-fg",
    description: "No night power. Use your voice: find the wolves and vote them out.",
    win: "Win when every Werewolf is dead.",
  },
  fortune_teller: {
    id: "fortune_teller", name: "Fortune Teller", ja: "占い師", team: "village", icon: Eye, max: 1,
    card: "bg-linear-to-br from-violet-900 to-[#0c0614] text-violet-100", chip: "bg-violet-700/25 text-fg",
    description: "Each night, choose one other player and learn if they are WHITE (village) or BLACK (werewolf).",
    win: "Win with the village when every Werewolf is dead.",
  },
  shaman: {
    id: "shaman", name: "Shaman", ja: "霊媒師", team: "village", icon: Ghost, max: 1,
    card: "bg-linear-to-br from-teal-800 to-[#03100f] text-teal-50", chip: "bg-teal-700/25 text-fg",
    description: "Each night, the spirits tell you whether the most recent person to die was WHITE (village) or BLACK (werewolf).",
    win: "Win with the village when every Werewolf is dead.",
  },
  knight: {
    id: "knight", name: "Knight", ja: "騎士", team: "village", icon: Shield, max: 1,
    card: "bg-linear-to-br from-slate-600 to-[#0b0f16] text-slate-50", chip: "bg-slate-500/25 text-fg",
    description: "Each night, protect one player (yourself included). If the wolves pick them, no one dies.",
    win: "Win with the village when every Werewolf is dead.",
  },
  werewolf: {
    id: "werewolf", name: "Werewolf", ja: "人狼", team: "werewolf", icon: WolfPaw,
    card: "bg-linear-to-br from-red-700 to-[#2a0306] text-red-50", chip: "bg-red-700/30 text-fg",
    description: "Each night, agree with your fellow wolves on one player to kill. By day, blend in.",
    win: "Win when living Werewolves equal or outnumber everyone else.",
  },
  madman: {
    id: "madman", name: "Madman", ja: "狂人", team: "werewolf", icon: Drama,
    card: "bg-linear-to-br from-fuchsia-900 to-black text-fuchsia-100", chip: "bg-fuchsia-800/30 text-fg",
    description: "A human who serves the wolves. You know who they are; they don't know you. The Fortune Teller and Shaman see you as WHITE.",
    win: "Win with the Werewolves.",
  },
};

export const TEAMS: Record<Team, { name: string; ja: string }> = {
  village: { name: "Village", ja: "村人陣営" },
  werewolf: { name: "Werewolves", ja: "人狼陣営" },
};
