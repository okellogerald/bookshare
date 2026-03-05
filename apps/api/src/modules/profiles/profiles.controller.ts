import { Body, Controller, Get, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators";
import type { AuthenticatedUser } from "../../common/guards";
import { UpdateProfileDto } from "./dto";
import { ProfilesService } from "./profiles.service";

@ApiTags("Profiles")
@ApiBearerAuth()
@Controller("profiles")
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Post("sync")
  sync(@CurrentUser() user: AuthenticatedUser) {
    return this.profilesService.sync(user);
  }

  @Get("me")
  findMe(@CurrentUser() user: AuthenticatedUser) {
    return this.profilesService.findMe(user);
  }

  @Put("me")
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto
  ) {
    return this.profilesService.updateMe(user, dto);
  }
}
