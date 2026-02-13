import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const getMembersRequest = vi.fn();
const getMemberByIdRequest = vi.fn();
const resolveAttioClient = vi.fn();

vi.mock("../../src/generated", async () => {
  const actual = await vi.importActual<typeof import("../../src/generated")>(
    "../../src/generated",
  );
  return {
    ...actual,
    getV2WorkspaceMembers: getMembersRequest,
    getV2WorkspaceMembersByWorkspaceMemberId: getMemberByIdRequest,
  };
});

vi.mock("../../src/attio/client", () => ({
  resolveAttioClient,
}));

describe("workspace-members", () => {
  let listWorkspaceMembers: typeof import("../../src/attio/workspace-members").listWorkspaceMembers;
  let getWorkspaceMember: typeof import("../../src/attio/workspace-members").getWorkspaceMember;
  let createWorkspaceMemberId: typeof import("../../src/attio/workspace-members").createWorkspaceMemberId;

  beforeAll(async () => {
    ({ listWorkspaceMembers, getWorkspaceMember, createWorkspaceMemberId } =
      await import("../../src/attio/workspace-members"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resolveAttioClient.mockReturnValue({});
  });

  describe("createWorkspaceMemberId", () => {
    it("creates a branded WorkspaceMemberId", () => {
      expect(createWorkspaceMemberId("member-1")).toBe("member-1");
    });

    it("throws when WorkspaceMemberId is empty", () => {
      expect(() => createWorkspaceMemberId("")).toThrow(
        "WorkspaceMemberId cannot be empty",
      );
    });
  });

  describe("listWorkspaceMembers", () => {
    it("returns unwrapped items from response", async () => {
      const members = [
        { id: "member-1", email: "user1@example.com" },
        { id: "member-2", email: "user2@example.com" },
      ];
      getMembersRequest.mockResolvedValue({ data: { data: members } });

      const result = await listWorkspaceMembers();

      expect(result).toEqual(members);
      expect(getMembersRequest).toHaveBeenCalledWith({ client: {} });
    });

    it("passes client input to resolveAttioClient", async () => {
      getMembersRequest.mockResolvedValue({ data: { data: [] } });

      await listWorkspaceMembers({ apiKey: "test-key" });

      expect(resolveAttioClient).toHaveBeenCalledWith({ apiKey: "test-key" });
    });
  });

  describe("getWorkspaceMember", () => {
    it("returns unwrapped member data", async () => {
      const member = { id: "member-1", email: "user@example.com" };
      getMemberByIdRequest.mockResolvedValue({ data: member });

      const result = await getWorkspaceMember({
        workspaceMemberId: createWorkspaceMemberId("member-1"),
      });

      expect(result).toEqual(member);
      expect(getMemberByIdRequest).toHaveBeenCalledWith({
        client: {},
        path: { workspace_member_id: "member-1" },
      });
    });

    it("passes client input to resolveAttioClient", async () => {
      getMemberByIdRequest.mockResolvedValue({ data: {} });

      await getWorkspaceMember({
        workspaceMemberId: createWorkspaceMemberId("member-1"),
        apiKey: "test-key",
      });

      expect(resolveAttioClient).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: "test-key" }),
      );
    });
  });
});
