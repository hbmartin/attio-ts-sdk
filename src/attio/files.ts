import { z } from "zod";
import type {
  GetV2FilesByFileIdData,
  GetV2FilesByFileIdDownloadData,
  GetV2FilesData,
  Options,
} from "../generated";
import {
  getV2Files,
  getV2FilesByFileId,
  getV2FilesByFileIdDownload,
} from "../generated";
import {
  zConnectedFile,
  zConnectedFolder,
  zFile,
  zFolder,
  zGetV2FilesResponse,
} from "../generated/zod.gen";
import { type AttioClientInput, resolveAttioClient } from "./client";
import { AttioResponseError } from "./errors";
import { type BrandedId, createBrandedIdSchema } from "./ids";
import { callAndUnwrapData } from "./operations";
import { type PageResult, paginate, paginateAsync } from "./pagination";
import { assertOk, unwrapData } from "./response";

const fileEntrySchema = zFile
  .or(zFolder)
  .or(zConnectedFile)
  .or(zConnectedFolder);
const fileEntryWithChildrenSchema = zFile
  .or(zFolder.and(z.object({ has_children: z.boolean() })))
  .or(zConnectedFile)
  .or(zConnectedFolder);
const downloadResponseSchema = z
  .object({
    response: z.instanceof(Response).optional(),
  })
  .passthrough();

type AttioFileEntry = z.infer<typeof fileEntrySchema>;
type AttioFileEntryWithChildren = z.infer<typeof fileEntryWithChildrenSchema>;

type FileId = BrandedId<"FileId">;
type FileObjectId = BrandedId<"FileObjectId">;
type FileRecordId = BrandedId<"FileRecordId">;
type FileParentFolderId = BrandedId<"FileParentFolderId">;
type FileListQuery = GetV2FilesData["query"];
type FileStorageProvider = NonNullable<FileListQuery["storage_provider"]>;

const fileIdSchema = createBrandedIdSchema<"FileId">("FileId");
const fileObjectIdSchema =
  createBrandedIdSchema<"FileObjectId">("File object id");
const fileRecordIdSchema =
  createBrandedIdSchema<"FileRecordId">("File record id");
const fileParentFolderIdSchema = createBrandedIdSchema<"FileParentFolderId">(
  "File parent folder id",
);

const createFileId = (id: string): FileId => fileIdSchema.parse(id);
const createFileObjectId = (id: string): FileObjectId =>
  fileObjectIdSchema.parse(id);
const createFileRecordId = (id: string): FileRecordId =>
  fileRecordIdSchema.parse(id);
const createFileParentFolderId = (id: string): FileParentFolderId =>
  fileParentFolderIdSchema.parse(id);

const peopleFileObjectId = createFileObjectId("people");

interface FileListOptionsInput extends AttioClientInput {
  storageProvider?: FileStorageProvider;
  parentFolderId?: FileParentFolderId;
  limit?: FileListQuery["limit"];
  cursor?: FileListQuery["cursor"];
  signal?: AbortSignal;
  options?: Omit<Options<GetV2FilesData>, "client" | "query">;
}

interface FileListBaseInput extends FileListOptionsInput {
  object: FileObjectId;
  recordId: FileRecordId;
}

interface FileListSingleInput extends FileListBaseInput {
  paginate?: false;
}

interface FileListCollectInput extends FileListBaseInput {
  paginate: true;
  maxPages?: number;
  maxItems?: number;
}

interface FileListStreamInput extends FileListBaseInput {
  paginate: "stream";
  maxPages?: number;
  maxItems?: number;
}

type FileListInput =
  | FileListSingleInput
  | FileListCollectInput
  | FileListStreamInput;

interface PersonFileListBaseInput extends FileListOptionsInput {
  personId: FileRecordId;
}

interface PersonFileListSingleInput extends PersonFileListBaseInput {
  paginate?: false;
}

interface PersonFileListCollectInput extends PersonFileListBaseInput {
  paginate: true;
  maxPages?: number;
  maxItems?: number;
}

interface PersonFileListStreamInput extends PersonFileListBaseInput {
  paginate: "stream";
  maxPages?: number;
  maxItems?: number;
}

type PersonFileListInput =
  | PersonFileListSingleInput
  | PersonFileListCollectInput
  | PersonFileListStreamInput;

interface FileGetInput extends AttioClientInput {
  fileId: FileId;
  options?: Omit<Options<GetV2FilesByFileIdData>, "client" | "path">;
}

