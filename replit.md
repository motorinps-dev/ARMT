# ARMT VPN Platform

## Overview

ARMT VPN Platform is a full-stack VPN service management application built with a modern tech stack. The platform enables users to purchase VPN subscriptions, manage profiles, track referrals, and handle payments. It features a cyberpunk/tech-forward aesthetic with neon-glow design elements and includes both user-facing and administrative interfaces.

The application provides VPN profile management with VLESS protocol support, tariff-based subscription plans, promotional code systems, and a referral program with balance tracking.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React with TypeScript for type-safe component development
- Vite as the build tool and development server for fast HMR and optimized production builds
- Wouter for lightweight client-side routing instead of React Router

**UI Component System**
- shadcn/ui component library with Radix UI primitives for accessible, unstyled components
- Tailwind CSS for utility-first styling with custom theme configuration
- "New York" style variant with dark mode as default theme
- Custom color system using HSL values with CSS variables for theming
- Cyberpunk aesthetic with neon gradients, dark backgrounds, and tech-forward typography

**State Management**
- TanStack Query (React Query) for server state management, caching, and data fetching
- React Hook Form with Zod for form validation and type-safe form handling
- React Context for theme management (dark/light mode toggle)

**Design System**
- Custom spacing primitives (4, 6, 8, 12, 16, 20 Tailwind units)
- Typography hierarchy with Inter for headers, system fonts for body, JetBrains Mono for technical data
- Component variants using class-variance-authority for consistent UI patterns
- Responsive breakpoints with mobile-first approach (768px mobile breakpoint)

### Backend Architecture

**Server Framework**
- Express.js for HTTP server and API routing
- Session-based authentication using express-session with cookie storage
- bcrypt for password hashing (10 salt rounds)
- Middleware for request logging, JSON parsing, and raw body capture

**API Structure**
- RESTful API endpoints with `/api` prefix
- Route protection with `requireAuth` and `requireAdmin` middleware
- Centralized error handling and response formatting
- Session management with secure cookie configuration

**Authentication & Authorization**
- Email/password-based registration and login
- Session persistence with userId stored in session data
- Role-based access control (admin vs. regular users via `is_admin` flag)
- Password security with bcrypt hashing before storage

### Data Storage

**Database Solution**
- better-sqlite3 for local SQLite database (`vpn_platform.db`)
- Drizzle ORM configured for PostgreSQL migrations (future migration path)
- Schema-first approach with Zod for runtime validation
- Database abstraction layer in `server/storage.ts` providing CRUD operations

**Database Schema**
- **users**: Authentication, balances (main + referral), subscription tracking, admin flags
- **servers**: VPN server configurations with VLESS protocol parameters (panel credentials, connection details)
- **tariffs**: Subscription plans with pricing, duration (days), data limits (GB)
- **promocodes**: Discount codes with usage limits and activation status
- **vpn_profiles**: User-specific VPN configurations linked to servers
- **referrals**: Tracking referrer-referee relationships for commission system
- **transactions**: Payment and referral earning history
- **stats**: Platform-wide metrics (not implemented in schema but referenced in code)

**Data Access Pattern**
- Repository pattern with specialized methods (e.g., `findByEmail`, `findByCode`, `findByKey`)
- Autoincrement primary keys for all entities
- Timestamp tracking with `created_at` defaults to `CURRENT_TIMESTAMP`
- Nullable fields for optional data (Telegram integration, subscription details)

### Business Logic

**Subscription System**
- Tariff-based subscriptions with configurable duration and data limits
- Trial period support (`has_used_trial` flag prevents multiple trials)
- Subscription expiration tracking with `expires_at` timestamp
- Balance system separating main balance from referral earnings

**VPN Profile Management**
- VLESS protocol configuration generation
- Server assignment and connection parameter management
- Profile lifecycle tied to user subscription status
- Support for multiple protocol parameters (flow, SNI, public key, short ID)

**Referral Program**
- Hierarchical referral tracking (referrer_id relationships)
- Separate balance for referral earnings
- Transaction logging for referral commissions
- Unlimited referral depth support

**Promotional System**
- Percentage-based discount codes
- Usage limit enforcement (`max_uses` tracking)
- Activation/deactivation toggle (`is_active` flag)
- Code uniqueness constraints

**Telegram 2FA System**
- Two-factor authentication via Telegram Bot API
- Link code generation for account connection (expires in 10 minutes)
- Challenge code generation for login verification (expires in 5 minutes)
- Webhook integration for bot message handling
- Session-based challenge verification flow
- Enable/disable 2FA from user settings
- Uses TELEGRAM_BOT_TOKEN environment variable for bot authentication

**VPN Connection UX**
- QR code generation for VPN configurations using qrcode.react
- One-click copy functionality for configuration keys
- Comprehensive setup instructions for multiple VPN clients:
  - v2raytun (iOS/Android) with QR and manual import methods
  - v2rayNG (Android) with detailed steps
  - Other clients (Windows, macOS, iOS alternatives)
- Tabbed instruction interface for platform-specific guides

### Development Environment

**Development Tools**
- TypeScript with strict mode enabled for type safety
- ESM module system throughout the stack
- Path aliases for cleaner imports (`@/`, `@shared/`, `@assets/`)
- Hot module replacement in development via Vite

**Build Process**
- Client: Vite builds React app to `dist/public`
- Server: esbuild bundles Express server to `dist/index.js`
- Type checking separate from build process (`check` script)
- Production mode uses compiled artifacts, development uses tsx for TypeScript execution

