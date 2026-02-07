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

type CursorFetchFn<T> = (
  cursor: string | null | undefined,
  signal?: AbortSignal,
) => Promise<PageResult<T> | unknown>;

const fetchCursorPage = async <T>(
  fetchFn: CursorFetchFn<T>,
  cursor: string | null,
  options: PaginationAsyncOptions<T>,
): Promise<PageResult<T>> => {
  const page = await fetchFn(cursor, options.signal);
  const parsed = parsePageResult(page, options.itemSchema);
  return parsed ?? toPageResult<T>(page);
};

interface CursorPaginationContext {
  maxPages: number;
  maxItems: number;
  signal?: AbortSignal;
}

const createCursorPaginationContext = <T>(
  options: PaginationAsyncOptions<T>,
): CursorPaginationContext => ({
  maxPages: options.maxPages ?? Number.POSITIVE_INFINITY,
  maxItems: options.maxItems ?? Number.POSITIVE_INFINITY,
  signal: options.signal,
});

const paginate = async <T>(
  fetchPage: CursorFetchFn<T>,
  options: PaginationAsyncOptions<T> = {},
): Promise<T[]> => {
  const items: T[] = [];
  let cursor = options.cursor ?? null;
  let pages = 0;
  const ctx = createCursorPaginationContext(options);

  while (
    pages < ctx.maxPages &&
    items.length < ctx.maxItems &&
    !isAborted(ctx.signal)
  ) {
    const { items: pageItems, nextCursor } = await fetchCursorPage(
      fetchPage,
      cursor,
      options,
    );
    items.push(...pageItems);
    pages += 1;
    if (!nextCursor) {
      break;
    }
    cursor = nextCursor;
  }

  return items.slice(0, ctx.maxItems);
};

const DEFAULT_OFFSET_PAGE_SIZE = 50;

interface OffsetPaginationContext {
  maxPages: number;
  maxItems: number;
  limit: number;
  initialOffset: number;
  signal?: AbortSignal;
}

const createOffsetPaginationContext = <T>(
  options: OffsetPaginationAsyncOptions<T>,
): OffsetPaginationContext => ({
  maxPages: options.maxPages ?? Number.POSITIVE_INFINITY,
  maxItems: options.maxItems ?? Number.POSITIVE_INFINITY,
  limit: Math.max(
    1,
    options.limit ?? options.pageSize ?? DEFAULT_OFFSET_PAGE_SIZE,
  ),
  initialOffset: Math.max(0, options.offset ?? 0),
  signal: options.signal,
});

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

interface OffsetPaginationState {
  pages: number;
  itemCount: number;
  maxPages: number;
  maxItems: number;
  signal?: AbortSignal;
}

const shouldContinueOffsetPagination = (
  state: OffsetPaginationState,
): boolean =>
  state.pages < state.maxPages &&
  state.itemCount < state.maxItems &&
  !isAborted(state.signal);

type OffsetFetchFn<T> = (
  offset: number,
  limit: number,
  signal?: AbortSignal,
) => Promise<OffsetPageResult<T> | unknown>;

interface FetchOffsetPageParams<T> {
  fetchFn: OffsetFetchFn<T>;
  offset: number;
  limit: number;
  signal: AbortSignal | undefined;
  options: OffsetPaginationAsyncOptions<T>;
}

const fetchOffsetPage = async <T>(
  params: FetchOffsetPageParams<T>,
): Promise<OffsetPageResult<T>> => {
  const page = await params.fetchFn(params.offset, params.limit, params.signal);
  const parsed = parseOffsetPageResult(page, params.options.itemSchema);
  return parsed ?? toOffsetPageResult<T>(page);
};

