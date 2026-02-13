import type { z } from "zod";
import type {
  DeleteV2NotesByNoteIdData,
  GetV2NotesByNoteIdData,
  Options,
  PostV2NotesData,
} from "../generated";
import {
  deleteV2NotesByNoteId,
  getV2Notes,
  getV2NotesByNoteId,
  postV2Notes,
} from "../generated";
import { zNote } from "../generated/zod.gen";
import type { AttioClientInput } from "./client";
import { type BrandedId, createBrandedId } from "./ids";
import {
  callAndDelete,
  callAndUnwrapData,
  callAndUnwrapItems,
} from "./operations";

type Note = z.infer<typeof zNote>;

type NoteId = BrandedId<"NoteId">;
type NoteParentObjectId = BrandedId<"NoteParentObjectId">;
type NoteParentRecordId = BrandedId<"NoteParentRecordId">;
type NoteFormat = PostV2NotesData["body"]["data"]["format"];

const createNoteId = (id: string): NoteId =>
  createBrandedId<"NoteId">(id, "NoteId");
const createNoteParentObjectId = (id: string): NoteParentObjectId =>
  createBrandedId<"NoteParentObjectId">(id, "Note parent object id");
const createNoteParentRecordId = (id: string): NoteParentRecordId =>
  createBrandedId<"NoteParentRecordId">(id, "Note parent record id");

export interface NoteCreateInput extends AttioClientInput {
  parentObject: NoteParentObjectId;
  parentRecordId: NoteParentRecordId;
  title: string;
  format: NoteFormat;
  content: string;
  createdAt?: PostV2NotesData["body"]["data"]["created_at"];
  meetingId?: PostV2NotesData["body"]["data"]["meeting_id"];
  options?: Omit<Options<PostV2NotesData>, "client" | "body">;
}

export interface NoteGetInput extends AttioClientInput {
  noteId: NoteId;
  options?: Omit<Options<GetV2NotesByNoteIdData>, "client" | "path">;
}

export interface NoteDeleteInput extends AttioClientInput {
  noteId: NoteId;
  options?: Omit<Options<DeleteV2NotesByNoteIdData>, "client" | "path">;
}

export const listNotes = async (
  input: AttioClientInput = {},
): Promise<Note[]> =>
  callAndUnwrapItems(input, (client) => getV2Notes({ client }), {
    schema: zNote,
  });

export const getNote = async (input: NoteGetInput): Promise<Note> =>
  callAndUnwrapData(
    input,
    (client) =>
      getV2NotesByNoteId({
        client,
        path: { note_id: input.noteId },
        ...input.options,
      }),
    { schema: zNote },
  );

export const createNote = async (input: NoteCreateInput): Promise<Note> =>
  callAndUnwrapData(
    input,
    (client) =>
      postV2Notes({
        client,
        body: {
          data: {
            parent_object: input.parentObject,
            parent_record_id: input.parentRecordId,
            title: input.title,
            format: input.format,
            content: input.content,
            created_at: input.createdAt,
            meeting_id: input.meetingId,
          },
        },
        ...input.options,
      }),
    { schema: zNote },
  );

export const deleteNote = async (input: NoteDeleteInput): Promise<true> =>
  callAndDelete(input, (client) =>
    deleteV2NotesByNoteId({
      client,
      path: { note_id: input.noteId },
      ...input.options,
    }),
  );

export { createNoteId, createNoteParentObjectId, createNoteParentRecordId };
export type { NoteFormat, NoteId, NoteParentObjectId, NoteParentRecordId };
