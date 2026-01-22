import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const getTasksRequest = vi.fn();
const getTaskByIdRequest = vi.fn();
const postTasksRequest = vi.fn();
const patchTaskRequest = vi.fn();
const deleteTaskRequest = vi.fn();
const resolveAttioClient = vi.fn();

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

  beforeAll(async () => {
    ({ listTasks, getTask, createTask, updateTask, deleteTask } = await import(
      "../../src/attio/tasks"
    ));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resolveAttioClient.mockReturnValue({});
  });

  describe("listTasks", () => {
    it("returns unwrapped items from response", async () => {
      const tasks = [{ id: "task-1" }, { id: "task-2" }];
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
      const task = { id: "task-1", content: "Test task" };
      getTaskByIdRequest.mockResolvedValue({ data: task });

      const result = await getTask({ taskId: "task-1" });

      expect(result).toEqual(task);
      expect(getTaskByIdRequest).toHaveBeenCalledWith({
        client: {},
        path: { task_id: "task-1" },
      });
    });
  });

  describe("createTask", () => {
    it("creates task with provided data", async () => {
      const newTask = { id: "task-new", content: "New task" };
      postTasksRequest.mockResolvedValue({ data: newTask });

      const result = await createTask({
        data: { content: "New task" },
      });

      expect(result).toEqual(newTask);
      expect(postTasksRequest).toHaveBeenCalledWith({
        client: {},
        body: { data: { content: "New task" } },
      });
    });

    it("passes additional options", async () => {
      postTasksRequest.mockResolvedValue({ data: {} });

      await createTask({
        data: { content: "Task" },
        options: { headers: { "X-Custom": "value" } },
      });

      expect(postTasksRequest).toHaveBeenCalledWith({
        client: {},
        body: { data: { content: "Task" } },
        headers: { "X-Custom": "value" },
      });
    });
  });

  describe("updateTask", () => {
    it("updates task with provided data", async () => {
      const updatedTask = { id: "task-1", content: "Updated task" };
      patchTaskRequest.mockResolvedValue({ data: updatedTask });

      const result = await updateTask({
        taskId: "task-1",
        data: { content: "Updated task" },
      });

      expect(result).toEqual(updatedTask);
      expect(patchTaskRequest).toHaveBeenCalledWith({
        client: {},
        path: { task_id: "task-1" },
        body: { data: { content: "Updated task" } },
      });
    });

    it("passes additional options", async () => {
      patchTaskRequest.mockResolvedValue({ data: {} });

      await updateTask({
        taskId: "task-1",
        data: { status: "completed" },
        options: { headers: { "X-Custom": "value" } },
      });

      expect(patchTaskRequest).toHaveBeenCalledWith({
        client: {},
        path: { task_id: "task-1" },
        body: { data: { status: "completed" } },
        headers: { "X-Custom": "value" },
      });
    });
  });

  describe("deleteTask", () => {
    it("deletes task and returns true", async () => {
      deleteTaskRequest.mockResolvedValue({});

      const result = await deleteTask({ taskId: "task-1" });

      expect(result).toBe(true);
      expect(deleteTaskRequest).toHaveBeenCalledWith({
        client: {},
        path: { task_id: "task-1" },
      });
    });
  });
});
