"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookstoreMembershipRole,
  type AdminBookstoreDetail,
  type AdminBookstoreSummary,
  type BookstoreDetail,
  type BookstoreMembersResponse,
  type BookstoreProposalSummary,
  type BookstorePublicProfile,
  type BookstoreWantRow,
  type BookstoresBootstrapResponse,
} from "@bookshare/shared";
import { nestjsFetch } from "@/shared/lib/fetch";

interface BookstoreWantsQuery {
  search?: string;
  proposalState?: "all" | "not_proposed" | "proposed";
  sort?: "latest_activity_desc" | "oldest_created_asc" | "title_asc";
}

interface CreateBookstoreInput {
  name: string;
  websiteUrl?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  instagram?: string;
  address?: string;
  contactNote?: string;
}

type UpdateBookstoreInput = Partial<CreateBookstoreInput>;

interface CreateProposalInput {
  wishId: string;
  message?: string;
}

interface CreateInviteInput {
  email: string;
}

interface UpdateMemberRoleInput {
  userId: string;
  role: BookstoreMembershipRole;
}

interface ManageMemberPermissionInput {
  userId: string;
  permission: string;
}

interface AdminBookstoresQuery {
  status?: string;
  query?: string;
}

interface AdminUpdateBookstoreStatusInput {
  status: string;
  reviewNote?: string;
}

const bookstoreKeys = {
  root: ["bookstores"] as const,
  me: ["bookstores", "me"] as const,
  detail: (bookstoreId: string) => ["bookstores", bookstoreId] as const,
  wants: (bookstoreId: string, query: BookstoreWantsQuery) =>
    [
      "bookstores",
      bookstoreId,
      "wants",
      query.search ?? "",
      query.proposalState ?? "all",
      query.sort ?? "latest_activity_desc",
    ] as const,
  want: (bookstoreId: string, wishId: string) =>
    ["bookstores", bookstoreId, "wants", wishId] as const,
  members: (bookstoreId: string) =>
    ["bookstores", bookstoreId, "members"] as const,
  publicProfile: (bookstoreId: string) =>
    ["bookstores", "public", bookstoreId] as const,
  adminList: (query: AdminBookstoresQuery) =>
    ["admin-bookstores", query.status ?? "all", query.query ?? ""] as const,
  adminDetail: (bookstoreId: string) =>
    ["admin-bookstores", bookstoreId] as const,
};

function toSearchParams(query: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const normalized = value?.trim();
    if (normalized) {
      params.set(key, normalized);
    }
  }
  return params.toString();
}

async function fetchBookstoresMe() {
  return nestjsFetch<BookstoresBootstrapResponse>("bookstores/me", "GET");
}

async function fetchBookstore(bookstoreId: string) {
  return nestjsFetch<BookstoreDetail>(`bookstores/${bookstoreId}`, "GET");
}

async function fetchBookstoreWants(
  bookstoreId: string,
  query: BookstoreWantsQuery
) {
  const suffix = toSearchParams({
    search: query.search,
    proposalState: query.proposalState,
    sort: query.sort,
  });
  return nestjsFetch<BookstoreWantRow[]>(
    `bookstores/${bookstoreId}/wants${suffix ? `?${suffix}` : ""}`,
    "GET"
  );
}

async function fetchBookstoreWant(bookstoreId: string, wishId: string) {
  return nestjsFetch<BookstoreWantRow>(
    `bookstores/${bookstoreId}/wants/${wishId}`,
    "GET"
  );
}

async function fetchBookstoreMembers(bookstoreId: string) {
  return nestjsFetch<BookstoreMembersResponse>(
    `bookstores/${bookstoreId}/members`,
    "GET"
  );
}

async function fetchBookstorePublicProfile(bookstoreId: string) {
  return nestjsFetch<BookstorePublicProfile>(
    `bookstores/public/${bookstoreId}`,
    "GET"
  );
}

