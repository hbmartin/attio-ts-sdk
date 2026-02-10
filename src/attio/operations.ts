import type { ZodType } from "zod";
import { z } from "zod";
import type { AttioClient, AttioClientInput } from "./client";
import { resolveAttioClient } from "./client";
import {
  assertOk,
  unwrapData,
  unwrapItems,
  validateItemsArray,
  validateWithSchema,
} from "./response";

const unknownRecordSchema = z.record(z.string(), z.unknown());
const unknownRecordArraySchema = z.array(unknownRecordSchema);

interface BaseOperationInput<
  TInput extends AttioClientInput,
  TResult = unknown,
> {
  input: TInput;
  request: (client: AttioClient) => Promise<TResult>;
}

interface DataOperationInput<
  TInput extends AttioClientInput,
  TOutput,
  TResult = unknown,
> extends BaseOperationInput<TInput, TResult> {
  schema?: ZodType<TOutput>;
}

interface ItemsOperationInput<
  TInput extends AttioClientInput,
  TOutput,
  TResult = unknown,
> extends BaseOperationInput<TInput, TResult> {
  schema?: ZodType<TOutput>;
}

interface ValidatedDataOperationInput<
  TInput extends AttioClientInput,
  TOutput,
  TResult = unknown,
> extends BaseOperationInput<TInput, TResult> {
  normalize: (item: Record<string, unknown>) => unknown;
  schema: ZodType<TOutput>;
}

interface ValidatedItemsOperationInput<
  TInput extends AttioClientInput,
  TOutput,
  TResult = unknown,
> extends BaseOperationInput<TInput, TResult> {
  normalize: (items: Record<string, unknown>[]) => unknown[];
  schema: ZodType<TOutput>;
}

const executeRawOperation = <
  TInput extends AttioClientInput,
  TResult = unknown,
>({
  input,
  request,
}: BaseOperationInput<TInput, TResult>): Promise<TResult> => {
  const client = resolveAttioClient(input);
  return request(client);
};

function executeDataOperation<
  TInput extends AttioClientInput,
  TOutput,
  TResult = unknown,
>(
  input: DataOperationInput<TInput, TOutput, TResult> & {
    schema: ZodType<TOutput>;
  },
): Promise<TOutput>;
function executeDataOperation<
  TInput extends AttioClientInput,
  TOutput = unknown,
  TResult = unknown,
>(input: DataOperationInput<TInput, TOutput, TResult>): Promise<TOutput>;
async function executeDataOperation<
  TInput extends AttioClientInput,
  TOutput,
  TResult = unknown,
>(input: DataOperationInput<TInput, TOutput, TResult>): Promise<TOutput> {
  const result = await executeRawOperation(input);
  if (input.schema) {
    return unwrapData(result, { schema: input.schema });
  }
  return unwrapData(result);
}

function executeItemsOperation<
  TInput extends AttioClientInput,
  TOutput,
  TResult = unknown,
>(
  input: ItemsOperationInput<TInput, TOutput, TResult> & {
    schema: ZodType<TOutput>;
  },
): Promise<TOutput[]>;
function executeItemsOperation<
  TInput extends AttioClientInput,
  TOutput = unknown,
  TResult = unknown,
>(input: ItemsOperationInput<TInput, TOutput, TResult>): Promise<TOutput[]>;
async function executeItemsOperation<
  TInput extends AttioClientInput,
  TOutput,
  TResult = unknown,
>(input: ItemsOperationInput<TInput, TOutput, TResult>): Promise<TOutput[]> {
  const result = await executeRawOperation(input);
  if (input.schema) {
    return unwrapItems(result, { schema: input.schema });
  }
  return unwrapItems(result);
}

const executeValidatedDataOperation = async <
  TInput extends AttioClientInput,
  TOutput,
  TResult = unknown,
>({
  input,
  request,
  normalize,
  schema,
}: ValidatedDataOperationInput<TInput, TOutput, TResult>): Promise<TOutput> => {
  const result = await executeRawOperation({ input, request });
  const rawItem = unknownRecordSchema.parse(assertOk(result));
  const normalizedItem = normalize(rawItem);
  return validateWithSchema(normalizedItem, schema);
};

const executeValidatedItemsOperation = async <
  TInput extends AttioClientInput,
  TOutput,
  TResult = unknown,
>({
  input,
  request,
  normalize,
  schema,
}: ValidatedItemsOperationInput<TInput, TOutput, TResult>): Promise<
  TOutput[]
> => {
  const result = await executeRawOperation({ input, request });
  const rawItems = unknownRecordArraySchema.parse(unwrapItems(result));
  const normalizedItems = normalize(rawItems);
  return validateItemsArray(normalizedItems, schema);
};

export {
  executeDataOperation,
  executeItemsOperation,
  executeRawOperation,
  executeValidatedDataOperation,
  executeValidatedItemsOperation,
};
export type {
  BaseOperationInput,
  DataOperationInput,
  ItemsOperationInput,
  ValidatedDataOperationInput,
  ValidatedItemsOperationInput,
};
