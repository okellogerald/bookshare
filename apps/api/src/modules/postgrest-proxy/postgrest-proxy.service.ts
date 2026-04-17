import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as jwt from "jsonwebtoken";
import type { AuthenticatedUser } from "../../common/guards/auth.guard";

@Injectable()
export class PostgrestProxyService {
  private readonly postgrestUrl: string;
  private readonly jwtSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.postgrestUrl =
      this.configService.get<string>("POSTGREST_INTERNAL_URL") ||
      "http://postgrest:3000";
    this.jwtSecret =
      this.configService.getOrThrow<string>("POSTGREST_JWT_SECRET");
  }

  mintInternalToken(user: AuthenticatedUser | null): string {
    const payload = user
      ? { role: "postgrest_auth", sub: user.id, roles: user.roles }
      : { role: "postgrest_anon" };

    return jwt.sign(payload, this.jwtSecret, {
      algorithm: "HS256",
      expiresIn: 15,
    });
  }

  buildPostgrestUrl(path: string, search: string): string {
    const url = new URL(`/${path}`, this.postgrestUrl);
    if (search) url.search = search;
    return url.toString();
  }
}
