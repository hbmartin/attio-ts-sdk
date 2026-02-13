import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const getNotesRequest = vi.fn();
const getNoteByIdRequest = vi.fn();
const postNotesRequest = vi.fn();
const deleteNoteRequest = vi.fn();
const resolveAttioClient = vi.fn();

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
      const notes = [{ id: "note-1" }, { id: "note-2" }];
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
      const note = { id: "note-1", title: "Test note" };
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
      const newNote = { id: "note-new", title: "New note" };
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
      postNotesRequest.mockResolvedValue({ data: {} });

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
      postNotesRequest.mockResolvedValue({ data: {} });

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
