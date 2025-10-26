# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Nostr Profile SVG API service built with Elysia and deployed on Cloudflare Workers. The service fetches Nostr user profiles and badges from relays and generates SVG profile cards.

## Development Commands

### Running the Development Server
```bash
bun run dev
```
This starts the Cloudflare Workers development server using Wrangler. The server runs on http://localhost:3000/

### Deploying to Cloudflare Workers
```bash
wrangler deploy
```
Deploys the service to Cloudflare Workers (configured in wrangler.jsonc).

## Architecture

### Tech Stack
- **Runtime**: Cloudflare Workers (using Bun for local development)
- **Framework**: Elysia with CloudflareAdapter
- **Nostr Library**: nostr-tools (v2.17.0)
- **Language**: TypeScript with strict mode enabled

### Core Components

#### Main Entry Point (src/index.ts)
- Elysia application configured with CloudflareAdapter
- Two routes:
  - `GET /`: Returns API info
  - `GET /:npub`: Generates and returns SVG profile card for a Nostr npub
- Validates npub format (must start with 'npub1')
- Fetches profile and badges in parallel for performance
- Returns SVG with appropriate Content-Type and caching headers (1 hour)

#### Nostr Integration (src/nostr.ts)
- Uses SimplePool to connect to multiple Nostr relays:
  - wss://yabu.me
  - wss://relay.damus.io
  - wss://relay.nostr.band
- `getProfileByNpub()`: Fetches kind 0 (profile metadata) events with 10s timeout
- `getBadgesByNpub()`: Fetches kind 30008 (profile badges) and resolves kind 30009 (badge definitions), limited to 5 badges
- All relay operations use timeouts to prevent hanging requests

#### SVG Generation (src/svg.ts)
- `generateProfileSvg()`: Creates a 650x200px SVG profile card
- Displays: avatar (circular, 120x120), display name, username, bio (truncated to 150 chars), and badges (48x48 thumbnails)
- XML escaping for all user-generated content to prevent XSS
- Defensive defaults for missing profile data

### Configuration

#### TypeScript (tsconfig.json)
- Target: ES2021
- Module: ES2022 with bundler resolution
- Strict mode enabled
- Types: bun-types

#### Wrangler (wrangler.jsonc)
- Entry point: src/index.ts
- Compatibility date: 2025-10-25
- No environment variables or bindings currently configured

### Key Design Patterns

1. **Parallel Fetching**: Profile and badges are fetched concurrently using Promise.all for better performance
2. **Timeout Protection**: All Nostr relay operations use Promise.race with timeouts to prevent hanging
3. **Resource Cleanup**: SimplePool.close() is always called to prevent resource leaks
4. **Error Handling**: Comprehensive try-catch blocks with appropriate HTTP status codes
5. **Caching**: SVG responses include Cache-Control headers (1 hour public cache)

### Notes

- No test suite currently configured (package.json has placeholder test command)
- The service is stateless and relies entirely on Nostr relays for data
- Badge fetching parses 'a' tags (NIP-33 addressable events) to resolve badge definitions
