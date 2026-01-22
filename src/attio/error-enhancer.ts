import type { AttioError } from "./errors";

export interface AttioValueSuggestion {
  field: string;
  attempted: string;
  bestMatch?: string;
  matches: string[];
}

const knownFieldValues = new Map<string, string[]>();

export const getKnownFieldValues = (field: string): string[] | undefined =>
  knownFieldValues.get(field);

export const updateKnownFieldValues = (
  field: string,
  values: string[],
): void => {
  const unique = Array.from(
    new Set(values.map((value) => value.trim())),
  ).filter(Boolean);
  if (unique.length > 0) {
    knownFieldValues.set(field, unique);
  } else {
    knownFieldValues.delete(field);
  }
};

const extractMismatchContext = (error: AttioError) => {
  const data = error.data as Record<string, unknown> | undefined;
  const message = error.message;
  const path =
    (Array.isArray(data?.path) ? data?.path[0] : data?.path) ??
    data?.field ??
    data?.attribute ??
    undefined;

  if (typeof message !== "string" || typeof path !== "string") return;

  const patterns = [
    /constraint:\s*([^,]+)/i,
    /option name\s+'([^']+)'/i,
    /option name\s+"([^"]+)"/i,
  ];

  let value: string | undefined;
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      value = match[1].trim();
      break;
    }
  }

  return { field: path, value };
};

const levenshtein = (a: string, b: string): number => {
  const matrix: number[][] = [];
  const aLen = a.length;
  const bLen = b.length;

  for (let i = 0; i <= bLen; i += 1) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= aLen; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bLen; i += 1) {
    for (let j = 1; j <= aLen; j += 1) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[bLen][aLen];
};

const scoreCandidates = (value: string, candidates: string[]): string[] => {
  const normalized = value.toLowerCase();
  return candidates
    .map((candidate) => ({
      candidate,
      score: levenshtein(normalized, candidate.toLowerCase()),
    }))
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.candidate);
};

export const enhanceAttioError = (error: AttioError): AttioError => {
  if (!error?.isApiError) {
    return error;
  }

  const context = extractMismatchContext(error);
  if (!(context?.field && context?.value)) {
    return error;
  }

  const candidates = knownFieldValues.get(context.field);
  if (!candidates?.length) {
    return error;
  }

  const matches = scoreCandidates(context.value, candidates).slice(0, 3);
  const suggestion: AttioValueSuggestion = {
    field: context.field,
    attempted: context.value,
    bestMatch: matches[0],
    matches,
  };

  error.suggestions = suggestion;
  return error;
};