type FileDownloadParseAs = "arrayBuffer" | "blob" | "stream" | "text";
type FileDownloadContent =
  | ArrayBuffer
  | Blob
  | ReadableStream<Uint8Array>
  | string
  | null;

interface FileDownloadInput<
  TParseAs extends FileDownloadParseAs = "arrayBuffer",
> extends AttioClientInput {
  fileId: FileId;
  parseAs?: TParseAs;
  options?: Omit<
    Options<GetV2FilesByFileIdDownloadData>,
    "client" | "path" | "parseAs" | "responseStyle"
  >;
}

interface FileDownloadUrlInput extends AttioClientInput {
  fileId: FileId;
  options?: Omit<
    Options<GetV2FilesByFileIdDownloadData>,
    | "client"
    | "path"
    | "parseAs"
    | "redirect"
    | "responseStyle"
    | "throwOnError"
  >;
}

const buildFileListQuery = (
  input: FileListBaseInput,
  cursor?: string | null,
): FileListQuery => {
  const query: FileListQuery = {
    object: input.object,
    record_id: input.recordId,
  };
  const effectiveCursor = cursor ?? input.cursor;

  if (input.storageProvider) {
    query.storage_provider = input.storageProvider;
  }
  if (input.parentFolderId) {
    query.parent_folder_id = input.parentFolderId;
  }
  if (input.limit !== undefined) {
    query.limit = input.limit;
  }
  if (effectiveCursor !== undefined) {
    query.cursor = effectiveCursor;
  }

  return query;
};

const readFileListResponse = (
  result: unknown,
): z.infer<typeof zGetV2FilesResponse> => {
  const parsed = zGetV2FilesResponse.safeParse(result);
  if (parsed.success) {
    return parsed.data;
  }
  return unwrapData(result, { schema: zGetV2FilesResponse, maxDepth: 1 });
};

const readFilePage = async (
  input: FileListBaseInput,
  cursor?: string | null,
  signal?: AbortSignal,
): Promise<PageResult<AttioFileEntry>> => {
  const client = resolveAttioClient(input);
  const result = await getV2Files({
    client,
    query: buildFileListQuery(input, cursor),
    ...input.options,
    signal,
  });
  const response = readFileListResponse(result);

  return {
    items: response.data,
    nextCursor: response.pagination.next_cursor,
  };
};

const collectFilePages = (
  input: FileListCollectInput,
): Promise<AttioFileEntry[]> =>
  paginate((cursor, signal) => readFilePage(input, cursor, signal), {
    cursor: input.cursor,
    maxItems: input.maxItems,
    maxPages: input.maxPages,
    signal: input.signal,
    itemSchema: fileEntrySchema,
  });

const streamFilePages = (
  input: FileListStreamInput,
): AsyncIterable<AttioFileEntry> =>
  paginateAsync((cursor, signal) => readFilePage(input, cursor, signal), {
    cursor: input.cursor,
    maxItems: input.maxItems,
    maxPages: input.maxPages,
    signal: input.signal,
    itemSchema: fileEntrySchema,
  });

function listFiles(input: FileListStreamInput): AsyncIterable<AttioFileEntry>;
function listFiles(
  input: FileListSingleInput | FileListCollectInput,
): Promise<AttioFileEntry[]>;
function listFiles(
  input: FileListInput,
): Promise<AttioFileEntry[]> | AsyncIterable<AttioFileEntry>;
function listFiles(
  input: FileListInput,
): Promise<AttioFileEntry[]> | AsyncIterable<AttioFileEntry> {
  if (input.paginate === "stream") {
    return streamFilePages(input);
  }
  if (input.paginate === true) {
    return collectFilePages(input);
  }
  return readFilePage(input, input.cursor, input.signal).then(
    (page) => page.items,
  );
}

function listPersonFiles(
  input: PersonFileListStreamInput,
): AsyncIterable<AttioFileEntry>;
function listPersonFiles(
  input: PersonFileListSingleInput | PersonFileListCollectInput,
): Promise<AttioFileEntry[]>;
function listPersonFiles(
  input: PersonFileListInput,
): Promise<AttioFileEntry[]> | AsyncIterable<AttioFileEntry>;
function listPersonFiles(
  input: PersonFileListInput,
): Promise<AttioFileEntry[]> | AsyncIterable<AttioFileEntry> {
  const { personId, ...rest } = input;
  return listFiles({
    ...rest,
    object: peopleFileObjectId,
    recordId: personId,
  });
}

