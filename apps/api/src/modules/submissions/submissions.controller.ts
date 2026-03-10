import { Body, Controller, Headers, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators";
import type { AuthenticatedUser } from "../../common/guards";
import {
  CreateCopySubmissionDto,
  CreateMissingWantSubmissionDto,
} from "./dto";
import { SubmissionsService } from "./submissions.service";

@ApiTags("Submissions")
@ApiBearerAuth()
@Controller("submissions")
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

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
}