async function fetchAdminBookstores(query: AdminBookstoresQuery) {
  const suffix = toSearchParams({
    status: query.status,
    query: query.query,
  });
  return nestjsFetch<AdminBookstoreSummary[]>(
    `bookstores/admin${suffix ? `?${suffix}` : ""}`,
    "GET"
  );
}

async function fetchAdminBookstore(bookstoreId: string) {
  return nestjsFetch<AdminBookstoreDetail>(
    `bookstores/admin/${bookstoreId}`,
    "GET"
  );
}

export function useBookstoresMe(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: bookstoreKeys.me,
    queryFn: fetchBookstoresMe,
    enabled: options?.enabled ?? true,
  });
}

export function useCreateBookstore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBookstoreInput) =>
      nestjsFetch<BookstoreDetail>("bookstores", "POST", input),
    onSuccess: async (bookstore) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: bookstoreKeys.me }),
        queryClient.invalidateQueries({ queryKey: bookstoreKeys.detail(bookstore.id) }),
      ]);
    },
  });
}

export function useAcceptBookstoreInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      nestjsFetch<BookstoresBootstrapResponse>(
        `bookstores/invites/${inviteId}/accept`,
        "POST"
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: bookstoreKeys.me });
    },
  });
}

export function useBookstore(bookstoreId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: bookstoreKeys.detail(bookstoreId),
    queryFn: () => fetchBookstore(bookstoreId),
    enabled: options?.enabled ?? true,
  });
}

export function useUpdateBookstore(bookstoreId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBookstoreInput) =>
      nestjsFetch<BookstoreDetail>(`bookstores/${bookstoreId}`, "PATCH", input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: bookstoreKeys.me }),
        queryClient.invalidateQueries({ queryKey: bookstoreKeys.detail(bookstoreId) }),
        queryClient.invalidateQueries({ queryKey: bookstoreKeys.publicProfile(bookstoreId) }),
      ]);
    },
  });
}

export function useResubmitBookstore(bookstoreId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      nestjsFetch<BookstoreDetail>(`bookstores/${bookstoreId}/resubmit`, "POST"),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: bookstoreKeys.me }),
        queryClient.invalidateQueries({ queryKey: bookstoreKeys.detail(bookstoreId) }),
      ]);
    },
  });
}

export function useBookstoreWants(
  bookstoreId: string,
  query: BookstoreWantsQuery,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: bookstoreKeys.wants(bookstoreId, query),
    queryFn: () => fetchBookstoreWants(bookstoreId, query),
    enabled: options?.enabled ?? true,
  });
}

export function useBookstoreWant(
  bookstoreId: string,
  wishId: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: bookstoreKeys.want(bookstoreId, wishId),
    queryFn: () => fetchBookstoreWant(bookstoreId, wishId),
    enabled: options?.enabled ?? true,
  });
}

export function useCreateBookstoreProposal(bookstoreId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProposalInput) =>
      nestjsFetch<BookstoreProposalSummary>(
        `bookstores/${bookstoreId}/proposals`,
        "POST",
        input
      ),
    onSuccess: async (_proposal, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["bookstores", bookstoreId, "wants"] }),
        queryClient.invalidateQueries({
          queryKey: bookstoreKeys.want(bookstoreId, variables.wishId),
        }),
        queryClient.invalidateQueries({ queryKey: bookstoreKeys.detail(bookstoreId) }),
      ]);
    },
  });
}

export function useWithdrawBookstoreProposal(bookstoreId: string, wishId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) =>
      nestjsFetch<BookstoreProposalSummary>(
        `bookstores/${bookstoreId}/proposals/${proposalId}`,
        "DELETE"
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["bookstores", bookstoreId, "wants"] }),
        queryClient.invalidateQueries({ queryKey: bookstoreKeys.want(bookstoreId, wishId) }),
        queryClient.invalidateQueries({ queryKey: bookstoreKeys.detail(bookstoreId) }),
      ]);
    },
  });
}

