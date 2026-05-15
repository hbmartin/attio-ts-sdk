import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AttioFileEntry } from "../../src/attio/files";

const getFilesRequest = vi.fn();
const getFileByIdRequest = vi.fn();
const downloadFileRequest = vi.fn();
const resolveAttioClient = vi.fn();

type NativeFile = Extract<AttioFileEntry, { file_type: "file" }>;
type NativeFolder = Extract<AttioFileEntry, { file_type: "folder" }>;

const workspaceId = "11111111-1111-4111-8111-111111111111";
const objectId = "22222222-2222-4222-8222-222222222222";
const recordId = "33333333-3333-4333-8333-333333333333";
const fileId = "44444444-4444-4444-8444-444444444444";
const folderId = "55555555-5555-4555-8555-555555555555";
const parentFolderId = "66666666-6666-4666-8666-666666666666";

const createMockFile = (overrides: Partial<NativeFile> = {}): NativeFile => ({
  id: {
    workspace_id: workspaceId,
    file_id: fileId,
  },
  object_id: objectId,
  object_slug: "people",
  record_id: recordId,
  storage_provider: "attio",
  created_by_actor: {
    type: "workspace-member",
    id: "77777777-7777-4777-8777-777777777777",
  },
  created_at: "2024-01-01T00:00:00.000000000Z",
  file_type: "file",
  name: "resume.pdf",
  content_type: "application/pdf",
  content_size: 1024,
  parent_folder_id: null,
  ...overrides,
});

const createMockFolder = (
  overrides: Partial<NativeFolder> = {},
): NativeFolder => ({
  id: {
    workspace_id: workspaceId,
    file_id: folderId,
  },
  object_id: objectId,
  object_slug: "people",
  record_id: recordId,
  storage_provider: "attio",
  created_by_actor: {
    type: "workspace-member",
    id: "77777777-7777-4777-8777-777777777777",
  },
  created_at: "2024-01-01T00:00:00.000000000Z",
  file_type: "folder",
  name: "Documents",
  parent_folder_id: null,
  ...overrides,
});

vi.mock("../../src/generated", async () => {
  const actual = await vi.importActual<typeof import("../../src/generated")>(
    "../../src/generated",
  );
  return {
    ...actual,
    getV2Files: getFilesRequest,
    getV2FilesByFileId: getFileByIdRequest,
    getV2FilesByFileIdDownload: downloadFileRequest,
  };
});

vi.mock("../../src/attio/client", () => ({
  resolveAttioClient,
}));

