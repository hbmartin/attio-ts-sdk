import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "../../src/generated";

const getTasksRequest = vi.fn();
const getTaskByIdRequest = vi.fn();
const postTasksRequest = vi.fn();
const patchTaskRequest = vi.fn();
const deleteTaskRequest = vi.fn();
const resolveAttioClient = vi.fn();

const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: {
    workspace_id: "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d",
    task_id: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
  },
  content_plaintext: "Test task content",
  deadline_at: null,
  is_completed: false,
  linked_records: [],
  assignees: [],
  created_by_actor: {
    type: "workspace-member",
    id: "c3d4e5f6-a7b8-4c9d-ae0f-1a2b3c4d5e6f",
  },
  created_at: "2024-01-01T00:00:00.000Z",
  ...overrides,
});

vi.mock("../../src/generated", async () => {
  const actual = await vi.importActual<typeof import("../../src/generated")>(
    "../../src/generated",
  );
  return {
    ...actual,
    getV2Tasks: getTasksRequest,
    getV2TasksByTaskId: getTaskByIdRequest,
    postV2Tasks: postTasksRequest,
    patchV2TasksByTaskId: patchTaskRequest,
    deleteV2TasksByTaskId: deleteTaskRequest,
  };
});

vi.mock("../../src/attio/client", () => ({
  resolveAttioClient,
}));

describe("tasks", () => {
  let listTasks: typeof import("../../src/attio/tasks").listTasks;
  let getTask: typeof import("../../src/attio/tasks").getTask;
  let createTask: typeof import("../../src/attio/tasks").createTask;
  let updateTask: typeof import("../../src/attio/tasks").updateTask;
  let deleteTask: typeof import("../../src/attio/tasks").deleteTask;
  let createTaskId: typeof import("../../src/attio/tasks").createTaskId;

  beforeAll(async () => {
    ({ listTasks, getTask, createTask, updateTask, deleteTask, createTaskId } =
      await import("../../src/attio/tasks"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resolveAttioClient.mockReturnValue({});
  });

  describe("createTaskId", () => {
    it("creates a branded TaskId", () => {
      expect(createTaskId("task-1")).toBe("task-1");
    });

    it("throws when TaskId is empty", () => {
      expect(() => createTaskId("")).toThrow("TaskId cannot be empty");
    });
  });

  describe("listTasks", () => {
    it("returns unwrapped items from response", async () => {
      const task1 = createMockTask({
        id: {
          workspace_id: "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d",
          task_id: "11111111-1111-4111-8111-111111111111",
        },
      });
      const task2 = createMockTask({
        id: {
          workspace_id: "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d",
          task_id: "22222222-2222-4222-8222-222222222222",
        },
      });
      const tasks = [task1, task2];
      getTasksRequest.mockResolvedValue({ data: { data: tasks } });

      const result = await listTasks();

      expect(result).toEqual(tasks);
      expect(getTasksRequest).toHaveBeenCalledWith({ client: {} });
    });

    it("passes client input to resolveAttioClient", async () => {
      getTasksRequest.mockResolvedValue({ data: { data: [] } });

      await listTasks({ apiKey: "test-key" });

      expect(resolveAttioClient).toHaveBeenCalledWith({ apiKey: "test-key" });
    });
  });

  describe("getTask", () => {
    it("returns unwrapped task data", async () => {
      const task = createMockTask({
        content_plaintext: "Test task",
      });
      getTaskByIdRequest.mockResolvedValue({ data: task });

      const result = await getTask({
        taskId: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
      });

      expect(result).toEqual(task);
      expect(getTaskByIdRequest).toHaveBeenCalledWith({
        client: {},
        path: { task_id: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e" },
      });
    });
  });

  describe("createTask", () => {
    it("creates task with provided data", async () => {
      const newTask = createMockTask({
        content_plaintext: "New task",
      });
      postTasksRequest.mockResolvedValue({ data: newTask });

      const result = await createTask({
        data: { content_plaintext: "New task" },
      });

      expect(result).toEqual(newTask);
      expect(postTasksRequest).toHaveBeenCalledWith({
        client: {},
        body: { data: { content_plaintext: "New task" } },
      });
    });

    it("passes additional options", async () => {
      const task = createMockTask();
      postTasksRequest.mockResolvedValue({ data: task });

      await createTask({
        data: { content_plaintext: "Task" },
        options: { headers: { "X-Custom": "value" } },
      });

      expect(postTasksRequest).toHaveBeenCalledWith({
        client: {},
        body: { data: { content_plaintext: "Task" } },
        headers: { "X-Custom": "value" },
      });
    });
  });

  describe("updateTask", () => {
    it("updates task with provided data", async () => {
      const updatedTask = createMockTask({
        content_plaintext: "Updated task",
      });
      patchTaskRequest.mockResolvedValue({ data: updatedTask });

      const result = await updateTask({
        taskId: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
        data: { content_plaintext: "Updated task" },
      });

      expect(result).toEqual(updatedTask);
      expect(patchTaskRequest).toHaveBeenCalledWith({
        client: {},
        path: { task_id: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e" },
        body: { data: { content_plaintext: "Updated task" } },
      });
    });

    it("passes additional options", async () => {
      const task = createMockTask({ is_completed: true });
      patchTaskRequest.mockResolvedValue({ data: task });

      await updateTask({
        taskId: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
        data: { is_completed: true },
        options: { headers: { "X-Custom": "value" } },
      });

      expect(patchTaskRequest).toHaveBeenCalledWith({
        client: {},
        path: { task_id: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e" },
        body: { data: { is_completed: true } },
        headers: { "X-Custom": "value" },
      });
    });
  });

  describe("deleteTask", () => {
    it("deletes task and returns API result", async () => {
      deleteTaskRequest.mockResolvedValue({ data: {} });

      const result = await deleteTask({ taskId: "task-1" });

      expect(result).toEqual({});
      expect(deleteTaskRequest).toHaveBeenCalledWith({
        client: {},
        path: { task_id: "task-1" },
      });
    });
  });
});