**Database Management**
- Seeding script for initial data (admin user, default tariffs, welcome promo)
- Drizzle Kit for schema migrations (`db:push` command)
- Migration files stored in `./migrations` directory
- Environment variable required for DATABASE_URL

## External Dependencies

### UI Component Libraries
- **Radix UI**: Unstyled, accessible component primitives (accordion, dialog, dropdown, popover, tabs, tooltip, etc.)
- **Lucide React**: Icon library for consistent iconography
- **qrcode.react**: QR code generation for VPN configuration sharing
- **cmdk**: Command palette component for search interfaces
- **vaul**: Drawer component for mobile-friendly overlays
- **embla-carousel-react**: Carousel/slider functionality
- **react-day-picker**: Calendar and date picker components
- **input-otp**: OTP input component for verification flows

### Form & Validation
- **React Hook Form**: Form state management and validation
- **@hookform/resolvers**: Zod resolver integration
- **Zod**: Schema validation for forms and API data

### Styling
- **Tailwind CSS**: Utility-first CSS framework
- **tailwindcss-animate**: Animation utilities for Tailwind
- **class-variance-authority**: Type-safe component variants
- **clsx** & **tailwind-merge**: Conditional className composition

### Backend Dependencies
- **bcrypt**: Password hashing and verification
- **connect-pg-simple**: PostgreSQL session store (configured but using in-memory sessions currently)
- **@neondatabase/serverless**: Neon PostgreSQL driver for serverless environments

### Database & ORM
- **better-sqlite3**: Synchronous SQLite3 bindings for Node.js
- **Drizzle ORM**: Type-safe SQL query builder and migration tool
- **Drizzle Kit**: CLI tool for schema management and migrations

### Development Dependencies
- **Vite**: Build tool and dev server
- **@vitejs/plugin-react**: React support for Vite
- **esbuild**: JavaScript bundler for server code
- **tsx**: TypeScript execution for development
- **@replit/vite-plugin-runtime-error-modal**: Error overlay for Replit environment
- **@replit/vite-plugin-cartographer**: Replit-specific development tooling
- **@replit/vite-plugin-dev-banner**: Development environment indicators

## Recent Changes (October 26, 2025)

**Admin Account Migration (Latest)**
- Updated admin email addresses from owner@armt.ru → owner@armt.su and admin@armt.vpn → admin@armt.su
- Implemented idempotent migration logic in `server/seed.ts` to handle all database states
- Added `delete` method to storage.users interface for proper account cleanup
- Migration automatically detects and removes legacy accounts or updates them to new email addresses
- Prevents unique constraint violations by checking for existing accounts before migration
- Admin credentials: owner@armt.su / owner123 and admin@armt.su / admin123

**Telegram 2FA Implementation**
- Added complete Telegram Bot API integration in `server/telegram-bot.ts`
- Implemented webhook endpoint for bot message handling
- Created API routes for 2FA: link account, enable/disable, send/verify codes
- Built frontend components: Telegram2FASettings, Verify2FA page
- Updated login flow to handle 2FA challenge verification
- Added pending session storage for secure 2FA login flow

**VPN Configuration UX Improvements**
- Created VpnConfigCard component with QR code display
- Integrated qrcode.react library for QR code generation
- Added one-click copy functionality for configuration keys
- Built comprehensive instruction dialogs with tabs for different platforms
- Documented v2raytun setup process (QR scan and manual import)
- Included instructions for v2rayNG, Clash, and other VPN clients

**Dashboard Enhancements**
- Integrated Telegram2FASettings component in settings tab
- Replaced simple VPN config display with rich VpnConfigCard components
- Added verify-2fa route in App.tsx for challenge verification flow

**Support System Conversion to Chat-Style (Latest)**
- Converted support ticket system from single-message to real-time chat messaging
- Restructured database schema: removed message/admin_reply fields from support_tickets, added support_messages table
- Created support_messages table with ticket_id, is_admin, message, and created_at fields
- Implemented storage methods for messages: create, findByTicketId
- Added API endpoints: GET/POST /api/support-tickets/:id/messages
- Rewrote admin-support-tickets.tsx component with chat interface using ScrollArea and real-time messaging
- Updated user dashboard SupportTab for chat-style communication
- Both admin and user can now send multiple messages in a conversation thread

**Admin Panel Fixes**
- Fixed all edit buttons in admin panel (tariffs, servers, promocodes)
- Implemented working edit dialogs with proper mutation handlers
- Added toggle functionality for active/inactive states

**Injection Protection**
- Added comprehensive input validation with Zod schemas
- Implemented string length limits: email (255 chars), password (6-128 chars), ticket subject (3-200 chars), messages (1-5000 chars)
- Added trim() sanitization for all user inputs
- SQL injection protection via better-sqlite3 prepared statements
- XSS protection via React automatic escaping
- Protection against buffer overflow and DoS attacks through length validation

### Future Integration Points
- PostgreSQL migration path via Drizzle ORM configuration
- ✅ **Telegram bot integration** - Implemented with 2FA system
- ✅ **Chat-style support system** - Implemented with messaging infrastructure
- Payment gateway integration (transaction logging infrastructure in place)
- Multi-server VPN network expansion (server management system ready)
- Configure Telegram webhook URL in production deployment
- Add automated tests for 2FA login flow and support messaging