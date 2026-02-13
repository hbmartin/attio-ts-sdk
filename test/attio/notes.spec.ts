import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "../../src/generated";

const getNotesRequest = vi.fn();
const getNoteByIdRequest = vi.fn();
const postNotesRequest = vi.fn();
const deleteNoteRequest = vi.fn();
const resolveAttioClient = vi.fn();

const createMockNote = (overrides: Partial<Note> = {}): Note => ({
  id: {
    workspace_id: "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d",
    note_id: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
  },
  parent_object: "companies",
  parent_record_id: "c3d4e5f6-a7b8-4c9d-ae0f-1a2b3c4d5e6f",
  title: "Test note",
  meeting_id: null,
  content_plaintext: "Test note content",
  content_markdown: "Test note content",
  tags: [],
  created_by_actor: {
    type: "workspace-member",
    id: "d4e5f6a7-b8c9-4d0e-af1a-2b3c4d5e6f7a",
  },
  created_at: "2024-01-01T00:00:00.000Z",
  ...overrides,
});

vi.mock("../../src/generated", async () => {
  const actual = await vi.importActual<typeof import("../../src/generated")>(
    "../../src/generated",
  );
  return {
    ...actual,
    getV2Notes: getNotesRequest,
    getV2NotesByNoteId: getNoteByIdRequest,
    postV2Notes: postNotesRequest,
    deleteV2NotesByNoteId: deleteNoteRequest,
  };
});

vi.mock("../../src/attio/client", () => ({
  resolveAttioClient,
}));

describe("notes", () => {
  let listNotes: typeof import("../../src/attio/notes").listNotes;
  let getNote: typeof import("../../src/attio/notes").getNote;
  let createNote: typeof import("../../src/attio/notes").createNote;
  let deleteNote: typeof import("../../src/attio/notes").deleteNote;
  let createNoteId: typeof import("../../src/attio/notes").createNoteId;
  let createNoteParentObjectId: typeof import("../../src/attio/notes").createNoteParentObjectId;
  let createNoteParentRecordId: typeof import("../../src/attio/notes").createNoteParentRecordId;

  beforeAll(async () => {
    ({
      listNotes,
      getNote,
      createNote,
      deleteNote,
      createNoteId,
      createNoteParentObjectId,
      createNoteParentRecordId,
    } = await import("../../src/attio/notes"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resolveAttioClient.mockReturnValue({});
  });

  describe("ID factories", () => {
    it("creates branded note IDs", () => {
      expect(createNoteId("note-1")).toBe("note-1");
      expect(createNoteParentObjectId("companies")).toBe("companies");
      expect(createNoteParentRecordId("rec-1")).toBe("rec-1");
    });

    it("throws for empty IDs", () => {
      expect(() => createNoteId("")).toThrow("NoteId cannot be empty");
      expect(() => createNoteParentObjectId("")).toThrow(
        "Note parent object id cannot be empty",
      );
      expect(() => createNoteParentRecordId("")).toThrow(
        "Note parent record id cannot be empty",
      );
    });
  });

  describe("listNotes", () => {
    it("returns unwrapped items from response", async () => {
      const note1 = createMockNote({
        id: {
          workspace_id: "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d",
          note_id: "11111111-1111-4111-8111-111111111111",
        },
      });
      const note2 = createMockNote({
        id: {
          workspace_id: "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d",
          note_id: "22222222-2222-4222-8222-222222222222",
        },
      });
      const notes = [note1, note2];
      getNotesRequest.mockResolvedValue({ data: { data: notes } });

      const result = await listNotes();

      expect(result).toEqual(notes);
      expect(getNotesRequest).toHaveBeenCalledWith({ client: {} });
    });

    it("passes client input to resolveAttioClient", async () => {
      getNotesRequest.mockResolvedValue({ data: { data: [] } });

      await listNotes({ apiKey: "test-key" });

      expect(resolveAttioClient).toHaveBeenCalledWith({ apiKey: "test-key" });
    });
  });

  describe("getNote", () => {
    it("returns unwrapped note data", async () => {
      const note = createMockNote({ title: "Test note" });
      getNoteByIdRequest.mockResolvedValue({ data: note });

      const result = await getNote({ noteId: "note-1" });

      expect(result).toEqual(note);
      expect(getNoteByIdRequest).toHaveBeenCalledWith({
        client: {},
        path: { note_id: "note-1" },
      });
    });
  });

  describe("createNote", () => {
    it("creates note with all parameters", async () => {
      const newNote = createMockNote({ title: "New note" });
      postNotesRequest.mockResolvedValue({ data: newNote });

      const result = await createNote({
        parentObject: "companies",
        parentRecordId: "rec-123",
        title: "New note",
        content: "Note content",
      });

      expect(result).toEqual(newNote);
      expect(postNotesRequest).toHaveBeenCalledWith({
        client: {},
        body: {
          data: {
            parent_object: "companies",
            parent_record_id: "rec-123",
            title: "New note",
            content: "Note content",
          },
        },
      });
    });

    it("creates note with minimal parameters", async () => {
      const note = createMockNote();
      postNotesRequest.mockResolvedValue({ data: note });

      await createNote({
        parentObject: "people",
        parentRecordId: "rec-456",
      });

      expect(postNotesRequest).toHaveBeenCalledWith({
        client: {},
        body: {
          data: {
            parent_object: "people",
            parent_record_id: "rec-456",
            title: undefined,
            content: undefined,
          },
        },
      });
    });

    it("passes additional options", async () => {
      const note = createMockNote();
      postNotesRequest.mockResolvedValue({ data: note });

      await createNote({
        parentObject: "companies",
        parentRecordId: "rec-123",
        options: { headers: { "X-Custom": "value" } },
      });

      expect(postNotesRequest).toHaveBeenCalledWith({
        client: {},
        body: {
          data: {
            parent_object: "companies",
            parent_record_id: "rec-123",
            title: undefined,
            content: undefined,
          },
        },
        headers: { "X-Custom": "value" },
      });
    });
  });

  describe("deleteNote", () => {
    it("deletes note and returns true", async () => {
      deleteNoteRequest.mockResolvedValue({});

      const result = await deleteNote({ noteId: "note-1" });

      expect(result).toBe(true);
      expect(deleteNoteRequest).toHaveBeenCalledWith({
        client: {},
        path: { note_id: "note-1" },
      });
    });
  });
});
