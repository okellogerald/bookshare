import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  AuthorizationPermission,
  PlatformRole,
} from "@bookshare/shared";
import { CurrentUser, Permissions, Roles } from "../../common/decorators";
import type { AuthenticatedUser } from "../../common/guards";
import {
  AdminPasswordResetDto,
  DeactivateAccountDto,
  DeleteAccountDto,
  UpdateEmailDto,
  UpdateIdentityProfileDto,
  UpdatePasswordDto,
  UpdateProfileDto,
} from "./dto";
import { ProfilesService } from "./profiles.service";

@ApiTags("Profiles")
@ApiBearerAuth()
@Controller("profiles")
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Post("sync")
  sync(
    @CurrentUser() user: AuthenticatedUser,
    @Headers("authorization") authorization: string | undefined,
    @Headers("x-auth-access-token") identityAccessToken: string | undefined
  ) {
    return this.profilesService.sync(user, authorization, identityAccessToken);
  }

  @Get("me")
  findMe(
    @CurrentUser() user: AuthenticatedUser,
    @Headers("authorization") authorization: string | undefined,
    @Headers("x-auth-access-token") identityAccessToken: string | undefined
  ) {
    return this.profilesService.findMe(user, authorization, identityAccessToken);
  }

  @Put("me")
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Headers("authorization") authorization: string | undefined,
    @Headers("x-auth-access-token") identityAccessToken: string | undefined,
    @Body() dto: UpdateProfileDto
  ) {
    return this.profilesService.updateMe(
      user,
      dto,
      authorization,
      identityAccessToken
    );
  }

  @Put("me/identity")
  updateMyIdentity(
    @CurrentUser() user: AuthenticatedUser,
    @Headers("authorization") authorization: string | undefined,
    @Headers("x-auth-access-token") identityAccessToken: string | undefined,
    @Body() dto: UpdateIdentityProfileDto
  ) {
    return this.profilesService.updateMyIdentity(
      user,
      authorization,
      identityAccessToken,
      dto
    );
  }

  @Put("me/email")
  updateMyEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Headers("authorization") authorization: string | undefined,
    @Headers("x-auth-access-token") identityAccessToken: string | undefined,
    @Body() dto: UpdateEmailDto
  ) {
    return this.profilesService.updateMyEmail(
      user,
      authorization,
      identityAccessToken,
      dto
    );
  }

  @Put("me/password")
  updateMyPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Headers("authorization") authorization: string | undefined,
    @Headers("x-auth-access-token") identityAccessToken: string | undefined,
    @Body() dto: UpdatePasswordDto
  ) {
    return this.profilesService.updateMyPassword(
      user,
      authorization,
      identityAccessToken,
      dto
    );
  }

  @Post("me/deactivate")
  deactivateMyAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Headers("authorization") authorization: string | undefined,
    @Headers("x-auth-access-token") identityAccessToken: string | undefined,
    @Body() dto: DeactivateAccountDto
  ) {
    return this.profilesService.deactivateMyAccount(
      user,
      authorization,
      identityAccessToken,
      dto
    );
  }

  @Post("admin/:userId/password-reset")
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_STAFF)
  @Permissions(AuthorizationPermission.IDENTITY_PASSWORD_RESET)
  createAdminPasswordReset(
    @CurrentUser() user: AuthenticatedUser,
    @Param("userId") userId: string,
    @Body() dto: AdminPasswordResetDto
  ) {
    return this.profilesService.createAdminPasswordReset(user, userId, dto);
  }

  @Post("admin/:userId/deactivate")
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_STAFF)
  @Permissions(AuthorizationPermission.IDENTITY_ACCOUNT_DEACTIVATE)
  deactivateMemberAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param("userId") userId: string
  ) {
    return this.profilesService.deactivateMemberAccount(user, userId);
  }

  @Post("admin/:userId/reactivate")
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_STAFF)
  @Permissions(AuthorizationPermission.IDENTITY_ACCOUNT_REACTIVATE)
  reactivateMemberAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param("userId") userId: string
  ) {
    return this.profilesService.reactivateMemberAccount(user, userId);
  }

  @Post("admin/:userId/revoke-sessions")
  @Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_STAFF)
  @Permissions(AuthorizationPermission.IDENTITY_SESSIONS_REVOKE)
  revokeMemberSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Param("userId") userId: string
  ) {
    return this.profilesService.revokeMemberSessions(user, userId);
  }

  @Delete("me")
  deleteMyAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Headers("authorization") authorization: string | undefined,
    @Headers("x-auth-access-token") identityAccessToken: string | undefined,
    @Body() dto: DeleteAccountDto
  ) {
    return this.profilesService.deleteMyAccount(
      user,
      authorization,
      identityAccessToken,
      dto
    );
  }
}
