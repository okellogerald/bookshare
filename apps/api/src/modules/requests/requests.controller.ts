import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  AuthorizationPermission,
  PlatformRole,
  type AdminRequestsOverview,
} from "@bookshare/shared";
import { Permissions, Roles } from "../../common/decorators";
import { RequestsService } from "./requests.service";

/**
 * Staff-only surface that powers the admin "Matches" workbench.
 *
 * This controller intentionally exposes only a read endpoint — v1 of the
 * workbench is a diagnostic/matchmaking view. Actions (nudge member,
 * confirm fulfilment) will land as separate endpoints when we're ready.
 */
@ApiTags("Requests")
@ApiBearerAuth()
@Roles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_STAFF)
@Controller("requests")
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Get("matches")
  @Permissions(AuthorizationPermission.CATALOG_READ)
  getMatchesOverview(): Promise<AdminRequestsOverview> {
    return this.requestsService.getOverview();
  }
}
