import type { z } from "zod";
import type {
  DeleteV2TasksByTaskIdData,
  DeleteV2TasksByTaskIdResponse,
  GetV2TasksByTaskIdData,
  Options,
  PatchV2TasksByTaskIdData,
  PostV2TasksData,
} from "../generated";
import {
  deleteV2TasksByTaskId,
  getV2Tasks,
  getV2TasksByTaskId,
  patchV2TasksByTaskId,
  postV2Tasks,
} from "../generated";
import { zTask } from "../generated/zod.gen";
import { type AttioClientInput, resolveAttioClient } from "./client";
import { type BrandedId, createBrandedId } from "./ids";
import { callAndUnwrapData, callAndUnwrapItems } from "./operations";

type Task = z.infer<typeof zTask>;

type TaskId = BrandedId<"TaskId">;
type TaskCreateData = PostV2TasksData["body"]["data"];
type TaskUpdateData = PatchV2TasksByTaskIdData["body"]["data"];

const createTaskId = (id: string): TaskId =>
  createBrandedId<"TaskId">(id, "TaskId");

export interface TaskCreateInput extends AttioClientInput {
  data: TaskCreateData;
  options?: Omit<Options<PostV2TasksData>, "client" | "body">;
}

export interface TaskUpdateInput extends AttioClientInput {
  taskId: TaskId;
  data: TaskUpdateData;
  options?: Omit<Options<PatchV2TasksByTaskIdData>, "client" | "path" | "body">;
}

export interface TaskDeleteInput extends AttioClientInput {
  taskId: TaskId;
  options?: Omit<Options<DeleteV2TasksByTaskIdData>, "client" | "path">;
}

export interface TaskGetInput extends AttioClientInput {
  taskId: TaskId;
  options?: Omit<Options<GetV2TasksByTaskIdData>, "client" | "path">;
}

export const listTasks = async (
  input: AttioClientInput = {},
): Promise<Task[]> =>
  callAndUnwrapItems(input, (client) => getV2Tasks({ client }), {
    schema: zTask,
  });

export const getTask = async (input: TaskGetInput): Promise<Task> =>
  callAndUnwrapData(
    input,
    (client) =>
      getV2TasksByTaskId({
        client,
        path: { task_id: input.taskId },
        ...input.options,
      }),
    { schema: zTask },
  );

export const createTask = async (input: TaskCreateInput): Promise<Task> =>
  callAndUnwrapData(
    input,
    (client) =>
      postV2Tasks({
        client,
        body: { data: input.data },
        ...input.options,
      }),
    { schema: zTask },
  );

export const updateTask = async (input: TaskUpdateInput): Promise<Task> =>
  callAndUnwrapData(
    input,
    (client) =>
      patchV2TasksByTaskId({
        client,
        path: { task_id: input.taskId },
        body: { data: input.data },
        ...input.options,
      }),
    { schema: zTask },
  );

export const deleteTask = async (
  input: TaskDeleteInput,
): Promise<DeleteV2TasksByTaskIdResponse> => {
  const client = resolveAttioClient(input);
  const result = await deleteV2TasksByTaskId({
    client,
    path: { task_id: input.taskId },
    ...input.options,
  });
  return result.data ?? {};
};

export { createTaskId };
export type { TaskCreateData, TaskId, TaskUpdateData };
