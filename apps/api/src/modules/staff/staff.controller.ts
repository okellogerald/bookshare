import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PlatformRole } from "@bookshare/shared";
import { CurrentUser, Roles } from "../../common/decorators";
import type { AuthenticatedUser } from "../../common/guards";
import { ManageStaffRoleDto } from "./dto";
import { StaffService } from "./staff.service";

@ApiTags("Staff")
@ApiBearerAuth()
@Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_STAFF)
@Controller("staff")
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  list(@Query("query") query?: string) {
    return this.staffService.listDirectory(query);
  }

  @Get("search")
  search(@Query("query") query?: string) {
    return this.staffService.searchIdentities(query);
  }

  @Post("roles")
  @Roles(PlatformRole.PLATFORM_ADMIN)
  grantRole(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ManageStaffRoleDto
  ) {
    return this.staffService.grantRole(user, dto);
  }

  @Delete("roles")
  @Roles(PlatformRole.PLATFORM_ADMIN)
  revokeRole(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ManageStaffRoleDto
  ) {
    return this.staffService.revokeRole(user, dto);
  }
}
