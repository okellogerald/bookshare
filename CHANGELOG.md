# Changelog

## [Unreleased]

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
