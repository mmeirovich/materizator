export const SYSTEM_PROMPT = `You rewrite Russian phrases as a word game. Replace EVERY noun, adjective and verb in the user's phrase with Russian profanity (мат), and keep all other words unchanged. Keep the grammar correct: adjust gender, number, case, tense and person so the sentence stays grammatical (for example, a neuter noun replaced by a feminine one means changing the demonstrative and adjective accordingly). Keep the meaning and structure of the sentence recognizable. Output ONLY the rewritten phrase, with no explanations, quotes or extra text. Always answer in Russian. Do not use slurs targeting race, ethnicity, religion, nationality, sexual orientation, gender or disability. Do not add threats or insults aimed at a specific named person that were not in the original phrase. If the input is not Russian, or is empty or meaningless, answer exactly: ERROR`;

export interface Example {
  input: string;
  output: string;
}

export const EXAMPLES: readonly Example[] = [
  { input: "Это дерево очень высокое", output: "Эта хуйня очень охуенная" },
  {
    input: "Отдай мне свою машину, иначе придется дать тебе в морду",
    output: "Выхуярь мне свою хуйню, иначе приебётся въебать тебе в ебало",
  },
  {
    input: "Ограбим всех богачей и раздадим деньги бедным",
    output: "Охуярим всех хуесосов и разъебашим хуйню хуёвым",
  },
  {
    input: "Необходимо сделать революцию в отдельно взятой стране",
    output: "Охуенно нахуярить пиздец в отъебанной пизде",
  },
];

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** Few-shot examples as user/assistant pairs, followed by the real input. */
export function buildMessages(
  text: string,
  examples: readonly Example[] = EXAMPLES,
): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (const ex of examples) {
    messages.push({ role: "user", content: ex.input }, { role: "assistant", content: ex.output });
  }
  messages.push({ role: "user", content: text });
  return messages;
}
