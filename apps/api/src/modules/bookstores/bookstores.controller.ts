import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  AuthorizationPermission,
  PlatformRole,
} from "@bookshare/shared";
import {
  CurrentUser,
  Permissions,
  Public,
  Roles,
} from "../../common/decorators";
import type { AuthenticatedUser } from "../../common/guards";
import {
  CreateAdminBookstoreDto,
  CreateBookstoreDto,
  CreateBookstoreProposalDto,
  CreateOrganizationInviteDto,
  ListAdminBookstoresQueryDto,
  ListBookstoreWantsQueryDto,
  ManageOrganizationPermissionDto,
  UpdateAdminBookstoreOwnerDto,
  UpdateAdminBookstoreStatusDto,
  UpdateBookstoreDto,
  UpdateOrganizationMemberRoleDto,
} from "./dto";
import { BookstoresService } from "./bookstores.service";

@ApiTags("Bookstores")
@ApiBearerAuth()
@Controller("bookstores")
export class BookstoresController {
  constructor(private readonly bookstoresService: BookstoresService) {}

  @Public()
  @Get("public/:bookstoreId")
  getPublicProfile(@Param("bookstoreId") bookstoreId: string) {
    return this.bookstoresService.getPublicProfile(bookstoreId);
  }

  @Get("me")
  getMyBookstores(@CurrentUser() user: AuthenticatedUser) {
    return this.bookstoresService.getMyBookstores(user);
  }

