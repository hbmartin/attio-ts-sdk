import type { ZodType } from "zod";
import { z } from "zod";
import {
  unwrapItems,
  unwrapPaginationCursor,
  unwrapPaginationOffset,
} from "./response";

interface PageResult<T> {
  items: T[];
  nextCursor?: string | null;
}

interface PaginationOptions<T = unknown> {
  cursor?: string | null;
  maxPages?: number;
  maxItems?: number;
  itemSchema?: ZodType<T>;
}

interface PaginationAsyncOptions<T = unknown> extends PaginationOptions<T> {
  signal?: AbortSignal;
}

interface OffsetPageResult<T> {
  items: T[];
  nextOffset?: number | null;
  total?: number;
}

interface OffsetPaginationOptions<T = unknown> {
  offset?: number;
  limit?: number;
  pageSize?: number;
  maxPages?: number;
  maxItems?: number;
  itemSchema?: ZodType<T>;
}

interface OffsetPaginationAsyncOptions<T = unknown>
  extends OffsetPaginationOptions<T> {
  signal?: AbortSignal;
}

interface SharedPaginationInput {
  maxPages?: number;
  maxItems?: number;
  signal?: AbortSignal;
}

interface SharedOffsetPaginationInput extends SharedPaginationInput {
  offset?: number;
  limit?: number;
}

interface OffsetItemsQueryInput extends SharedOffsetPaginationInput {
  paginate?: boolean | "stream";
}

const createPageResultSchema = <T>(
  itemSchema: ZodType<T>,
): ZodType<PageResult<T>> =>
  z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().nullish(),
  }) as ZodType<PageResult<T>>;

const basePageResultSchema: ZodType<PageResult<unknown>> = z.object({
  items: z.array(z.unknown()),
  nextCursor: z.string().nullish(),
}) as ZodType<PageResult<unknown>>;

const createOffsetPageResultSchema = <T>(
  itemSchema: ZodType<T>,
): ZodType<OffsetPageResult<T>> =>
  z.object({
    items: z.array(itemSchema),
    nextOffset: z.number().nullish(),
    total: z.number().optional(),
  }) as ZodType<OffsetPageResult<T>>;

const baseOffsetPageResultSchema: ZodType<OffsetPageResult<unknown>> = z.object(
  {
    items: z.array(z.unknown()),
    nextOffset: z.number().nullish(),
    total: z.number().optional(),
  },
) as ZodType<OffsetPageResult<unknown>>;

const toPageResult = <T>(result: unknown): PageResult<T> => {
  const items = unwrapItems<T>(result);
  const nextCursor = unwrapPaginationCursor(result);
  return { items, nextCursor };
};

const toOffsetPageResult = <T>(result: unknown): OffsetPageResult<T> => {
  const items = unwrapItems<T>(result);
  const nextOffset = unwrapPaginationOffset(result);
  return { items, nextOffset };
};

const parsePageResult = <T>(
  page: unknown,
  itemSchema?: ZodType<T>,
): PageResult<T> | undefined => {
  const schema: ZodType<PageResult<T>> = itemSchema
    ? createPageResultSchema(itemSchema)
    : (basePageResultSchema as ZodType<PageResult<T>>);
  const result = schema.safeParse(page);
  if (!result.success) {
    return;
  }
  return result.data;
};

const parseOffsetPageResult = <T>(
  page: unknown,
  itemSchema?: ZodType<T>,
): OffsetPageResult<T> | undefined => {
  const schema: ZodType<OffsetPageResult<T>> = itemSchema
    ? createOffsetPageResultSchema(itemSchema)
    : (baseOffsetPageResultSchema as ZodType<OffsetPageResult<T>>);
  const result = schema.safeParse(page);
  if (!result.success) {
    return;
  }
  return result.data;
};

interface PaginationLoopState {
  pages: number;
  itemCount: number;
  maxPages: number;
  maxItems: number;
  signal?: AbortSignal;
}

const createPaginationLoopState = (
  options: SharedPaginationInput,
): PaginationLoopState => ({
  pages: 0,
  itemCount: 0,
  maxPages: options.maxPages ?? Number.POSITIVE_INFINITY,
  maxItems: options.maxItems ?? Number.POSITIVE_INFINITY,
  signal: options.signal,
});

const shouldContinuePagination = (state: PaginationLoopState): boolean =>
  state.pages < state.maxPages &&
  state.itemCount < state.maxItems &&
  !isAborted(state.signal);

type CursorPageFetcher<T> = (
  cursor: string | null | undefined,
  signal?: AbortSignal,
) => Promise<PageResult<T> | unknown>;

