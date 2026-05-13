import type { z } from "zod";
import type {
  DeleteV2TasksByTaskIdData,
  DeleteV2TasksByTaskIdResponse,
  GetV2TasksByTaskIdData,
  GetV2TasksData,
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
import { type BrandedId, createBrandedIdSchema } from "./ids";
import { callAndUnwrapData } from "./operations";
import { resolveOffsetItems } from "./pagination";
import { unwrapItems } from "./response";

type Task = z.infer<typeof zTask>;

type TaskId = BrandedId<"TaskId">;
type TaskCreateData = PostV2TasksData["body"]["data"];
type TaskUpdateData = PatchV2TasksByTaskIdData["body"]["data"];
type TaskListQuery = NonNullable<GetV2TasksData["query"]>;
type TaskListSort = TaskListQuery["sort"];

interface TaskLinkedRecordInput {
  object: NonNullable<TaskListQuery["linked_object"]>;
  recordId: NonNullable<TaskListQuery["linked_record_id"]>;
}

const taskIdSchema = createBrandedIdSchema<"TaskId">("TaskId");

const createTaskId = (id: string): TaskId => taskIdSchema.parse(id);

interface TaskCreateInput extends AttioClientInput {
  data: TaskCreateData;
  options?: Omit<Options<PostV2TasksData>, "client" | "body">;
}

interface TaskUpdateInput extends AttioClientInput {
  taskId: TaskId;
  data: TaskUpdateData;
  options?: Omit<Options<PatchV2TasksByTaskIdData>, "client" | "path" | "body">;
}

interface TaskDeleteInput extends AttioClientInput {
  taskId: TaskId;
  options?: Omit<Options<DeleteV2TasksByTaskIdData>, "client" | "path">;
}

interface TaskGetInput extends AttioClientInput {
  taskId: TaskId;
  options?: Omit<Options<GetV2TasksByTaskIdData>, "client" | "path">;
}

interface TaskListBaseInput extends AttioClientInput {
  limit?: TaskListQuery["limit"];
  offset?: TaskListQuery["offset"];
  sort?: TaskListSort;
  assignee?: TaskListQuery["assignee"];
  isCompleted?: TaskListQuery["is_completed"];
  linkedRecord?: TaskLinkedRecordInput;
  signal?: AbortSignal;
  options?: Omit<Options<GetV2TasksData>, "client" | "query">;
}

interface TaskListSingleInput extends TaskListBaseInput {
  paginate?: false;
}

interface TaskListCollectInput extends TaskListBaseInput {
  paginate: true;
  maxPages?: number;
  maxItems?: number;
}

interface TaskListStreamInput extends TaskListBaseInput {
  paginate: "stream";
  maxPages?: number;
  maxItems?: number;
}

type TaskListInput =
  | TaskListSingleInput
  | TaskListCollectInput
  | TaskListStreamInput;

const hasDefinedQueryValue = (query: TaskListQuery): boolean =>
  Object.values(query).some((value) => value !== undefined);

const buildTaskListQuery = (
  input: TaskListBaseInput,
  offset?: number,
  limit?: number,
): TaskListQuery | undefined => {
  const query: TaskListQuery = {
    limit,
    offset,
    sort: input.sort,
    linked_object: input.linkedRecord?.object,
    linked_record_id: input.linkedRecord?.recordId,
    assignee: input.assignee,
    is_completed: input.isCompleted,
  };

  return hasDefinedQueryValue(query) ? query : undefined;
};

export function listTasks(input: TaskListStreamInput): AsyncIterable<Task>;
export function listTasks(
  input?: TaskListSingleInput | TaskListCollectInput,
): Promise<Task[]>;
export function listTasks(
  input: TaskListInput,
): Promise<Task[]> | AsyncIterable<Task>;
export function listTasks(
  input: TaskListInput = {},
): Promise<Task[]> | AsyncIterable<Task> {
  const client = resolveAttioClient(input);

  const fetchTasks = async (
    offset?: number,
    limit?: number,
    signal?: AbortSignal,
  ): Promise<Task[]> => {
    const result = await getV2Tasks({
      client,
      query: buildTaskListQuery(input, offset, limit),
      ...input.options,
      signal,
    });

    return unwrapItems<Task>(result, { schema: zTask });
  };

  return resolveOffsetItems(fetchTasks, input);
}

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

export type {
  TaskCreateData,
  TaskCreateInput,
  TaskDeleteInput,
  TaskGetInput,
  TaskId,
  TaskLinkedRecordInput,
  TaskListBaseInput,
  TaskListCollectInput,
  TaskListInput,
  TaskListSingleInput,
  TaskListSort,
  TaskListStreamInput,
  TaskUpdateData,
  TaskUpdateInput,
};
export { createTaskId, taskIdSchema };
