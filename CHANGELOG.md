# Changelog

## [Unreleased]

## [0.1.2] - 2026-03-13

### Added

- Kratos-backed member profile syncing for `first_name`, `last_name`, `gender`, and `email`, with BookShare profiles reduced to app-specific fields plus mirrored identity data.
- Wish closure tracking so wishes can be removed by the wisher or automatically closed when a matching community copy is lent or marked gone.
- Dedicated dialog components for Browse, My Library, and My Wishlist, with a copy-focused presentation tailored to each workflow.

### Changed

- Simplified Add Copy so members can search existing editions first, add copies directly when the edition already exists, and skip copy image uploads.
- Simplified wishlist behavior to book-level wants only and removed edition-specific wish logic from creation, matching, fulfillment, and notifications.
- Simplified My Wishlist to active wishes only and removed fulfilled-history sections and redundant active-status labeling.
- Added filtering and sorting controls across My Library, My Wishlist, Browse, and Requests.
- Renamed sidebar navigation from `Community Wishlist` / `Community` to `Requests` / `Members`.
- Refined Requests details to prioritize cover, title, author, wanters, and available community members, while moving deeper catalog metadata behind the full book page.
- Simplified request and wishlist copy sections to a consistent member-first list layout with share-type badges and optional contact notes.

### Fixed

- Fixed sidebar active-state matching so `Requests` and `Members` no longer appear selected at the same time.
- Restored dialog cover-image fallback behavior so book covers continue to appear when the selected edition lacks its own image.
- Simplified My Library copy timeline wording by hiding internal import-run details and using cleaner user-facing event labels.

## [0.1.1] - 2026-03-12

### Added

- In-app notifications with unread count, notification inbox, and read / read-all actions.
- Matching workflows for `wish.created`, `copy.created`, and `copy.status_changed` so new wishes and available copies notify relevant members.
- Workflow event ingress in the API and importer support for publishing workflow events.
- Workflow documentation, grouped flow structure, centralized flow/topic config, and a dev iii console setup.
- Copy `contactNote` support in add/edit flows and related profile/contact disclaimers in the UI.

### Changed

- Renamed Wants to Wishlist / Wishes across the database, API, web app, PostgREST views, and importer sample files.
- Simplified copy statuses to `available`, `shelved`, `lent`, and `gone`.
- Simplified copy event types, added explicit `goneReason` handling, and aligned history logging with the new status model.
- Updated My Library actions and copy edit flows to match the new status model.
- Reorganized workflows under `apps/workflows/src` by business flow.
- Switched package versions from `0.1.0` to `0.1.1`.

### Fixed

- Fixed PostgREST read-layer setup for wishes after the rename from wants.
- Fixed the auth login redirect loop caused by double-reading the Kratos browser flow response body.
- Fixed workflows production startup and dev console wiring so the engine and console run correctly in Docker.
