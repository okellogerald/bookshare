import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  AuthorizationPermission,
  PlatformRole,
} from "@bookshare/shared";
import { CurrentUser, Permissions, Roles } from "../../common/decorators";
import type { AuthenticatedUser } from "../../common/guards";
import { ManagePermissionGrantDto, ManageStaffRoleDto } from "./dto";
import { StaffService } from "./staff.service";

@ApiTags("Staff")
@ApiBearerAuth()
@Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_STAFF)
@Controller("staff")
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @Permissions(AuthorizationPermission.STAFF_DIRECTORY_READ)
  list(@Query("query") query?: string) {
    return this.staffService.listDirectory(query);
  }

  @Get("search")
  @Permissions(AuthorizationPermission.STAFF_DIRECTORY_READ)
  search(@Query("query") query?: string) {
    return this.staffService.searchIdentities(query);
  }

  @Get("permissions")
  @Permissions(AuthorizationPermission.STAFF_DIRECTORY_READ)
  listPermissionGrants(@Query("userId") userId: string) {
    return this.staffService.listPermissionGrants(userId);
  }

  @Post("roles")
  @Permissions(AuthorizationPermission.STAFF_ROLE_MANAGE)
  grantRole(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ManageStaffRoleDto
  ) {
    return this.staffService.grantRole(user, dto);
  }

  @Delete("roles")
  @Permissions(AuthorizationPermission.STAFF_ROLE_MANAGE)
  revokeRole(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ManageStaffRoleDto
  ) {
    return this.staffService.revokeRole(user, dto);
  }

  @Post("permissions")
  @Permissions(AuthorizationPermission.STAFF_PERMISSION_MANAGE)
  grantPermission(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ManagePermissionGrantDto
  ) {
    return this.staffService.grantPermission(user, dto);
  }

  @Delete("permissions")
  @Permissions(AuthorizationPermission.STAFF_PERMISSION_MANAGE)
  revokePermission(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ManagePermissionGrantDto
  ) {
    return this.staffService.revokePermission(user, dto);
  }
}