type OffsetPageFetcher<T> = (
  offset: number,
  limit: number,
  signal?: AbortSignal,
) => Promise<OffsetPageResult<T> | unknown>;

const readCursorPage = async <T>(
  fetchPage: CursorPageFetcher<T>,
  cursor: string | null | undefined,
  options: PaginationAsyncOptions<T>,
): Promise<PageResult<T>> => {
  const page = await fetchPage(cursor, options.signal);
  const parsed = parsePageResult(page, options.itemSchema);
  return parsed ?? toPageResult<T>(page);
};

const readOffsetPage = async <T>(
  fetchPage: OffsetPageFetcher<T>,
  offset: number,
  limit: number,
  options: OffsetPaginationAsyncOptions<T>,
): Promise<OffsetPageResult<T>> => {
  const page = await fetchPage(offset, limit, options.signal);
  const parsed = parseOffsetPageResult(page, options.itemSchema);
  return parsed ?? toOffsetPageResult<T>(page);
};

const addCompletedPage = (
  state: PaginationLoopState,
  itemCount: number,
): void => {
  state.pages += 1;
  state.itemCount = itemCount;
};

const paginate = async <T>(
  fetchPage: CursorPageFetcher<T>,
  options: PaginationAsyncOptions<T> = {},
): Promise<T[]> => {
  const items: T[] = [];
  let cursor = options.cursor ?? null;
  const state = createPaginationLoopState(options);

  while (shouldContinuePagination(state)) {
    const { items: pageItems, nextCursor } = await readCursorPage(
      fetchPage,
      cursor,
      options,
    );

    items.push(...pageItems);
    addCompletedPage(state, items.length);

    if (!nextCursor) {
      break;
    }

    cursor = nextCursor;
  }

  return items.slice(0, state.maxItems);
};

const DEFAULT_OFFSET_PAGE_SIZE = 50;

interface NextOffsetParams {
  nextOffset?: number | null;
  pageItemsLength: number;
  limit: number;
  currentOffset: number;
}

const resolveNextOffset = ({
  nextOffset,
  pageItemsLength,
  limit,
  currentOffset,
}: NextOffsetParams): number | null => {
  if (typeof nextOffset === "number") {
    return nextOffset;
  }
  if (pageItemsLength < limit) {
    return null;
  }
  return currentOffset + limit;
};

interface OffsetPaginationRuntime {
  limit: number;
  offset: number;
  state: PaginationLoopState;
}

interface OffsetPageRead<T> {
  pageItems: T[];
  nextOffset?: number | null;
  currentOffset: number;
  limit: number;
}

const createOffsetPaginationRuntime = (
  options: OffsetPaginationAsyncOptions,
): OffsetPaginationRuntime => ({
  limit: Math.max(
    1,
    options.limit ?? options.pageSize ?? DEFAULT_OFFSET_PAGE_SIZE,
  ),
  offset: Math.max(0, options.offset ?? 0),
  state: createPaginationLoopState(options),
});

type OffsetItemsFetcher<T> = (
  offset?: number,
  limit?: number,
  signal?: AbortSignal,
) => Promise<T[]>;

const toOffsetItemsPageFetcher =
  <T>(fetchItems: OffsetItemsFetcher<T>) =>
  async (
    offset: number,
    limit: number,
    signal: AbortSignal | undefined,
  ): Promise<OffsetPageResult<T>> => ({
    items: await fetchItems(offset, limit, signal),
  });

const collectOffsetItems = <T>(
  fetchItems: OffsetItemsFetcher<T>,
  input: SharedOffsetPaginationInput,
): Promise<T[]> =>
  paginateOffset(toOffsetItemsPageFetcher(fetchItems), {
    offset: input.offset,
    limit: input.limit,
    maxPages: input.maxPages,
    maxItems: input.maxItems,
    signal: input.signal,
  });

const streamOffsetItems = <T>(
  fetchItems: OffsetItemsFetcher<T>,
  input: SharedOffsetPaginationInput,
): AsyncIterable<T> =>
  paginateOffsetAsync(toOffsetItemsPageFetcher(fetchItems), {
    offset: input.offset,
    limit: input.limit,
    maxPages: input.maxPages,
    maxItems: input.maxItems,
    signal: input.signal,
  });

const resolveOffsetItems = <T>(
  fetchItems: OffsetItemsFetcher<T>,
  input: OffsetItemsQueryInput,
): Promise<T[]> | AsyncIterable<T> => {
  if (input.paginate === "stream") {
    return streamOffsetItems(fetchItems, input);
  }

  if (input.paginate === true) {
    return collectOffsetItems(fetchItems, input);
  }

  return fetchItems(input.offset, input.limit, input.signal);
};

