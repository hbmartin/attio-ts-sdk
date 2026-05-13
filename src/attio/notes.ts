import type { z } from "zod";
import type {
  DeleteV2NotesByNoteIdData,
  GetV2NotesByNoteIdData,
  GetV2NotesData,
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
import { type AttioClientInput, resolveAttioClient } from "./client";
import { type BrandedId, createBrandedIdSchema } from "./ids";
import { callAndDelete, callAndUnwrapData } from "./operations";
import { resolveOffsetItems } from "./pagination";
import { unwrapItems } from "./response";

type Note = z.infer<typeof zNote>;

type NoteId = BrandedId<"NoteId">;
type NoteParentObjectId = BrandedId<"NoteParentObjectId">;
type NoteParentRecordId = BrandedId<"NoteParentRecordId">;
type NoteFormat = PostV2NotesData["body"]["data"]["format"];
type NoteListQuery = NonNullable<GetV2NotesData["query"]>;

const noteIdSchema = createBrandedIdSchema<"NoteId">("NoteId");
const noteParentObjectIdSchema = createBrandedIdSchema<"NoteParentObjectId">(
  "Note parent object id",
);
const noteParentRecordIdSchema = createBrandedIdSchema<"NoteParentRecordId">(
  "Note parent record id",
);

const createNoteId = (id: string): NoteId => noteIdSchema.parse(id);
const createNoteParentObjectId = (id: string): NoteParentObjectId =>
  noteParentObjectIdSchema.parse(id);
const createNoteParentRecordId = (id: string): NoteParentRecordId =>
  noteParentRecordIdSchema.parse(id);

interface NoteCreateInput extends AttioClientInput {
  parentObject: NoteParentObjectId;
  parentRecordId: NoteParentRecordId;
  title: string;
  format: NoteFormat;
  content: string;
  createdAt?: PostV2NotesData["body"]["data"]["created_at"];
  meetingId?: PostV2NotesData["body"]["data"]["meeting_id"];
  options?: Omit<Options<PostV2NotesData>, "client" | "body">;
}

interface NoteGetInput extends AttioClientInput {
  noteId: NoteId;
  options?: Omit<Options<GetV2NotesByNoteIdData>, "client" | "path">;
}

interface NoteDeleteInput extends AttioClientInput {
  noteId: NoteId;
  options?: Omit<Options<DeleteV2NotesByNoteIdData>, "client" | "path">;
}

interface NoteListBaseInput extends AttioClientInput {
  parentObject?: NoteParentObjectId;
  parentRecordId?: NoteParentRecordId;
  limit?: NoteListQuery["limit"];
  offset?: NoteListQuery["offset"];
  signal?: AbortSignal;
  options?: Omit<Options<GetV2NotesData>, "client" | "query">;
}

interface NoteListSingleInput extends NoteListBaseInput {
  paginate?: false;
}

interface NoteListCollectInput extends NoteListBaseInput {
  paginate: true;
  maxPages?: number;
  maxItems?: number;
}

interface NoteListStreamInput extends NoteListBaseInput {
  paginate: "stream";
  maxPages?: number;
  maxItems?: number;
}

type NoteListInput =
  | NoteListSingleInput
  | NoteListCollectInput
  | NoteListStreamInput;

const hasDefinedQueryValue = (query: NoteListQuery): boolean =>
  Object.values(query).some((value) => value !== undefined);

const buildNoteListQuery = (
  input: NoteListBaseInput,
  offset?: number,
  limit?: number,
): NoteListQuery | undefined => {
  const query: NoteListQuery = {
    limit,
    offset,
    parent_object: input.parentObject,
    parent_record_id: input.parentRecordId,
  };

  return hasDefinedQueryValue(query) ? query : undefined;
};

export function listNotes(input: NoteListStreamInput): AsyncIterable<Note>;
export function listNotes(
  input?: NoteListSingleInput | NoteListCollectInput,
): Promise<Note[]>;
export function listNotes(
  input: NoteListInput,
): Promise<Note[]> | AsyncIterable<Note>;
export function listNotes(
  input: NoteListInput = {},
): Promise<Note[]> | AsyncIterable<Note> {
  const client = resolveAttioClient(input);

  const fetchNotes = async (
    offset?: number,
    limit?: number,
    signal?: AbortSignal,
  ): Promise<Note[]> => {
    const result = await getV2Notes({
      client,
      query: buildNoteListQuery(input, offset, limit),
      ...input.options,
      signal,
    });

    return unwrapItems<Note>(result, { schema: zNote });
  };

  return resolveOffsetItems(fetchNotes, input);
}

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

export type {
  NoteCreateInput,
  NoteDeleteInput,
  NoteFormat,
  NoteGetInput,
  NoteId,
  NoteListBaseInput,
  NoteListCollectInput,
  NoteListInput,
  NoteListSingleInput,
  NoteListStreamInput,
  NoteParentObjectId,
  NoteParentRecordId,
};
export {
  createNoteId,
  createNoteParentObjectId,
  createNoteParentRecordId,
  noteIdSchema,
  noteParentObjectIdSchema,
  noteParentRecordIdSchema,
};
