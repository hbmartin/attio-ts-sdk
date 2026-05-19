import { z } from "zod";

const looseValueMapSchema = z.record(z.string(), z.array(z.unknown()));

const recordIdSchema = z
  .object({
    workspace_id: z.string(),
    object_id: z.string(),
    record_id: z.string(),
  })
  .passthrough();

const looseRecordDataSchema = z
  .object({
    id: recordIdSchema,
    created_at: z.string(),
    web_url: z.url(),
    values: looseValueMapSchema.nullish(),
  })
  .passthrough();

const looseRecordQueryResponseSchema = z
  .object({
    data: z.array(looseRecordDataSchema),
  })
  .passthrough();

const looseRecordDataResponseSchema = z
  .object({
    data: looseRecordDataSchema,
  })
  .passthrough();

const listEntryIdSchema = z
  .object({
    workspace_id: z.string(),
    list_id: z.string(),
    entry_id: z.string(),
  })
  .passthrough();

const listEntryDataSchema = z
  .object({
    id: listEntryIdSchema,
    parent_record_id: z.string(),
    parent_object: z.string(),
    created_at: z.string(),
    entry_values: looseValueMapSchema.nullish(),
  })
  .passthrough();

const looseListEntryQueryResponseSchema = z
  .object({
    data: z.array(listEntryDataSchema),
  })
  .passthrough();

const looseListEntryMutationResponseSchema = z
  .object({
    data: listEntryDataSchema,
  })
  .passthrough();

const validateRecordQueryResponse = async (data: unknown): Promise<unknown> =>
  looseRecordQueryResponseSchema.parseAsync(data);

const validateRecordDataResponse = async (data: unknown): Promise<unknown> =>
  looseRecordDataResponseSchema.parseAsync(data);

const validateListEntryQueryResponse = async (
  data: unknown,
): Promise<unknown> => looseListEntryQueryResponseSchema.parseAsync(data);

const validateListEntryMutationResponse = async (
  data: unknown,
): Promise<unknown> => looseListEntryMutationResponseSchema.parseAsync(data);

export {
  listEntryDataSchema,
  validateListEntryMutationResponse,
  validateListEntryQueryResponse,
  validateRecordDataResponse,
  validateRecordQueryResponse,
};
