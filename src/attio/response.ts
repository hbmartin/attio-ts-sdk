export const unwrapData = <T>(result: unknown): T => {
  if (!result || typeof result !== 'object') return result as T;
  if ('data' in result) {
    return (result as { data: T }).data;
  }
  return result as T;
};

export const unwrapItems = <T>(result: unknown): T[] => {
  const data = unwrapData<unknown>(result);
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const nested = record.data ?? record.items ?? record.records;
    if (Array.isArray(nested)) return nested as T[];
  }
  return [];
};

export const unwrapPaginationCursor = (result: unknown): string | null => {
  const data = unwrapData<unknown>(result);
  if (!data || typeof data !== 'object') return null;
  const pagination = (data as Record<string, unknown>).pagination as
    | Record<string, unknown>
    | undefined;
  if (!pagination) return null;
  const cursor = pagination.next_cursor ?? pagination.nextCursor;
  return typeof cursor === 'string' ? cursor : null;
};
