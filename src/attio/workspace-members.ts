import {
  getV2WorkspaceMembers,
  getV2WorkspaceMembersByWorkspaceMemberId,
} from "../generated";
import { resolveAttioClient, type AttioClientInput } from "./client";
import { unwrapData, unwrapItems } from "./response";

export const listWorkspaceMembers = async (input: AttioClientInput = {}) => {
  const client = resolveAttioClient(input);
  const result = await getV2WorkspaceMembers({ client });
  return unwrapItems(result);
};

export const getWorkspaceMember = async (
  input: { workspaceMemberId: string } & AttioClientInput,
) => {
  const client = resolveAttioClient(input);
  const result = await getV2WorkspaceMembersByWorkspaceMemberId({
    client,
    path: { workspace_member_id: input.workspaceMemberId },
  });
  return unwrapData(result);
};
