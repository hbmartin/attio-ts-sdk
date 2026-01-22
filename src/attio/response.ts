export const unwrapData = <T>(result: unknown): T => {
  if (!result || typeof result !== "object") return result as T;
  if ("data" in result) {
    return (result as { data: T }).data;
  }
  return result as T;
};

export const unwrapItems = <T>(result: unknown): T[] => {
  const data = unwrapData<unknown>(result);
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const nested = record.data ?? record.items ?? record.records;
    if (Array.isArray(nested)) return nested as T[];
  }
  return [];
};

export const unwrapPaginationCursor = (result: unknown): string | null => {
  const readCursor = (pagination: unknown): string | null => {
    if (!pagination || typeof pagination !== "object") return null;
    const cursor =
      (pagination as Record<string, unknown>).next_cursor ??
      (pagination as Record<string, unknown>).nextCursor;
    return typeof cursor === "string" ? cursor : null;
  };
  if (result && typeof result === "object") {
    const rootCursor = readCursor(
      (result as Record<string, unknown>).pagination,
    );
    if (rootCursor) return rootCursor;
  }
  const data = unwrapData<unknown>(result);
  if (!data || typeof data !== "object") return null;
  return readCursor((data as Record<string, unknown>).pagination);
};
