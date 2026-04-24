import {
  AuthorizationPermission,
  type AuthorizationSurface,
  type ReadGatewayResourceName,
} from "@bookshare/shared";

/**
 * Client audiences that can call a read resource through the Next BFF routes.
 *
 * - `web_public`: anonymous or not-yet-authenticated traffic in the main web app
 * - `web_member`: authenticated end-user traffic in the main web app
 * - `admin_console`: authenticated internal admin UI traffic
 * - `bookstore_portal`: bookstore staff traffic in the bookstore app
 */
export type ReadGatewayClientAudience = AuthorizationSurface;

export type ReadAccessLevel =
  | "public"
  | "authenticated"
  | "platform_staff"
  | "platform_admin";

type ReadScopeMode = "none" | "self_unless_elevated";
type ReadPermissionRequirement =
  | AuthorizationPermission
  | AuthorizationPermission[];

/**
 * Human-oriented explanation fields that live beside the runtime policy.
 *
 * This is intentionally verbose. The point of this manifest is not just to
 * power the gateway; it is also to explain why a resource is exposed, who is
 * expected to call it, and why each restriction exists.
 */
export interface ReadResourceDocumentation {
  callableBy: ReadGatewayClientAudience[];
  summary: string;
  accessReason: string;
  limitReason: string;
  scopeReason?: string;
  blockedParamsReason?: string;
  visibilityReason?: string;
}

export interface ReadResourceConfig {
  source: string;
  access: ReadAccessLevel;
  maxLimit: number;
  scopeMode?: ReadScopeMode;
  elevatedScopePermission?: ReadPermissionRequirement;
  blockedParams?: string[];
  permissionByAudience?: Partial<
    Record<ReadGatewayClientAudience, ReadPermissionRequirement>
  >;
  hideBootstrapAdminsUnlessPermission?: ReadPermissionRequirement;
  docs: ReadResourceDocumentation;
}

/**
 * Source of truth for frontend-callable read resources.
 *
 * Rules for editing this manifest:
 * - Add a resource here only when a frontend client really needs it.
 * - `callableBy` should describe the UI surfaces that are expected to use it.
 * - `access` is the enforced Nest policy, not just an aspirational label.
 * - `maxLimit` should reflect realistic UI batch sizes, not "whatever PostgREST can handle".
 * - `scopeMode` and `blockedParams` should be present whenever a client must not
 *   be able to escape its own data slice by shaping the query.
 */
export const READ_RESOURCE_CONFIG: Record<
  ReadGatewayResourceName,
  ReadResourceConfig