  @Post()
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_STAFF)
  @Permissions(AuthorizationPermission.BOOKSTORE_STATUS_MANAGE)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBookstoreDto
  ) {
    return this.bookstoresService.create(user, dto);
  }

  @Get("admin")
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_STAFF)
  @Permissions(AuthorizationPermission.BOOKSTORE_DIRECTORY_READ)
  adminList(@Query() query: ListAdminBookstoresQueryDto) {
    return this.bookstoresService.adminList(query);
  }

  @Post("admin")
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_STAFF)
  @Permissions(AuthorizationPermission.BOOKSTORE_STATUS_MANAGE)
  adminCreate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAdminBookstoreDto
  ) {
    return this.bookstoresService.adminCreateWithOwner(user, dto);
  }

  @Get("admin/:bookstoreId")
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_STAFF)
  @Permissions(AuthorizationPermission.BOOKSTORE_DIRECTORY_READ)
  adminGet(@Param("bookstoreId") bookstoreId: string) {
    return this.bookstoresService.adminGet(bookstoreId);
  }

  @Patch("admin/:bookstoreId/status")
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_STAFF)
  @Permissions(AuthorizationPermission.BOOKSTORE_STATUS_MANAGE)
  adminUpdateStatus(
    @Param("bookstoreId") bookstoreId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAdminBookstoreStatusDto
  ) {
    return this.bookstoresService.adminUpdateStatus(bookstoreId, user, dto);
  }

  @Patch("admin/:bookstoreId")
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_STAFF)
  @Permissions(AuthorizationPermission.BOOKSTORE_STATUS_MANAGE)
  adminUpdate(
    @Param("bookstoreId") bookstoreId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBookstoreDto
  ) {
    return this.bookstoresService.adminUpdateBookstore(bookstoreId, user, dto);
  }

  @Patch("admin/:bookstoreId/owner")
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_STAFF)
  @Permissions(AuthorizationPermission.BOOKSTORE_OWNER_MANAGE)
  adminUpdateOwner(
    @Param("bookstoreId") bookstoreId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAdminBookstoreOwnerDto
  ) {
    return this.bookstoresService.adminUpdateOwner(bookstoreId, user, dto);
  }

  @Post("admin/:bookstoreId/owner/resend-email")
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_STAFF)
  @Permissions(
    AuthorizationPermission.BOOKSTORE_OWNER_MANAGE,
    AuthorizationPermission.IDENTITY_PASSWORD_RESET
  )
  adminResendOwnerEmail(@Param("bookstoreId") bookstoreId: string) {
    return this.bookstoresService.adminResendOwnerEmail(bookstoreId);
  }

  @Post("invites/:inviteId/accept")
  acceptInvite(
    @Param("inviteId") inviteId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.bookstoresService.acceptInvite(inviteId, user);
  }

  @Get(":bookstoreId")
  getOne(
    @Param("bookstoreId") bookstoreId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.bookstoresService.getOne(bookstoreId, user);
  }

  @Patch(":bookstoreId")
  update(
    @Param("bookstoreId") bookstoreId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBookstoreDto
  ) {
    return this.bookstoresService.update(bookstoreId, user, dto);
  }

  @Post(":bookstoreId/resubmit")
  resubmit(
    @Param("bookstoreId") bookstoreId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.bookstoresService.resubmit(bookstoreId, user);
  }

  @Get(":bookstoreId/wants")
  listWants(
    @Param("bookstoreId") bookstoreId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListBookstoreWantsQueryDto
  ) {
    return this.bookstoresService.listWants(bookstoreId, user, query);
  }

  @Get(":bookstoreId/wants/:wishId")
  getWant(
    @Param("bookstoreId") bookstoreId: string,
    @Param("wishId") wishId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.bookstoresService.getWant(bookstoreId, wishId, user);
  }

  @Post(":bookstoreId/proposals")
  createProposal(
    @Param("bookstoreId") bookstoreId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBookstoreProposalDto
  ) {
    return this.bookstoresService.createProposal(bookstoreId, user, dto);
  }

  @Delete(":bookstoreId/proposals/:proposalId")
  withdrawProposal(
    @Param("bookstoreId") bookstoreId: string,
    @Param("proposalId") proposalId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.bookstoresService.withdrawProposal(bookstoreId, proposalId, user);
  }

  @Get(":bookstoreId/members")
  listMembers(
    @Param("bookstoreId") bookstoreId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.bookstoresService.listMembers(bookstoreId, user);
  }

  @Post(":bookstoreId/invites")
  createInvite(
    @Param("bookstoreId") bookstoreId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrganizationInviteDto
  ) {
    return this.bookstoresService.createInvite(bookstoreId, user, dto);
  }

  @Delete(":bookstoreId/invites/:inviteId")
  revokeInvite(
    @Param("bookstoreId") bookstoreId: string,
    @Param("inviteId") inviteId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.bookstoresService.revokeInvite(bookstoreId, inviteId, user);
  }

  @Patch(":bookstoreId/members/:userId/role")
  updateMemberRole(
    @Param("bookstoreId") bookstoreId: string,
    @Param("userId") targetUserId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateOrganizationMemberRoleDto
  ) {
    return this.bookstoresService.updateMemberRole(
      bookstoreId,
      targetUserId,
      user,
      dto
    );
  }

  @Patch(":bookstoreId/members/:userId/suspend")
  suspendMember(
    @Param("bookstoreId") bookstoreId: string,
    @Param("userId") targetUserId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.bookstoresService.suspendMember(bookstoreId, targetUserId, user);
  }

  @Patch(":bookstoreId/members/:userId/restore")
  restoreMember(
    @Param("bookstoreId") bookstoreId: string,
    @Param("userId") targetUserId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.bookstoresService.restoreMember(bookstoreId, targetUserId, user);
  }

  @Delete(":bookstoreId/members/:userId")
  removeMember(
    @Param("bookstoreId") bookstoreId: string,
    @Param("userId") targetUserId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.bookstoresService.removeMember(bookstoreId, targetUserId, user);
  }

  @Get(":bookstoreId/members/:userId/permissions")
  listMemberPermissions(
    @Param("bookstoreId") bookstoreId: string,
    @Param("userId") targetUserId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.bookstoresService.listMemberPermissions(
      bookstoreId,
      targetUserId,
      user
    );
  }

  @Post(":bookstoreId/members/:userId/permissions")
  grantMemberPermission(
    @Param("bookstoreId") bookstoreId: string,
    @Param("userId") targetUserId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ManageOrganizationPermissionDto
  ) {
    return this.bookstoresService.grantMemberPermission(
      bookstoreId,
      targetUserId,
      user,
      dto
    );
  }

  @Delete(":bookstoreId/members/:userId/permissions")
  revokeMemberPermission(
    @Param("bookstoreId") bookstoreId: string,
    @Param("userId") targetUserId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ManageOrganizationPermissionDto
  ) {
    return this.bookstoresService.revokeMemberPermission(
      bookstoreId,
      targetUserId,
      user,
      dto
    );
  }
}
