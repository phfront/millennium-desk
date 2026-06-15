import type { TaskTag } from "../../../shared/contracts";

export const TAG_COLORS = [
  "#8c8dff",
  "#4f9cf9",
  "#21b58f",
  "#e15f9a",
  "#f08a4b",
  "#d19a66",
] as const;

export const isTagColorPreset = (
  color: string,
): color is (typeof TAG_COLORS)[number] =>
  (TAG_COLORS as readonly string[]).includes(color);

export const toggleTagId = (tagIds: number[], tagId: number) =>
  tagIds.includes(tagId)
    ? tagIds.filter((id) => id !== tagId)
    : [...tagIds, tagId];

export type TagSuggestion = {
  tag: TaskTag;
  tokenStart: number;
  tokenEnd: number;
};

const getWordAtCursor = (
  text: string,
  cursor: number,
): { word: string; start: number; end: number } | null => {
  const before = text.slice(0, cursor);
  const after = text.slice(cursor);
  const beforeMatch = before.match(/(\S*)$/);
  if (!beforeMatch) return null;

  const wordBefore = beforeMatch[1];
  const wordAfter = after.match(/^(\S*)/)?.[1] ?? "";
  const word = wordBefore + wordAfter;
  if (!word) return null;

  return {
    word,
    start: cursor - wordBefore.length,
    end: cursor + wordAfter.length,
  };
};

export const findTagSuggestion = (
  text: string,
  cursor: number,
  tags: readonly TaskTag[],
  selectedTagIds: readonly number[],
): TagSuggestion | null => {
  const token = getWordAtCursor(text, cursor);
  if (!token) return null;

  let query = token.word;
  let tokenStart = token.start;

  if (query.startsWith("#")) {
    query = query.slice(1);
    tokenStart += 1;
  }

  if (!query) return null;

  const normalizedQuery = query.toLowerCase();
  const selected = new Set(selectedTagIds);
  const candidates = tags.filter(
    (tag) =>
      !selected.has(tag.id) &&
      tag.name.toLowerCase().startsWith(normalizedQuery),
  );

  if (candidates.length === 0) return null;

  const match = [...candidates].sort((a, b) => {
    const aExact = a.name.toLowerCase() === normalizedQuery;
    const bExact = b.name.toLowerCase() === normalizedQuery;
    if (aExact !== bExact) return aExact ? -1 : 1;
    return a.name.length - b.name.length;
  })[0];

  return {
    tag: match,
    tokenStart,
    tokenEnd: token.end,
  };
};

export const applyTagSuggestionToText = (
  text: string,
  tokenStart: number,
  tokenEnd: number,
): string => {
  const before = text.slice(0, tokenStart);
  const after = text.slice(tokenEnd);
  const needsSpace =
    before.trimEnd().length > 0 && after.trimStart().length > 0;
  return needsSpace
    ? `${before.trimEnd()} ${after.trimStart()}`
    : `${before.trimEnd()}${after.trimStart()}`;
};
