import { Controller, Get, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { OptionalAuth } from "../../common/decorators/optional-auth.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/guards/auth.guard";
import { PostgrestProxyService } from "./postgrest-proxy.service";

@OptionalAuth()
@Controller()
export class PostgrestProxyController {
  constructor(private readonly postgrestProxy: PostgrestProxyService) {}

  @Get("*")
  async proxyGet(
    @Req() req: Request,
    @Res() res: Response,
    @CurrentUser() user: AuthenticatedUser | null
  ) {
    // Strip the /api/ global prefix to get the PostgREST table/view path
    const postgrestPath = req.path.replace(/^\/api\//, "");
    const search = req.url.includes("?")
      ? req.url.split("?").slice(1).join("?")
      : "";

    const token = this.postgrestProxy.mintInternalToken(user ?? null);
    const url = this.postgrestProxy.buildPostgrestUrl(postgrestPath, search);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // Forward PostgREST-relevant headers
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

      if (upstream.status === 204) return res.end();

      const data = await upstream.json();

      // Wrap in { data, count } envelope that BFF layers expect
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
