# ARMT VPN Platform

## Overview

The ARMT VPN Platform is a full-stack application designed for managing VPN services. It allows users to subscribe to VPN plans, manage their profiles, participate in a referral program, and handle payments. The platform features a distinctive cyberpunk aesthetic with neon elements, and it includes both user-facing and administrative interfaces. Its core capabilities include VLESS protocol support for VPN profiles, tiered subscription models, promotional code functionality, and a referral system with balance tracking. The project aims to provide a robust and visually engaging VPN management solution.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

**October 28, 2025**
- Fixed critical bug in `telegram_bot.py`: Changed `range(53)` to `range(46)` to match the actual number of state constants (46 variables). This resolves the "ValueError: too many values to unpack" error that prevented the Telegram bot from starting.
- Created `PRODUCTION_FIX.md` with comprehensive deployment troubleshooting instructions for vip.armt.su:4443.

## Known Issues

**Production Deployment Issues (vip.armt.su)**
1. **Telegram Bot**: Fixed in repository - needs server update (see PRODUCTION_FIX.md)
2. **Website Access**: May require firewall/nginx configuration on server (see PRODUCTION_FIX.md)

## System Architecture

### Frontend

The frontend is built with React and TypeScript, utilizing Vite for fast development and optimized builds. Wouter is used for client-side routing. The UI is constructed with shadcn/ui components, based on Radix UI primitives, and styled with Tailwind CSS, adhering to a "New York" dark mode theme with a cyberpunk aesthetic, custom HSL-based color system, neon gradients, and tech-forward typography. State management for server data is handled by TanStack Query, while React Hook Form with Zod manages form validation. React Context is used for theme management. The design system incorporates custom spacing, a specific typography hierarchy (Inter, system fonts, JetBrains Mono), and responsive design with a mobile-first approach.

### Backend

The backend uses Express.js for the HTTP server and API routing. It implements session-based authentication with `express-session` and cookie storage, employing `bcrypt` for password hashing. API endpoints are RESTful, prefixed with `/api`, and secured with `requireAuth` and `requireAdmin` middleware. Centralized error handling and secure session management are in place. Authentication is email/password-based with role-based access control (admin vs. regular user).

### Data Storage

The platform uses `better-sqlite3` for a local SQLite database (`vpn_platform.db`) with a future migration path to PostgreSQL via Drizzle ORM. A schema-first approach is followed, with Zod for runtime validation. Key database entities include `users`, `servers` (VLESS configurations), `tariffs`, `promocodes`, `vpn_profiles`, `referrals`, and `transactions`. A repository pattern is used for data access, featuring autoincrement primary keys and timestamp tracking.

### Business Logic

- **Subscription System**: Manages tariff-based subscriptions with configurable durations, data limits, trial periods, and distinct main and referral balances.
- **VPN Profile Management**: Generates VLESS protocol configurations, manages server assignments, and links profile lifecycle to subscription status. Supports multiple protocol parameters.
- **Referral Program**: Tracks hierarchical referrals, manages referral earnings in a separate balance, and logs transactions.
- **Promotional System**: Implements percentage-based discount codes with usage limits and activation toggles.
- **Telegram 2FA System**: Provides two-factor authentication via Telegram Bot API, including account linking, challenge code generation, and webhook integration.
- **VPN Connection UX**: Generates QR codes for VPN configurations and provides detailed setup instructions for various VPN clients across platforms.
- **Support System**: Features a chat-style messaging system for user and admin communication on support tickets.
- **Admin Settings Management**: Allows administrators to configure site operational modes (demo, maintenance, production), profiles per purchase, Telegram bot settings (token, admin IDs, support group ID), CryptoBot token, minimum deposit amounts, referral bonuses, and trial period settings directly from the admin panel.

### Development Environment

The development environment uses TypeScript with strict mode, ESM modules, and path aliases. Vite builds the React client, and esbuild bundles the Express server. `tsx` is used for TypeScript execution in development. Database management includes seeding scripts and Drizzle Kit for schema migrations.

## External Dependencies

### UI Components
- **Radix UI**: Accessible component primitives.
- **Lucide React**: Icon library.
- **qrcode.react**: QR code generation.
- **cmdk**: Command palette.
- **vaul**: Drawer component.
- **embla-carousel-react**: Carousel functionality.
- **react-day-picker**: Calendar and date picker.
- **input-otp**: OTP input component.

### Form & Validation
- **React Hook Form**: Form state management.
- **@hookform/resolvers**: Zod resolver integration.
- **Zod**: Schema validation.

### Styling
- **Tailwind CSS**: Utility-first CSS framework.
- **tailwindcss-animate**: Animation utilities.
- **class-variance-authority**: Type-safe component variants.
- **clsx** & **tailwind-merge**: Conditional className composition.

### Backend Dependencies
- **bcrypt**: Password hashing.
- **connect-pg-simple**: PostgreSQL session store (configured).
- **@neondatabase/serverless**: Neon PostgreSQL driver.

### Database & ORM
- **better-sqlite3**: Synchronous SQLite3 bindings.
- **Drizzle ORM**: Type-safe SQL query builder.
- **Drizzle Kit**: Schema management and migrations CLI.

### Development Tools
- **Vite**: Build tool and dev server.
- **@vitejs/plugin-react**: React support for Vite.
- **esbuild**: JavaScript bundler.
- **tsx**: TypeScript execution.
- **@replit/vite-plugin-runtime-error-modal**: Error overlay.
- **@replit/vite-plugin-cartographer**: Replit-specific tooling.
- **@replit/vite-plugin-dev-banner**: Development environment indicators.