import type { z } from "zod";
import type { Options } from "../generated";
import {
  deleteV2TasksByTaskId,
  getV2Tasks,
  getV2TasksByTaskId,
  patchV2TasksByTaskId,
  postV2Tasks,
} from "../generated";
import { zTask } from "../generated/zod.gen";
import { type AttioClientInput, resolveAttioClient } from "./client";
import { unwrapData, unwrapItems } from "./response";

type Task = z.infer<typeof zTask>;

export interface TaskCreateInput extends AttioClientInput {
  data: Record<string, unknown>;
  options?: Omit<Options, "client" | "body">;
}

export interface TaskUpdateInput extends AttioClientInput {
  taskId: string;
  data: Record<string, unknown>;
  options?: Omit<Options, "client" | "path" | "body">;
}

export interface TaskDeleteInput extends AttioClientInput {
  taskId: string;
  options?: Omit<Options, "client" | "path">;
}

export const listTasks = async (
  input: AttioClientInput = {},
): Promise<Task[]> => {
  const client = resolveAttioClient(input);
  const result = await getV2Tasks({ client });
  return unwrapItems(result, { schema: zTask });
};

export const getTask = async (
  input: { taskId: string } & AttioClientInput,
): Promise<Task> => {
  const client = resolveAttioClient(input);
  const result = await getV2TasksByTaskId({
    client,
    path: { task_id: input.taskId },
  });
  return unwrapData(result, { schema: zTask });
};

export const createTask = async (input: TaskCreateInput): Promise<Task> => {
  const client = resolveAttioClient(input);
  const result = await postV2Tasks({
    client,
    body: {
      data: input.data,
    },
    ...input.options,
  });
  return unwrapData(result, { schema: zTask });
};

export const updateTask = async (input: TaskUpdateInput): Promise<Task> => {
  const client = resolveAttioClient(input);
  const result = await patchV2TasksByTaskId({
    client,
    path: { task_id: input.taskId },
    body: {
      data: input.data,
    },
    ...input.options,
  });
  return unwrapData(result, { schema: zTask });
};

export const deleteTask = async (
  input: TaskDeleteInput,
): Promise<Record<string, unknown>> => {
  const client = resolveAttioClient(input);
  const result = await deleteV2TasksByTaskId({
    client,
    path: { task_id: input.taskId },
    ...input.options,
  });
  return result.data ?? {};
};