const paginateOffset = async <T>(
  fetchPage: OffsetFetchFn<T>,
  options: OffsetPaginationAsyncOptions<T> = {},
): Promise<T[]> => {
  const items: T[] = [];
  const ctx = createOffsetPaginationContext(options);
  let offset = ctx.initialOffset;
  const state: OffsetPaginationState = {
    pages: 0,
    itemCount: 0,
    maxPages: ctx.maxPages,
    maxItems: ctx.maxItems,
    signal: ctx.signal,
  };

  while (shouldContinueOffsetPagination(state)) {
    const { items: pageItems, nextOffset } = await fetchOffsetPage({
      fetchFn: fetchPage,
      offset,
      limit: ctx.limit,
      signal: ctx.signal,
      options,
    });

    items.push(...pageItems);
    state.pages += 1;
    state.itemCount = items.length;

    if (!shouldContinueOffsetPagination(state)) {
      break;
    }

    const resolvedOffset = resolveNextOffset({
      nextOffset,
      pageItemsLength: pageItems.length,
      limit: ctx.limit,
      currentOffset: offset,
    });

    if (resolvedOffset === null || resolvedOffset <= offset) {
      break;
    }

    offset = resolvedOffset;
  }

  return items.slice(0, ctx.maxItems);
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

async function* paginateAsync<T>(
  fetchPage: CursorFetchFn<T>,
  options: PaginationAsyncOptions<T> = {},
): AsyncIterable<T> {
  let cursor = options.cursor ?? null;
  let pages = 0;
  const state = { yielded: 0 };
  const ctx = createCursorPaginationContext(options);

  while (
    pages < ctx.maxPages &&
    state.yielded < ctx.maxItems &&
    !isAborted(ctx.signal)
  ) {
    const { items: pageItems, nextCursor } = await fetchCursorPage(
      fetchPage,
      cursor,
      options,
    );
    const stopped = yield* yieldItems(
      pageItems,
      ctx.signal,
      state,
      ctx.maxItems,
    );
    if (stopped) {
      return;
    }
    pages += 1;
    if (!nextCursor) {
      return;
    }
    cursor = nextCursor;
  }
}

async function* paginateOffsetAsync<T>(
  fetchPage: OffsetFetchFn<T>,
  options: OffsetPaginationAsyncOptions<T> = {},
): AsyncIterable<T> {
  const ctx = createOffsetPaginationContext(options);
  let offset = ctx.initialOffset;
  let pages = 0;
  const state = { yielded: 0 };

  while (
    pages < ctx.maxPages &&
    state.yielded < ctx.maxItems &&
    !isAborted(ctx.signal)
  ) {
    const { items: pageItems, nextOffset } = await fetchOffsetPage({
      fetchFn: fetchPage,
      offset,
      limit: ctx.limit,
      signal: ctx.signal,
      options,
    });

    const stopped = yield* yieldItems(
      pageItems,
      ctx.signal,
      state,
      ctx.maxItems,
    );
    if (stopped) {
      return;
    }

    pages += 1;
    const resolvedOffset = resolveNextOffset({
      nextOffset,
      pageItemsLength: pageItems.length,
      limit: ctx.limit,
      currentOffset: offset,
    });

    if (resolvedOffset === null || resolvedOffset <= offset) {
      return;
    }
    offset = resolvedOffset;
  }
}

type OffsetFetchPage<T> = (
  offset: number | undefined,
  limit: number | undefined,
  signal: AbortSignal | undefined,
) => Promise<T[]>;

interface PaginatedQueryInput {
  paginate?: false | true | "stream";
  offset?: number;
  limit?: number;
  maxPages?: number;
  maxItems?: number;
  signal?: AbortSignal;
}

interface ExecutePaginatedQueryConfig<T> extends PaginatedQueryInput {
  fetchPage: OffsetFetchPage<T>;
}

const buildQueryConfig = <T>(
  input: PaginatedQueryInput,
  fetchPage: OffsetFetchPage<T>,
): ExecutePaginatedQueryConfig<T> => ({
  fetchPage,
  paginate: input.paginate,
  offset: input.offset,
  limit: input.limit,
  maxPages: input.maxPages,
  maxItems: input.maxItems,
  signal: input.signal,
});

function executePaginatedQuery<T>(
  config: ExecutePaginatedQueryConfig<T> & { paginate: "stream" },
): AsyncIterable<T>;
function executePaginatedQuery<T>(
  config: ExecutePaginatedQueryConfig<T> & { paginate?: false | true },
): Promise<T[]>;
function executePaginatedQuery<T>(
  config: ExecutePaginatedQueryConfig<T>,
): Promise<T[]> | AsyncIterable<T>;
function executePaginatedQuery<T>(
  config: ExecutePaginatedQueryConfig<T>,
): Promise<T[]> | AsyncIterable<T> {
  const paginationOptions = {
    offset: config.offset,
    limit: config.limit,
    maxPages: config.maxPages,
    maxItems: config.maxItems,
    signal: config.signal,
  };

  if (config.paginate === "stream") {
    return paginateOffsetAsync<T>(
      async (offset, limit, signal) => ({
        items: await config.fetchPage(offset, limit, signal),
      }),
      paginationOptions,
    );
  }

  if (config.paginate === true) {
    return paginateOffset<T>(
      async (offset, limit, signal) => ({
        items: await config.fetchPage(offset, limit, signal),
      }),
      paginationOptions,
    );
  }

  return config.fetchPage(config.offset, config.limit, config.signal);
}

export type {
  ExecutePaginatedQueryConfig,
  OffsetFetchPage,
  OffsetPageResult,
  OffsetPaginationAsyncOptions,
  OffsetPaginationOptions,
  PageResult,
  PaginatedQueryInput,
  PaginationAsyncOptions,
  PaginationOptions,
  SharedPaginationInput,
};
export {
  buildQueryConfig,
  createOffsetPageResultSchema,
  createPageResultSchema,
  executePaginatedQuery,
  paginate,
  paginateAsync,
  paginateOffset,
  paginateOffsetAsync,
  parseOffsetPageResult,
  parsePageResult,
  toOffsetPageResult,
  toPageResult,
};
