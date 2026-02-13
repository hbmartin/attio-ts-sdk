import {
  getV2WorkspaceMembers,
  getV2WorkspaceMembersByWorkspaceMemberId,
} from "../generated";
import type { AttioClientInput } from "./client";
import { type BrandedId, createBrandedId } from "./ids";
import { callAndUnwrapData, callAndUnwrapItems } from "./operations";

type WorkspaceMemberId = BrandedId<"WorkspaceMemberId">;

const createWorkspaceMemberId = (id: string): WorkspaceMemberId =>
  createBrandedId<"WorkspaceMemberId">(id, "WorkspaceMemberId");

interface WorkspaceMemberInput extends AttioClientInput {
  workspaceMemberId: WorkspaceMemberId;
}

export { createWorkspaceMemberId };
export type { WorkspaceMemberId };

export const listWorkspaceMembers = async (input: AttioClientInput = {}) =>
  callAndUnwrapItems(input, (client) => getV2WorkspaceMembers({ client }));

export const getWorkspaceMember = async (input: WorkspaceMemberInput) =>
  callAndUnwrapData(input, (client) =>
    getV2WorkspaceMembersByWorkspaceMemberId({
      client,
      path: { workspace_member_id: input.workspaceMemberId },
    }),
  );
