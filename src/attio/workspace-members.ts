import {
  getV2WorkspaceMembers,
  getV2WorkspaceMembersByWorkspaceMemberId,
} from "../generated";
import { type AttioClientInput, resolveAttioClient } from "./client";
import { type BrandedId, createBrandedId } from "./ids";
import { unwrapData, unwrapItems } from "./response";

type WorkspaceMemberId = BrandedId<"WorkspaceMemberId">;

const createWorkspaceMemberId = (id: string): WorkspaceMemberId =>
  createBrandedId<"WorkspaceMemberId">(id, "WorkspaceMemberId");

interface WorkspaceMemberInput extends AttioClientInput {
  workspaceMemberId: WorkspaceMemberId;
}

export const listWorkspaceMembers = async (input: AttioClientInput = {}) => {
  const client = resolveAttioClient(input);
  const result = await getV2WorkspaceMembers({ client });
  return unwrapItems(result);
};

export const getWorkspaceMember = async (input: WorkspaceMemberInput) => {
  const client = resolveAttioClient(input);
  const result = await getV2WorkspaceMembersByWorkspaceMemberId({
    client,
    path: { workspace_member_id: input.workspaceMemberId },
  });
  return unwrapData(result);
};

export { createWorkspaceMemberId };
export type { WorkspaceMemberId };
