import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  AuthGuard,
  CurrentUser,
  Roles,
  RolesGuard,
  type AuthenticatedUser,
} from "../../common/auth";
import {
  CreateOrganizationDto,
  CreateOrganizationInviteDto,
  UpdateOrganizationDto,
} from "./dto";
import { OrganizationsService } from "./organizations.service";

@UseGuards(AuthGuard, RolesGuard)
@Controller()
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get("organizations/me")
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.getMe(user);
  }

  @Post("organizations/invites/:inviteId/accept")
  acceptInvite(
    @Param("inviteId") inviteId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.organizationsService.acceptInvite(inviteId, user);
  }

  @Get("organizations/:organizationId")
  getOne(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.organizationsService.getOne(organizationId, user);
  }

  @Patch("organizations/:organizationId")
  update(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateOrganizationDto
  ) {
    return this.organizationsService.update(organizationId, user, dto);
  }

  @Get("organizations/:organizationId/members")
  listMembers(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.organizationsService.listMembers(organizationId, user);
  }

  @Post("organizations/:organizationId/invites")
  createInvite(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrganizationInviteDto
  ) {
    return this.organizationsService.createInvite(organizationId, user, dto);
  }

  @Delete("organizations/:organizationId/invites/:inviteId")
  revokeInvite(
    @Param("organizationId") organizationId: string,
    @Param("inviteId") inviteId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.organizationsService.revokeInvite(organizationId, inviteId, user);
  }

  @Get("admin/organizations")
  @Roles("platform_admin")
  adminList() {
    return this.organizationsService.adminList();
  }

  @Post("admin/organizations")
  @Roles("platform_admin")
  adminCreate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrganizationDto
  ) {
    return this.organizationsService.adminCreate(user, dto);
  }

  @Post("admin/organizations/:organizationId/invites")
  @Roles("platform_admin")
  adminInvite(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrganizationInviteDto
  ) {
    return this.organizationsService.adminInvite(organizationId, user, dto);
  }
}
