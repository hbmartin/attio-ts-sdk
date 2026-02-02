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
import { type AttioClientInput, resolveAttioClient } from "./client";
import { unwrapData, unwrapItems } from "./response";

type NoteId = string & { readonly __brand: "NoteId" };
type NoteParentObjectId = string & { readonly __brand: "NoteParentObjectId" };
type NoteParentRecordId = string & { readonly __brand: "NoteParentRecordId" };
type NoteFormat = PostV2NotesData["body"]["data"]["format"];

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

export const listNotes = async (input: AttioClientInput = {}) => {
  const client = resolveAttioClient(input);
  const result = await getV2Notes({ client });
  return unwrapItems(result);
};

export const getNote = async (input: NoteGetInput) => {
  const client = resolveAttioClient(input);
  const result = await getV2NotesByNoteId({
    client,
    path: { note_id: input.noteId },
    ...input.options,
  });
  return unwrapData(result);
};

export const createNote = async (input: NoteCreateInput) => {
  const client = resolveAttioClient(input);
  const result = await postV2Notes({
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
  });
  return unwrapData(result);
};

export const deleteNote = async (input: NoteDeleteInput) => {
  const client = resolveAttioClient(input);
  await deleteV2NotesByNoteId({
    client,
    path: { note_id: input.noteId },
    ...input.options,
  });
  return true;
};

export type { NoteFormat, NoteId, NoteParentObjectId, NoteParentRecordId };
