import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@bookshare/shared";
import { CurrentUser, Roles } from "../../common/decorators";
import type { AuthenticatedUser } from "../../common/guards";
import {
  ApproveCopySubmissionDto,
  ApproveWantSubmissionDto,
  CreateCopySubmissionDto,
  CreateMissingWantSubmissionDto,
  RejectCopySubmissionDto,
  RejectWantSubmissionDto,
} from "./dto";
import { SubmissionsService } from "./submissions.service";

@ApiTags("Submissions")
@ApiBearerAuth()
@Controller("submissions")
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  // ── Member-facing ──────────────────────────────────────────

  @Post("copy")
  submitCopy(
    @Body() dto: CreateCopySubmissionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers("authorization") authorization: string | undefined,
    @Headers("x-auth-access-token") identityAccessToken: string | undefined
  ): Promise<{ submitted: true }> {
    return this.submissionsService.submitCopy(
      dto,
      user,
      authorization,
      identityAccessToken
    );
  }

  @Post("want-missing")
  submitMissingWant(
    @Body() dto: CreateMissingWantSubmissionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers("authorization") authorization: string | undefined,
    @Headers("x-auth-access-token") identityAccessToken: string | undefined
  ): Promise<{ submitted: true }> {
    return this.submissionsService.submitMissingWant(
      dto,
      user,
      authorization,
      identityAccessToken
    );
  }

  // ── Staff-facing ───────────────────────────────────────────

  @Get("copies")
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  listCopySubmissions(@Query("status") status?: string) {
    return this.submissionsService.listCopySubmissions(status);
  }

  @Get("copies/:id")
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  getCopySubmission(@Param("id") id: string) {
    return this.submissionsService.getCopySubmission(id);
  }

  @Patch("copies/:id/approve")
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  approveCopySubmission(
    @Param("id") id: string,
    @Body() dto: ApproveCopySubmissionDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.submissionsService.approveCopySubmission(
      id,
      dto,
      user.email ?? user.id
    );
  }

  @Patch("copies/:id/reject")
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  rejectCopySubmission(
    @Param("id") id: string,
    @Body() dto: RejectCopySubmissionDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.submissionsService.rejectCopySubmission(
      id,
      dto,
      user.email ?? user.id
    );
  }

  // ── Staff-facing: want submissions ────────────────────────

  @Get("wants")
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  listWantSubmissions(@Query("status") status?: string) {
    return this.submissionsService.listWantSubmissions(status);
  }

  @Get("wants/:id")
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  getWantSubmission(@Param("id") id: string) {
    return this.submissionsService.getWantSubmission(id);
  }

  @Patch("wants/:id/approve")
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  approveWantSubmission(
    @Param("id") id: string,
    @Body() dto: ApproveWantSubmissionDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.submissionsService.approveWantSubmission(
      id,
      dto,
      user.email ?? user.id
    );
  }

  @Patch("wants/:id/reject")
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  rejectWantSubmission(
    @Param("id") id: string,
    @Body() dto: RejectWantSubmissionDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.submissionsService.rejectWantSubmission(
      id,
      dto,
      user.email ?? user.id
    );
  }
}