describe("files", () => {
  let listFiles: typeof import("../../src/attio/files").listFiles;
  let listPersonFiles: typeof import("../../src/attio/files").listPersonFiles;
  let getFile: typeof import("../../src/attio/files").getFile;
  let downloadFile: typeof import("../../src/attio/files").downloadFile;
  let getFileDownloadUrl: typeof import("../../src/attio/files").getFileDownloadUrl;
  let createFileId: typeof import("../../src/attio/files").createFileId;
  let createFileObjectId: typeof import("../../src/attio/files").createFileObjectId;
  let createFileRecordId: typeof import("../../src/attio/files").createFileRecordId;
  let createFileParentFolderId: typeof import("../../src/attio/files").createFileParentFolderId;

  beforeAll(async () => {
    ({
      listFiles,
      listPersonFiles,
      getFile,
      downloadFile,
      getFileDownloadUrl,
      createFileId,
      createFileObjectId,
      createFileRecordId,
      createFileParentFolderId,
    } = await import("../../src/attio/files"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resolveAttioClient.mockReturnValue({});
  });

  describe("ID factories", () => {
    it("creates branded file IDs", () => {
      expect(createFileId(fileId)).toBe(fileId);
      expect(createFileObjectId("people")).toBe("people");
      expect(createFileRecordId(recordId)).toBe(recordId);
      expect(createFileParentFolderId(parentFolderId)).toBe(parentFolderId);
    });

    it("throws for empty IDs", () => {
      expect(() => createFileId("")).toThrow("FileId cannot be empty");
      expect(() => createFileObjectId("")).toThrow(
        "File object id cannot be empty",
      );
      expect(() => createFileRecordId("")).toThrow(
        "File record id cannot be empty",
      );
      expect(() => createFileParentFolderId("")).toThrow(
        "File parent folder id cannot be empty",
      );
    });
  });

  describe("listFiles", () => {
    it("maps ergonomic inputs to generated query parameters", async () => {
      const file = createMockFile();
      const object = createFileObjectId("people");
      const record = createFileRecordId(recordId);
      const parentFolder = createFileParentFolderId(parentFolderId);
      getFilesRequest.mockResolvedValue({
        data: { data: [file], pagination: { next_cursor: null } },
      });

      const result = await listFiles({
        object,
        recordId: record,
        storageProvider: "google-drive",
        parentFolderId: parentFolder,
        limit: 25,
        cursor: "cursor-1",
        options: { headers: { "X-Custom": "value" } },
      });

      expect(result).toEqual([file]);
      expect(getFilesRequest).toHaveBeenCalledWith({
        client: {},
        query: {
          object: "people",
          record_id: recordId,
          storage_provider: "google-drive",
          parent_folder_id: parentFolderId,
          limit: 25,
          cursor: "cursor-1",
        },
        headers: { "X-Custom": "value" },
        signal: undefined,
      });
    });

    it("collects cursor pages when pagination is enabled", async () => {
      const file = createMockFile();
      const folder = createMockFolder();
      getFilesRequest
        .mockResolvedValueOnce({
          data: { data: [file], pagination: { next_cursor: "cursor-2" } },
        })
        .mockResolvedValueOnce({
          data: { data: [folder], pagination: { next_cursor: null } },
        });

      const result = await listFiles({
        object: createFileObjectId("people"),
        recordId: createFileRecordId(recordId),
        paginate: true,
        limit: 1,
      });

      expect(result).toEqual([file, folder]);
      expect(getFilesRequest).toHaveBeenNthCalledWith(1, {
        client: {},
        query: {
          object: "people",
          record_id: recordId,
          limit: 1,
        },
        signal: undefined,
      });
      expect(getFilesRequest).toHaveBeenNthCalledWith(2, {
        client: {},
        query: {
          object: "people",
          record_id: recordId,
          limit: 1,
          cursor: "cursor-2",
        },
        signal: undefined,
      });
    });

    it("streams cursor pages when pagination is set to stream", async () => {
      const file = createMockFile();
      const folder = createMockFolder();
      getFilesRequest
        .mockResolvedValueOnce({
          data: { data: [file], pagination: { next_cursor: "cursor-2" } },
        })
        .mockResolvedValueOnce({
          data: { data: [folder], pagination: { next_cursor: null } },
        });

      const stream = listFiles({
        object: createFileObjectId("people"),
        recordId: createFileRecordId(recordId),
        paginate: "stream",
        limit: 1,
      });
      const result: AttioFileEntry[] = [];

      for await (const item of stream) {
        result.push(item);
      }

      expect(result).toEqual([file, folder]);
    });
  });

  describe("listPersonFiles", () => {
    it("uses the people object and maps personId to record_id", async () => {
      const file = createMockFile();
      getFilesRequest.mockResolvedValue({
        data: { data: [file], pagination: { next_cursor: null } },
      });

      const result = await listPersonFiles({
        personId: createFileRecordId(recordId),
        storageProvider: "attio",
      });

      expect(result).toEqual([file]);
      expect(getFilesRequest).toHaveBeenCalledWith({
        client: {},
        query: {
          object: "people",
          record_id: recordId,
          storage_provider: "attio",
        },
        signal: undefined,
      });
    });
  });

  describe("getFile", () => {
    it("returns unwrapped file metadata", async () => {
      const folder = { ...createMockFolder(), has_children: true };
      getFileByIdRequest.mockResolvedValue({ data: folder });

      const result = await getFile({ fileId: createFileId(folderId) });

      expect(result).toEqual(folder);
      expect(getFileByIdRequest).toHaveBeenCalledWith({
        client: {},
        path: { file_id: folderId },
      });
    });
  });

  describe("downloadFile", () => {
    it("downloads file content as an ArrayBuffer by default", async () => {
      const bytes = new Uint8Array([1, 2, 3]).buffer;
      downloadFileRequest.mockResolvedValue({ data: bytes });

      const result = await downloadFile({ fileId: createFileId(fileId) });

      expect(result).toBe(bytes);
      expect(downloadFileRequest).toHaveBeenCalledWith({
        client: {},
        path: { file_id: fileId },
        parseAs: "arrayBuffer",
        responseStyle: "fields",
      });
    });

    it("forwards text parse mode and returns text content", async () => {
      downloadFileRequest.mockResolvedValue({ data: "hello" });

      const result = await downloadFile({
        fileId: createFileId(fileId),
        parseAs: "text",
      });

      expect(result).toBe("hello");
      expect(downloadFileRequest).toHaveBeenCalledWith({
        client: {},
        path: { file_id: fileId },
        parseAs: "text",
        responseStyle: "fields",
      });
    });
  });

  describe("getFileDownloadUrl", () => {
    it("extracts the redirect Location header", async () => {
      const signedUrl = "https://files.example.com/signed";
      downloadFileRequest.mockResolvedValue({
        error: {},
        response: new Response("", {
          status: 302,
          headers: { Location: signedUrl },
        }),
      });

      const result = await getFileDownloadUrl({ fileId: createFileId(fileId) });

      expect(result).toBe(signedUrl);
      expect(downloadFileRequest).toHaveBeenCalledWith({
        client: {},
        path: { file_id: fileId },
        parseAs: "text",
        redirect: "manual",
        responseStyle: "fields",
        throwOnError: false,
      });
    });

    it("throws a clear error when the Location header is unavailable", async () => {
      downloadFileRequest.mockResolvedValue({
        error: {},
        response: new Response("", { status: 302 }),
      });

      await expect(
        getFileDownloadUrl({ fileId: createFileId(fileId) }),
      ).rejects.toThrow("Attio file download URL is unavailable.");
    });
  });
});
