import type { Options } from "../generated";
import {
  deleteV2NotesByNoteId,
  getV2Notes,
  getV2NotesByNoteId,
  postV2Notes,
} from "../generated";
import { type AttioClientInput, resolveAttioClient } from "./client";
import { unwrapData, unwrapItems } from "./response";

export interface NoteCreateInput extends AttioClientInput {
  parentObject: string;
  parentRecordId: string;
  title?: string;
  content?: string;
  options?: Omit<Options, "client" | "body">;
}

export const listNotes = async (input: AttioClientInput = {}) => {
  const client = resolveAttioClient(input);
  const result = await getV2Notes({ client });
  return unwrapItems(result);
};

export const getNote = async (input: { noteId: string } & AttioClientInput) => {
  const client = resolveAttioClient(input);
  const result = await getV2NotesByNoteId({
    client,
    path: { note_id: input.noteId },
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
        content: input.content,
      },
    },
    ...input.options,
  });
  return unwrapData(result);
};

export const deleteNote = async (
  input: { noteId: string } & AttioClientInput,
) => {
  const client = resolveAttioClient(input);
  await deleteV2NotesByNoteId({
    client,
    path: { note_id: input.noteId },
  });
  return true;
};
