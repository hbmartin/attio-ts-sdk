import type { Object as AttioObject, Options } from "../generated";
import {
  getV2Objects,
  getV2ObjectsByObject,
  patchV2ObjectsByObject,
  postV2Objects,
} from "../generated";
import { type AttioClientInput, resolveAttioClient } from "./client";
import { unwrapData, unwrapItems } from "./response";

interface ListObjectsInput extends AttioClientInput {
  options?: Omit<Options, "client">;
}

interface GetObjectInput extends AttioClientInput {
  object: string;
  options?: Omit<Options, "client" | "path">;
}

interface CreateObjectInput extends AttioClientInput {
  apiSlug: string;
  singularNoun: string;
  pluralNoun: string;
  options?: Omit<Options, "client" | "body">;
}

interface UpdateObjectInput extends AttioClientInput {
  object: string;
  apiSlug?: string;
  singularNoun?: string;
  pluralNoun?: string;
  options?: Omit<Options, "client" | "path" | "body">;
}

const listObjects = async (
  input: ListObjectsInput = {},
): Promise<AttioObject[]> => {
  const client = resolveAttioClient(input);
  const result = await getV2Objects({ client, ...input.options });
  return unwrapItems<AttioObject>(result);
};

const getObject = async (input: GetObjectInput): Promise<AttioObject> => {
  const client = resolveAttioClient(input);
  const result = await getV2ObjectsByObject({
    client,
    path: { object: input.object },
    ...input.options,
  });
  return unwrapData<AttioObject>(result);
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
  return unwrapData<AttioObject>(result);
};

const updateObject = async (input: UpdateObjectInput): Promise<AttioObject> => {
  const client = resolveAttioClient(input);
  const result = await patchV2ObjectsByObject({
    client,
    path: { object: input.object },
    body: {
      data: {
        api_slug: input.apiSlug,
        singular_noun: input.singularNoun,
        plural_noun: input.pluralNoun,
      },
    },
    ...input.options,
  });
  return unwrapData<AttioObject>(result);
};

export type {
  CreateObjectInput,
  GetObjectInput,
  ListObjectsInput,
  UpdateObjectInput,
};
export { createObject, getObject, listObjects, updateObject };
