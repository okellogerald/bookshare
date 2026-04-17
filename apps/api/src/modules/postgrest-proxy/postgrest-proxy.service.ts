import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as jwt from "jsonwebtoken";
import type { AuthenticatedUser } from "../../common/guards/auth.guard";

const EXACT_PROXY_PATHS = new Set([
  "authors",
  "book_quotes_with_book",
  "books",
  "books_with_authors",
  "books_with_categories",
  "browse_listings",
  "browse_wishes",
  "categories",
  "editions",
  "member_profiles",
]);

const COLLECTION_PROXY_PATHS = new Set(["copies", "wishes"]);

const PUBLIC_PROXY_PATHS = new Set([
  "book_quotes_with_book",
  "books_with_authors",
  "books_with_categories",
  "browse_listings",
  "browse_wishes",
  "categories",
  "editions",
]);

export interface PostgrestProxyTarget {
  path: string;
  isPublic: boolean;
}

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

  resolveProxyTarget(requestPath: string): PostgrestProxyTarget | null {
    const pathname = requestPath.split("?")[0] ?? "";
    const normalized = pathname
      .replace(/^\/+/, "")
      .replace(/^api\/?/, "")
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");

    if (!normalized) return null;

    if (EXACT_PROXY_PATHS.has(normalized)) {
      return {
        path: normalized,
        isPublic: PUBLIC_PROXY_PATHS.has(normalized),
      };
    }

    const segments = normalized.split("/");
    if (segments.length === 1 && COLLECTION_PROXY_PATHS.has(segments[0])) {
      return {
        path: segments[0],
        isPublic: PUBLIC_PROXY_PATHS.has(segments[0]),
      };
    }

    return null;
  }
}
