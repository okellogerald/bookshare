import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { AuthGuard, type AuthenticatedUser } from "../../common/guards/auth.guard";
import { PostgrestProxyService } from "./postgrest-proxy.service";

@Injectable()
export class PostgrestProxyMiddleware implements NestMiddleware {
  constructor(
    private readonly authGuard: AuthGuard,
    private readonly postgrestProxy: PostgrestProxyService
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    if (req.method !== "GET") {
      return next();
    }

    const target = this.postgrestProxy.resolveProxyTarget(
      req.originalUrl ?? req.url
    );

    if (!target) {
      return next();
    }

    let user: AuthenticatedUser | null = null;

    try {
      user = await this.authGuard.authenticateRequest(req, {
        optional: target.isPublic,
      });
    } catch (error) {
      const status =
        error instanceof UnauthorizedException ? error.getStatus() : 401;
      const message =
        error instanceof Error ? error.message : "Unauthorized";

      return res.status(status).json({ error: message });
    }

    const token = this.postgrestProxy.mintInternalToken(user);
    const search = req.originalUrl.includes("?")
      ? req.originalUrl.split("?").slice(1).join("?")
      : "";
    const url = this.postgrestProxy.buildPostgrestUrl(target.path, search);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const prefer = req.headers["prefer"];
    const range = req.headers["range"];
    const accept = req.headers["accept"];
    if (prefer) headers["Prefer"] = prefer as string;
    if (range) headers["Range"] = range as string;
    if (accept && accept !== "*/*") headers["Accept"] = accept as string;

    try {
      const upstream = await fetch(url, { headers });

      res.status(upstream.status);

      const contentRange = upstream.headers.get("Content-Range");
      if (contentRange) res.setHeader("Content-Range", contentRange);

      if (upstream.status === 204) {
        return res.end();
      }

      const contentType = upstream.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        return res.send(await upstream.text());
      }

      const data = await upstream.json();
      const count = contentRange
        ? (() => {
            const total = contentRange.split("/")[1];
            return total && total !== "*" ? parseInt(total, 10) : undefined;
          })()
        : Array.isArray(data)
          ? data.length
          : undefined;

      return res.json({ data, ...(count !== undefined ? { count } : {}) });
    } catch {
      return res
        .status(502)
        .json({ error: "Failed to reach PostgREST upstream" });
    }
  }
}