export function useBookstoreMembers(
  bookstoreId: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: bookstoreKeys.members(bookstoreId),
    queryFn: () => fetchBookstoreMembers(bookstoreId),
    enabled: options?.enabled ?? true,
  });
}

export function useCreateOrganizationInvite(bookstoreId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInviteInput) =>
      nestjsFetch<{ id: string; invitedEmail: string; createdAt: string }>(
        `bookstores/${bookstoreId}/invites`,
        "POST",
        input
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: bookstoreKeys.members(bookstoreId) });
    },
  });
}

export function useRevokeOrganizationInvite(bookstoreId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      nestjsFetch<{ id: string; status: string; revokedAt: string | null }>(
        `bookstores/${bookstoreId}/invites/${inviteId}`,
        "DELETE"
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: bookstoreKeys.members(bookstoreId) });
    },
  });
}

export function useUpdateOrganizationMemberRole(bookstoreId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateMemberRoleInput) =>
      nestjsFetch<{ userId: string; role: BookstoreMembershipRole }>(
        `bookstores/${bookstoreId}/members/${input.userId}/role`,
        "PATCH",
        { role: input.role }
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: bookstoreKeys.members(bookstoreId) }),
        queryClient.invalidateQueries({ queryKey: bookstoreKeys.detail(bookstoreId) }),
      ]);
    },
  });
}

export function useGrantMemberPermission(bookstoreId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ManageMemberPermissionInput) =>
      nestjsFetch<{ ok: true; alreadyGranted: boolean }>(
        `bookstores/${bookstoreId}/members/${input.userId}/permissions`,
        "POST",
        { permission: input.permission }
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: bookstoreKeys.members(bookstoreId),
      });
    },
  });
}

export function useRevokeMemberPermission(bookstoreId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ManageMemberPermissionInput) =>
      nestjsFetch<{ ok: true }>(
        `bookstores/${bookstoreId}/members/${input.userId}/permissions`,
        "DELETE",
        { permission: input.permission }
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: bookstoreKeys.members(bookstoreId),
      });
    },
  });
}

export function useRemoveOrganizationMember(bookstoreId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      nestjsFetch<{ ok: true; userId: string }>(
        `bookstores/${bookstoreId}/members/${userId}`,
        "DELETE"
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: bookstoreKeys.members(bookstoreId) }),
        queryClient.invalidateQueries({ queryKey: bookstoreKeys.detail(bookstoreId) }),
        queryClient.invalidateQueries({ queryKey: bookstoreKeys.me }),
      ]);
    },
  });
}

export function useBookstorePublicProfile(
  bookstoreId: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: bookstoreId
      ? bookstoreKeys.publicProfile(bookstoreId)
      : ["bookstores", "public", "none"],
    queryFn: () => fetchBookstorePublicProfile(bookstoreId!),
    enabled: !!bookstoreId && (options?.enabled ?? true),
  });
}

export function useAdminBookstores(
  query: AdminBookstoresQuery,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: bookstoreKeys.adminList(query),
    queryFn: () => fetchAdminBookstores(query),
    enabled: options?.enabled ?? true,
  });
}

export function useAdminBookstore(bookstoreId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: bookstoreId
      ? bookstoreKeys.adminDetail(bookstoreId)
      : ["admin-bookstores", "none"],
    queryFn: () => fetchAdminBookstore(bookstoreId!),
    enabled: !!bookstoreId && (options?.enabled ?? true),
  });
}

export function useAdminUpdateBookstoreStatus(bookstoreId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminUpdateBookstoreStatusInput) =>
      nestjsFetch<AdminBookstoreDetail>(
        `bookstores/admin/${bookstoreId}/status`,
        "PATCH",
        input
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-bookstores"] }),
        queryClient.invalidateQueries({ queryKey: bookstoreKeys.adminDetail(bookstoreId) }),
      ]);
    },
  });
}