const getFile = async (
  input: FileGetInput,
): Promise<AttioFileEntryWithChildren> =>
  callAndUnwrapData(
    input,
    (client) =>
      getV2FilesByFileId({
        client,
        path: { file_id: input.fileId },
        ...input.options,
      }),
    { schema: fileEntryWithChildrenSchema },
  );

const invalidDownloadDataError = (
  parseAs: FileDownloadParseAs,
  data: unknown,
): AttioResponseError =>
  new AttioResponseError("Invalid file download response.", {
    code: "INVALID_FILE_DOWNLOAD_RESPONSE",
    data: { parseAs, value: data },
  });

const validateDownloadData = (
  data: unknown,
  parseAs: FileDownloadParseAs,
): FileDownloadContent => {
  if (parseAs === "arrayBuffer" && data instanceof ArrayBuffer) {
    return data;
  }
  if (
    parseAs === "blob" &&
    typeof Blob !== "undefined" &&
    data instanceof Blob
  ) {
    return data;
  }
  if (parseAs === "text" && typeof data === "string") {
    return data;
  }
  if (parseAs === "stream") {
    if (data === null) {
      return data;
    }
    if (
      typeof ReadableStream !== "undefined" &&
      data instanceof ReadableStream
    ) {
      return data;
    }
  }
  throw invalidDownloadDataError(parseAs, data);
};

function downloadFile(
  input: FileDownloadInput<"arrayBuffer"> & { parseAs?: "arrayBuffer" },
): Promise<ArrayBuffer>;
function downloadFile(
  input: FileDownloadInput<"blob"> & { parseAs: "blob" },
): Promise<Blob>;
function downloadFile(
  input: FileDownloadInput<"stream"> & { parseAs: "stream" },
): Promise<ReadableStream<Uint8Array> | null>;
function downloadFile(
  input: FileDownloadInput<"text"> & { parseAs: "text" },
): Promise<string>;
async function downloadFile(
  input: FileDownloadInput<FileDownloadParseAs>,
): Promise<FileDownloadContent> {
  const client = resolveAttioClient(input);
  const parseAs = input.parseAs ?? "arrayBuffer";
  const result = await getV2FilesByFileIdDownload({
    client,
    path: { file_id: input.fileId },
    ...input.options,
    parseAs,
    responseStyle: "fields",
  });
  const data = assertOk(result);
  return validateDownloadData(data, parseAs);
}

const unavailableDownloadUrlError = (result: unknown): AttioResponseError =>
  new AttioResponseError("Attio file download URL is unavailable.", {
    code: "FILE_DOWNLOAD_URL_UNAVAILABLE",
    data: result,
  });

const getFileDownloadUrl = async (
  input: FileDownloadUrlInput,
): Promise<string> => {
  const client = resolveAttioClient(input);
  const result = await getV2FilesByFileIdDownload({
    client,
    path: { file_id: input.fileId },
    ...input.options,
    parseAs: "text",
    redirect: "manual",
    responseStyle: "fields",
    throwOnError: false,
  });
  const parsed = downloadResponseSchema.safeParse(result);
  const location = parsed.success
    ? parsed.data.response?.headers.get("Location")
    : undefined;

  if (!location) {
    throw unavailableDownloadUrlError(result);
  }

  return location;
};

export type {
  AttioFileEntry,
  AttioFileEntryWithChildren,
  FileDownloadContent,
  FileDownloadInput,
  FileDownloadParseAs,
  FileDownloadUrlInput,
  FileGetInput,
  FileId,
  FileListBaseInput,
  FileListCollectInput,
  FileListInput,
  FileListOptionsInput,
  FileListSingleInput,
  FileListStreamInput,
  FileObjectId,
  FileParentFolderId,
  FileRecordId,
  FileStorageProvider,
  PersonFileListBaseInput,
  PersonFileListCollectInput,
  PersonFileListInput,
  PersonFileListSingleInput,
  PersonFileListStreamInput,
};
export {
  createFileId,
  createFileObjectId,
  createFileParentFolderId,
  createFileRecordId,
  downloadFile,
  fileEntrySchema,
  fileEntryWithChildrenSchema,
  fileIdSchema,
  fileObjectIdSchema,
  fileParentFolderIdSchema,
  fileRecordIdSchema,
  getFile,
  getFileDownloadUrl,
  listFiles,
  listPersonFiles,
};
