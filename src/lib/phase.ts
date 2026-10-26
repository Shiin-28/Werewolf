import type { Game, NightStep } from "./types";

export const STEP_LABEL: Record<NightStep, { en: string; ja: string }> = {
  knight: { en: "Knight's turn", ja: "騎士" },
  fortune: { en: "Fortune Teller's turn", ja: "占い師" },
  shaman: { en: "Shaman's turn", ja: "霊媒師" },
  wolves: { en: "Werewolves' turn", ja: "人狼" },
  done: { en: "Dawn is coming", ja: "夜明け前" },
};

export interface Banner {
  title: string;
  ja: string;
  dark: boolean;
}

export function bannerFor(game: Game): Banner {
  const r = game.round;
  switch (game.phase) {
    case "lobby":
      return { title: "Lobby", ja: "ロビー", dark: true };
    case "role_reveal":
      return { title: "Check your role", ja: "役職確認", dark: true };
    case "night": {
      const step = game.night_step ? STEP_LABEL[game.night_step] : null;
      return {
        title: step ? `Night ${r} — ${step.en}` : `Night ${r}`,
        ja: step ? `${r}日目の夜・${step.ja}` : `${r}日目の夜`,
        dark: true,
      };
    }
    case "morning":
      return { title: `Morning ${r}`, ja: `${r}日目の朝`, dark: false };
    case "day":
      return { title: `Day ${r} — Discussion`, ja: `${r}日目・議論`, dark: false };
    case "voting":
      return { title: `Day ${r} — Voting`, ja: `${r}日目・投票`, dark: false };
    case "vote_result":
      return { title: `Day ${r} — Vote result`, ja: `${r}日目・投票結果`, dark: false };
    case "game_over":
      // A village win is a sunrise; a werewolf win (or an early end) stays in the dark.
      return { title: "Game over", ja: "ゲーム終了", dark: game.winner !== "village" };
  }
}
