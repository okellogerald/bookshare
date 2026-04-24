import {
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  AuthorizationSurface,
  isReadGatewayResourceName,
  type ReadGatewayResourceName,
} from "@bookshare/shared";
import type { Request } from "express";
import { OptionalAuth } from "../../common/decorators";
import type { AuthenticatedUser } from "../../common/guards";
import { ReadGatewayService } from "./read-gateway.service";

@ApiTags("Read")
@ApiBearerAuth()
@Controller("read")
export class ReadGatewayController {
  constructor(private readonly readGatewayService: ReadGatewayService) {}

  @Get(":audience/:resource")
  @OptionalAuth()
  read(
    @Param("audience") audience: string,
    @Param("resource") resource: string,
    @Req() request: Request & { user?: AuthenticatedUser | null },
    @Headers("accept") accept?: string,
    @Headers("prefer") prefer?: string,
    @Headers("range") range?: string
  ) {
    if (
      !Object.values(AuthorizationSurface).includes(
        audience as (typeof AuthorizationSurface)[keyof typeof AuthorizationSurface]
      ) ||
      !isReadGatewayResourceName(resource)
    ) {
      throw new NotFoundException("Unknown read resource");
    }

    const queryString = request.originalUrl?.includes("?")
      ? request.originalUrl.split("?").slice(1).join("?")
      : "";

    return this.readGatewayService.read(
      resource as ReadGatewayResourceName,
      audience as (typeof AuthorizationSurface)[keyof typeof AuthorizationSurface],
      request.user ?? null,
      new URLSearchParams(queryString),
      { accept, prefer, range }
    );
  }

  @Get(":resource")
  @OptionalAuth()
  readLegacy(
    @Param("resource") resource: string,
    @Req() request: Request & { user?: AuthenticatedUser | null },
    @Headers("accept") accept?: string,
    @Headers("prefer") prefer?: string,
    @Headers("range") range?: string
  ) {
    if (!isReadGatewayResourceName(resource)) {
      throw new NotFoundException("Unknown read resource");
    }

    const audience = request.user
      ? AuthorizationSurface.WEB_MEMBER
      : AuthorizationSurface.WEB_PUBLIC;

    const queryString = request.originalUrl?.includes("?")
      ? request.originalUrl.split("?").slice(1).join("?")
      : "";

    return this.readGatewayService.read(
      resource as ReadGatewayResourceName,
      audience,
      request.user ?? null,
      new URLSearchParams(queryString),
      { accept, prefer, range }
    );
  }
}
