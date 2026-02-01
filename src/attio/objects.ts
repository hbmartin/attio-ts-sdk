import { z } from "zod";
import type { Object as AttioObject, Options } from "../generated";
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

const AttioObjectSchema = z
  .object({
    id: z.object({ workspace_id: z.string(), object_id: z.string() }),
    api_slug: z.string(),
    singular_noun: z.string(),
    plural_noun: z.string(),
    created_at: z.string(),
  })
  .passthrough();

const AttioObjectArraySchema = z.array(AttioObjectSchema);

interface ListObjectsInput extends AttioClientInput {
  options?: Omit<Options, "client">;
}

interface GetObjectInput extends AttioClientInput {
  object: ObjectSlug;
  options?: Omit<Options, "client" | "path">;
}

interface CreateObjectInput extends AttioClientInput {
  apiSlug: ObjectApiSlug;
  singularNoun: ObjectNoun;
  pluralNoun: ObjectNoun;
  options?: Omit<Options, "client" | "body">;
}

interface UpdateObjectInput extends AttioClientInput {
  object: ObjectSlug;
  apiSlug?: ObjectApiSlug;
  singularNoun?: ObjectNoun;
  pluralNoun?: ObjectNoun;
  options?: Omit<Options, "client" | "path" | "body">;
}

const listObjects = async (
  input: ListObjectsInput = {},
): Promise<AttioObject[]> => {
  const client = resolveAttioClient(input);
  const result = await getV2Objects({ client, ...input.options });
  const items = unwrapItems<AttioObject>(result);
  return AttioObjectArraySchema.parse(items) as AttioObject[];
};

const getObject = async (input: GetObjectInput): Promise<AttioObject> => {
  const client = resolveAttioClient(input);
  const result = await getV2ObjectsByObject({
    client,
    path: { object: input.object },
    ...input.options,
  });
  const data = unwrapData<AttioObject>(result);
  return AttioObjectSchema.parse(data) as AttioObject;
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
  const data = unwrapData<AttioObject>(result);
  return AttioObjectSchema.parse(data) as AttioObject;
};

const buildUpdateObjectData = (
  input: UpdateObjectInput,
): Record<string, string> => {
  const data: Record<string, string> = {};
  if (input.apiSlug !== undefined) {
    data.api_slug = input.apiSlug;
  }
  if (input.singularNoun !== undefined) {
    data.singular_noun = input.singularNoun;
  }
  if (input.pluralNoun !== undefined) {
    data.plural_noun = input.pluralNoun;
  }
  return data;
};

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
  const data = unwrapData<AttioObject>(result);
  return AttioObjectSchema.parse(data) as AttioObject;
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