> = {
  // Authenticated author lookup used by member and admin creation/edit flows.
  authors: {
    source: "authors",
    access: "authenticated",
    maxLimit: 100,
    permissionByAudience: {
      admin_console: AuthorizationPermission.CATALOG_READ,
    },
    docs: {
      callableBy: ["web_member", "admin_console", "bookstore_portal"],
      summary:
        "Author lookup for cataloging and library-entry flows.",
      accessReason:
        "Anonymous browse does not need raw author search. Authenticated access is enough for member catalog workflows while keeping this lower-value lookup surface off public traffic.",
      limitReason:
        "Author pickers are search-driven and small. A cap of 100 keeps lookups generous without encouraging bulk dumps through a UI-oriented endpoint.",
    },
  },
  // Public quote listing for book detail pages and quote widgets.
  book_quotes_with_book: {
    source: "book_quotes_with_book",
    access: "public",
    maxLimit: 100,
    docs: {
      callableBy: ["web_public", "web_member", "bookstore_portal"],
      summary:
        "Book-quote read model keyed by book for public-facing reading surfaces.",
      accessReason:
        "Quotes are part of the public content experience in the main web app and do not expose private user data.",
      limitReason:
        "Book pages and quote widgets only need modest batches. 100 is ample for per-book display without turning the endpoint into a bulk export path.",
    },
  },
  // Raw books table kept admin-only; public web uses denormalized book views instead.
  books: {
    source: "books",
    access: "authenticated",
    maxLimit: 200,
    permissionByAudience: {
      admin_console: AuthorizationPermission.CATALOG_READ,
      bookstore_portal: AuthorizationPermission.CATALOG_READ,
    },
    docs: {
      callableBy: ["admin_console", "bookstore_portal"],
      summary:
        "Admin-only access to the base books relation.",
      accessReason:
        "The admin console needs the raw catalog table for operational workflows. The public web should use denormalized browse-oriented views instead of the underlying table.",
      limitReason:
        "Admin catalog screens may page through larger working sets, so the limit is higher than public resources but still bounded to keep queries UI-sized.",
    },
  },
  // Public book-detail and search read model with embedded authors.
  books_with_authors: {
    source: "books_with_authors",
    access: "public",
    maxLimit: 100,
    permissionByAudience: {
      admin_console: AuthorizationPermission.CATALOG_READ,
    },
    docs: {
      callableBy: [
        "web_public",
        "web_member",
        "admin_console",
        "bookstore_portal",
      ],
      summary:
        "Primary book read model with embedded author data.",
      accessReason:
        "This is the stable read model shared by public book pages, authenticated member flows, and admin catalog tools. It is safe for anonymous use because it contains catalog data, not private member data.",
      limitReason:
        "Search and picker flows are interactive rather than batch-oriented. 100 is enough for useful browsing while keeping response size predictable.",
    },
  },
  // Public book-detail helper with embedded category data.
  books_with_categories: {
    source: "books_with_categories",
    access: "public",
    maxLimit: 100,
    permissionByAudience: {
      admin_console: AuthorizationPermission.CATALOG_READ,
    },
    docs: {
      callableBy: [
        "web_public",
        "web_member",
        "admin_console",
        "bookstore_portal",
      ],
      summary:
        "Book read model with embedded category data.",
      accessReason:
        "Used to power browse filters and book-detail metadata across public and authenticated web surfaces. Category information is catalog data and is safe for public access.",
      limitReason:
        "Typical callers request one book or a narrow page of books. 100 keeps the endpoint flexible for filters without inviting bulk extraction.",
    },
  },
  // Public browse view for community-available books.
  browse_listings: {
    source: "browse_listings",
    access: "public",
    maxLimit: 100,
    docs: {
      callableBy: ["web_public", "web_member", "bookstore_portal"],
      summary:
        "Public browse view for community listings.",
      accessReason:
        "The main browse experience must work before sign-in. This view is intentionally shaped for public consumption and avoids exposing user-scoped write-side data directly.",
      limitReason:
        "Browse screens page through small windows. 100 supports richer filtering and pagination while staying within a safe interactive range.",
    },
  },
  // Public browse view for the community wishlist.
  browse_wishes: {
    source: "browse_wishes",
    access: "public",
    maxLimit: 100,
    docs: {
      callableBy: ["web_public", "web_member", "bookstore_portal"],
      summary:
        "Public browse view for grouped community wishes.",
      accessReason:
        "Wishlist discovery is part of the anonymous community experience, so the view is exposed publicly through Nest after policy registration.",
      limitReason:
        "Wishlist pages are interactive lists, not reports. 100 keeps the payload bounded while still being practical for search/filter UI.",
    },
  },
  // Public category list used for filters, forms, and browse navigation.
  categories: {
    source: "categories",
    access: "public",
    maxLimit: 200,
    permissionByAudience: {
      admin_console: AuthorizationPermission.CATALOG_READ,
    },
    docs: {
      callableBy: [
        "web_public",
        "web_member",
        "admin_console",
        "bookstore_portal",
      ],
      summary:
        "Category list for filters and catalog forms.",
      accessReason:
        "Categories are public catalog metadata used in both anonymous browse and authenticated editing flows.",
      limitReason:
        "Category lists are often loaded as lookup sets rather than tiny search responses, so the cap is higher to avoid artificial truncation in selectors.",
    },
  },
  // User-owned copies by default; elevated callers can widen visibility for operations.
  copies: {
    source: "copies",
    access: "authenticated",
    maxLimit: 200,
    scopeMode: "self_unless_elevated",
    elevatedScopePermission: [
      AuthorizationPermission.MEMBER_DIRECTORY_READ,
      AuthorizationPermission.CATALOG_READ,
    ],
    permissionByAudience: {
      admin_console: [
        AuthorizationPermission.MEMBER_DIRECTORY_READ,
        AuthorizationPermission.CATALOG_READ,
      ],
    },
    blockedParams: ["user_id"],
    docs: {
      callableBy: ["web_member", "admin_console", "bookstore_portal"],
      summary:
        "Copy inventory reads for a member's own library, with a permission-based override for admin operations.",
      accessReason:
        "Copy records are user-specific and must never be available anonymously. Authenticated members need them for their own library, while platform staff need broader visibility for support and moderation flows.",
      limitReason:
        "Library and admin inventory tables may page through larger batches than browse pages, so the cap is raised to 200 while remaining explicitly bounded.",
      scopeReason:
        "Regular members are hard-scoped to their own `user_id`. Admin console callers need either `member.directory.read` or `catalog.read` before the gateway will lift that scope for operational workflows.",
      blockedParamsReason:
        "Clients are not allowed to set `user_id` directly, because that would let a regular member attempt to step outside their own data slice. Nest injects the safe scope instead.",
    },
  },
  // Public edition metadata used by browse and member entry flows.
  editions: {
    source: "editions",
    access: "public",
    maxLimit: 100,
    permissionByAudience: {
      admin_console: AuthorizationPermission.CATALOG_READ,
    },
    docs: {
      callableBy: [
        "web_public",
        "web_member",
        "admin_console",
        "bookstore_portal",
      ],
      summary:
        "Edition metadata for public book pages and authenticated catalog workflows.",
      accessReason:
        "Edition details are catalog metadata and are safe to expose publicly through the registered gateway.",
      limitReason:
        "Edition queries are typically tied to a book detail page or a focused search. 100 is enough for those cases without turning the endpoint into a report feed.",
    },
  },
  // Authenticated member directory plus admin directory, with extra bootstrap-admin hiding for web callers.
  member_profiles: {
    source: "member_profiles",
    access: "authenticated",
    maxLimit: 200,
    permissionByAudience: {
      admin_console: AuthorizationPermission.MEMBER_DIRECTORY_READ,
    },
    hideBootstrapAdminsUnlessPermission:
      AuthorizationPermission.MEMBER_DIRECTORY_READ,
    docs: {
      callableBy: ["web_member", "admin_console", "bookstore_portal"],
      summary:
        "Member directory/profile listing for authenticated community and admin surfaces.",
      accessReason:
        "Profiles contain person-oriented information and should not be available to anonymous traffic. Authenticated community flows and admin operations both need this resource.",
      limitReason:
        "Directory-style screens often page through larger sets than search pickers, so the cap is set to 200 to support member and admin list views.",
      visibilityReason:
        "Bootstrap admin accounts are hidden from community-facing callers to avoid leaking privileged seed accounts into member views. Admin callers need `member.directory.read` to keep full visibility for operations.",
    },
  },
  // User-owned wishes by default; elevated callers can widen visibility for admin review and operations.
  wishes: {
    source: "wishes",
    access: "authenticated",
    maxLimit: 200,
    scopeMode: "self_unless_elevated",
    elevatedScopePermission: [
      AuthorizationPermission.MEMBER_DIRECTORY_READ,
      AuthorizationPermission.CATALOG_READ,
    ],
    permissionByAudience: {
      admin_console: [
        AuthorizationPermission.MEMBER_DIRECTORY_READ,
        AuthorizationPermission.CATALOG_READ,
      ],
    },
    blockedParams: ["user_id"],
    docs: {
      callableBy: ["web_member", "admin_console", "bookstore_portal"],
      summary:
        "Wish records for a member's own wishlist, with a permission-based override for admin operations.",
      accessReason:
        "Wishes are personal member records and must require authentication. Platform staff also need wider access for support, moderation, and operational review.",
      limitReason:
        "Wishlist management and admin tables can reasonably page through larger member-level batches, so 200 keeps those screens practical while still bounded.",
      scopeReason:
        "Regular members are restricted to their own wishes. Admin console callers need either `member.directory.read` or `catalog.read` before the gateway will lift that scope for broader operational review.",
      blockedParamsReason:
        "Clients cannot choose `user_id` themselves. Nest owns that scope so a normal member cannot reshape the query into someone else's wishlist.",
    },
  },
};
