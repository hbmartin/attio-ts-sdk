import { z } from "zod";
import type {
  Object as AttioObject,
  GetV2ObjectsByObjectData,
  GetV2ObjectsData,
  Options,
  PatchV2ObjectsByObjectData,
  PostV2ObjectsData,
} from "../generated";
import {
  getV2Objects,
  getV2ObjectsByObject,
  patchV2ObjectsByObject,
  postV2Objects,
} from "../generated";
import { type AttioClientInput, resolveAttioClient } from "./client";
import { unwrapData, unwrapItems } from "./response";

type ObjectSlug = string & { readonly __brand: "ObjectSlug" };
type ObjectApiSlug = string & { readonly __brand: "ObjectApiSlug" };
type ObjectNoun = string & { readonly __brand: "ObjectNoun" };
type ObjectUpdateData = PatchV2ObjectsByObjectData["body"]["data"];

const AttioObjectSchema: z.ZodType<AttioObject> = z
  .object({
    id: z.object({ workspace_id: z.string(), object_id: z.string() }),
    api_slug: z.string(),
    singular_noun: z.string(),
    plural_noun: z.string(),
    created_at: z.string(),
  })
  .passthrough();

interface ListObjectsInput extends AttioClientInput {
  options?: Omit<Options<GetV2ObjectsData>, "client">;
}

interface GetObjectInput extends AttioClientInput {
  object: ObjectSlug;
  options?: Omit<Options<GetV2ObjectsByObjectData>, "client" | "path">;
}

interface CreateObjectInput extends AttioClientInput {
  apiSlug: ObjectApiSlug;
  singularNoun: ObjectNoun;
  pluralNoun: ObjectNoun;
  options?: Omit<Options<PostV2ObjectsData>, "client" | "body">;
}

interface UpdateObjectInput extends AttioClientInput {
  object: ObjectSlug;
  apiSlug?: ObjectApiSlug;
  singularNoun?: ObjectNoun;
  pluralNoun?: ObjectNoun;
  options?: Omit<
    Options<PatchV2ObjectsByObjectData>,
    "client" | "path" | "body"
  >;
}

const listObjects = async (
  input: ListObjectsInput = {},
): Promise<AttioObject[]> => {
  const client = resolveAttioClient(input);
  const result = await getV2Objects({ client, ...input.options });
  return unwrapItems(result, { schema: AttioObjectSchema });
};

const getObject = async (input: GetObjectInput): Promise<AttioObject> => {
  const client = resolveAttioClient(input);
  const result = await getV2ObjectsByObject({
    client,
    path: { object: input.object },
    ...input.options,
  });
  return unwrapData(result, { schema: AttioObjectSchema });
};

const createObject = async (input: CreateObjectInput): Promise<AttioObject> => {
  const client = resolveAttioClient(input);
  const result = await postV2Objects({
    client,
    body: {
      data: {
        api_slug: input.apiSlug,
        singular_noun: input.singularNoun,
        plural_noun: input.pluralNoun,
      },
    },
    ...input.options,
  });
  return unwrapData(result, { schema: AttioObjectSchema });
};

const buildUpdateObjectData = (input: UpdateObjectInput): ObjectUpdateData => ({
  ...(input.apiSlug !== undefined && { api_slug: input.apiSlug }),
  ...(input.singularNoun !== undefined && {
    singular_noun: input.singularNoun,
  }),
  ...(input.pluralNoun !== undefined && { plural_noun: input.pluralNoun }),
});

const updateObject = async (input: UpdateObjectInput): Promise<AttioObject> => {
  const client = resolveAttioClient(input);
  const result = await patchV2ObjectsByObject({
    client,
    path: { object: input.object },
    body: {
      data: buildUpdateObjectData(input),
    },
    ...input.options,
  });
  return unwrapData(result, { schema: AttioObjectSchema });
};

export type {
  CreateObjectInput,
  GetObjectInput,
  ListObjectsInput,
  ObjectApiSlug,
  ObjectNoun,
  ObjectSlug,
  UpdateObjectInput,
};
export { createObject, getObject, listObjects, updateObject };