const readRuntimeOffsetPage = async <T>(
  fetchPage: OffsetPageFetcher<T>,
  runtime: OffsetPaginationRuntime,
  options: OffsetPaginationAsyncOptions<T>,
): Promise<OffsetPageRead<T>> => {
  const { items: pageItems, nextOffset } = await readOffsetPage(
    fetchPage,
    runtime.offset,
    runtime.limit,
    options,
  );
  return {
    pageItems,
    nextOffset,
    currentOffset: runtime.offset,
    limit: runtime.limit,
  };
};

const advanceOffset = <T>(
  runtime: OffsetPaginationRuntime,
  page: OffsetPageRead<T>,
): boolean => {
  const resolvedOffset = resolveNextOffset({
    nextOffset: page.nextOffset,
    pageItemsLength: page.pageItems.length,
    limit: page.limit,
    currentOffset: page.currentOffset,
  });

  if (resolvedOffset === null || resolvedOffset <= page.currentOffset) {
    return false;
  }

  runtime.offset = resolvedOffset;
  return true;
};

const paginateOffset = async <T>(
  fetchPage: OffsetPageFetcher<T>,
  options: OffsetPaginationAsyncOptions<T> = {},
): Promise<T[]> => {
  const items: T[] = [];
  const runtime = createOffsetPaginationRuntime(options);

  while (shouldContinuePagination(runtime.state)) {
    const page = await readRuntimeOffsetPage(fetchPage, runtime, options);

    items.push(...page.pageItems);
    addCompletedPage(runtime.state, items.length);

    if (!shouldContinuePagination(runtime.state)) {
      break;
    }

    if (!advanceOffset(runtime, page)) {
      break;
    }
  }

  return items.slice(0, runtime.state.maxItems);
};

const isAborted = (signal: AbortSignal | undefined): boolean =>
  signal?.aborted === true;

function* yieldItems<T>(
  items: T[],
  signal: AbortSignal | undefined,
  state: { yielded: number },
  maxItems: number,
): Generator<T, boolean> {
  for (const item of items) {
    if (isAborted(signal) || state.yielded >= maxItems) {
      return true;
    }
    yield item;
    state.yielded += 1;
  }
  return false;
}

function* yieldPageItems<T>(
  pageItems: T[],
  state: PaginationLoopState,
): Generator<T, boolean> {
  const yieldState = { yielded: state.itemCount };
  const stopped = yield* yieldItems(
    pageItems,
    state.signal,
    yieldState,
    state.maxItems,
  );
  if (!stopped) {
    addCompletedPage(state, yieldState.yielded);
  }
  return stopped;
}

async function* paginateAsync<T>(
  fetchPage: CursorPageFetcher<T>,
  options: PaginationAsyncOptions<T> = {},
): AsyncIterable<T> {
  let cursor = options.cursor ?? null;
  const state = createPaginationLoopState(options);

  while (shouldContinuePagination(state)) {
    const { items: pageItems, nextCursor } = await readCursorPage(
      fetchPage,
      cursor,
      options,
    );

    if (yield* yieldPageItems(pageItems, state)) {
      return;
    }

    if (!nextCursor) {
      return;
    }
    cursor = nextCursor;
  }
}

async function* paginateOffsetAsync<T>(
  fetchPage: OffsetPageFetcher<T>,
  options: OffsetPaginationAsyncOptions<T> = {},
): AsyncIterable<T> {
  const runtime = createOffsetPaginationRuntime(options);

  while (shouldContinuePagination(runtime.state)) {
    const page = await readRuntimeOffsetPage(fetchPage, runtime, options);

    if (yield* yieldPageItems(page.pageItems, runtime.state)) {
      return;
    }

    if (!advanceOffset(runtime, page)) {
      return;
    }
  }
}

export type {
  OffsetItemsQueryInput,
  OffsetPageResult,
  OffsetPaginationAsyncOptions,
  OffsetPaginationOptions,
  PageResult,
  PaginationAsyncOptions,
  PaginationOptions,
  SharedOffsetPaginationInput,
  SharedPaginationInput,
};
export {
  collectOffsetItems,
  createOffsetPageResultSchema,
  createPageResultSchema,
  paginate,
  paginateAsync,
  paginateOffset,
  paginateOffsetAsync,
  parseOffsetPageResult,
  parsePageResult,
  resolveOffsetItems,
  streamOffsetItems,
  toOffsetPageResult,
  toPageResult,
};
