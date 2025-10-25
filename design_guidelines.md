# Design Guidelines: ARMT VPN Platform

## Design Approach
**Cyberpunk/Tech-Forward Aesthetic** - Maintaining the existing neon-glow, dark-themed visual language while expanding it into a comprehensive platform design system. This approach reflects the technical nature of VPN services while creating visual distinction in a competitive market.

---

## Core Design Elements

### A. Typography
**Font Families:**
- Primary: System UI stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`)
- Accent/Headers: `"Inter"` via Google Fonts for modern, clean headlines
- Code/Technical: `"JetBrains Mono"` for VPN keys, configuration displays

**Hierarchy:**
- Hero Headlines: 3xl-6xl (48-60px), bold weight
- Section Headers: 2xl-3xl (32-48px), bold weight
- Card Titles: xl-2xl (20-32px), semibold weight
- Body Text: base-lg (16-18px), normal weight
- Labels/Meta: sm-base (14-16px), medium weight
- Technical Data: sm mono (14px), medium weight

### B. Layout System
**Spacing Primitives:** Use Tailwind units of **4, 6, 8, 12, 16, 20** for consistent rhythm
- Component padding: p-6 to p-8
- Section spacing: py-12 to py-20
- Card gaps: gap-6 to gap-8
- Element margins: m-4 to m-8

**Container Strategy:**
- Marketing pages: max-w-7xl centered
- Dashboard layouts: max-w-screen-2xl with sidebar
- Forms/Content: max-w-2xl for readability
- Admin tables: full-width with responsive scroll

---

## Component Library

### Marketing Website Components

**Navigation Bar:**
- Fixed position with backdrop blur (bg-black/80 backdrop-blur-lg)
- Logo with shield icon + brand name
- Desktop: horizontal links, mobile: hamburger menu
- CTA button with neon gradient effect

**Hero Section:**
- Two-column layout (60/40 split): Text left, floating illustration right
- Gradient background: `from-black via-gray-900 to-black`
- Primary CTA: Neon gradient button with glow effect
- Secondary CTA: Outlined button with hover glow
- Floating animation on hero image (subtle translateY oscillation)

**Feature Cards (3-column grid):**
- Dark semi-transparent background (rgba(20,20,20,0.9))
- Icon at top: FontAwesome icons in cyan (#00f2fe), 3xl size
- Title + description with hover lift effect (translateY -10px)
- Neon shadow on hover: `0 10px 30px rgba(0,242,254,0.3)`

**Pricing Cards:**
- Side-by-side comparison layout
- Premium tier: cyan border accent
- Feature list with check icons
- Prominent price display with period label
- Full-width CTA button at bottom

**Testimonials Section:**
- 3-column grid with user avatar placeholders
- Quote text in italic, medium gray
- Star ratings with cyan colored icons
- User name + role below quote

**Contact Section:**
- Centered icon cards (Telegram support + channel)
- Large icons (5xl) in cyan
- Direct action buttons below each

**Footer:**
- Dark background with subtle top border
- Multi-column layout: About, Quick Links, Social, Contact
- Newsletter signup form
- Copyright + legal links at bottom
- Social icons with hover glow

### User Dashboard Components

**Sidebar Navigation:**
- Fixed left sidebar (w-64) with dark background
- Logo/brand at top
- Navigation items with icons + labels
- Active state: cyan accent border-left + background glow
- User profile section at bottom with balance display

**Dashboard Cards:**
- Grid layout (2-3 columns responsive)
- Active subscription card: large, cyan accent
- Quick stats cards: VPN usage, days remaining, referral count
- Traffic usage progress bar with gradient fill
- Connection status indicator (online/offline dot)

**VPN Configuration Display:**
- Code-style monospace font display
- Copy button with icon + tooltip
- QR code generation for mobile setup
- Download config file button
- Step-by-step setup instructions accordion

**Subscription Management:**
- Timeline view of subscription history
- Renewal date countdown with visual indicator
- Upgrade/extend buttons with pricing preview
- Auto-renewal toggle switch

**Referral Dashboard:**
- Unique referral link with copy button
- Earned balance display (large, prominent)
- Referral count with tier progression
- List of referred users (avatar + join date + earnings)
- Social share buttons for Telegram/WhatsApp

**Transaction History Table:**
- Sortable columns: Date, Type, Amount, Status
- Status badges: success (green), pending (yellow), failed (red)
- Pagination controls
- Filter by date range and type

### Admin Panel Components

**Stats Overview (Top Row):**
- 4 metric cards: Total Users, Active Subscriptions, Revenue, Active Servers
- Large number display with trend indicators (up/down arrows)
- Sparkline mini-charts showing 7-day trend

**User Management Table:**
- Search bar with filters (subscription type, status, date range)
- Columns: User ID, Username, Telegram, Subscription, Expires, Balance, Actions
- Inline actions: View, Edit, Message, Grant Access
- Bulk actions toolbar (appears on row selection)
- Pagination with items-per-page selector

**Server Management Cards:**
- Card grid showing each 3X-UI server
- Server name + status indicator (online/offline)
- Connection count and capacity bar
- Quick actions: View Details, Edit, Test Connection, Delete
- "Add Server" card with dashed border

**Server Detail View:**
- Two-column layout: Configuration (left), Statistics (right)
- Form fields for all server parameters
- Connection test button with loading state
- Active users list for this server
- Save/Cancel action buttons

**Tariff Management:**
- Table view with editable rows
- Columns: Name, Price, Duration, Data Limit, Status
- Inline edit mode with input fields
- Toggle for active/inactive status
- Add new tariff button (opens modal)

**Promo Code Management:**
- Creation form: Code, Discount %, Max Uses, Expiry Date
- Active codes table with usage statistics
- Deactivate/Edit/Delete actions
- Usage chart showing redemptions over time

**Broadcast Messaging:**
- Rich text editor for message composition
- Preview panel showing mobile/desktop views
- Target audience selector: All Users, Active Only, Specific Segment
- Send test message button
- Scheduled send option with date/time picker

### Form Components

**Input Fields:**
- Dark background with subtle border
- Cyan border on focus with glow effect
- Floating labels (Material Design style)
- Inline validation icons (check/error)
- Helper text below field

**Buttons:**
- Primary: Neon gradient (cyan to blue) with glow
- Secondary: Outlined with hover fill
- Danger: Red gradient for destructive actions
- Disabled: Low opacity with no interaction

**Toggles/Switches:**
- iOS-style switches with cyan active color
- Smooth transition animation (300ms)

**Dropdowns:**
- Dark dropdown menu with backdrop blur
- Hover state with cyan background tint
- Selected item with checkmark icon

**Date Pickers:**
- Calendar overlay with dark theme
- Selected date: cyan background
- Range selection support for filters

---

## Animations & Interactions

**Page Load:**
- Stagger animation for cards: fadeInUp with 100ms delay between
- Hero content: slide from left, image from right

**Hover States:**
- Cards: subtle lift (translateY -5px) + enhanced shadow
- Buttons: scale 1.05 + intensified glow
- Links: text-shadow glow effect

**Data Updates:**
- Success toast: slide in from top-right, green accent
- Loading states: pulsing skeleton screens (not spinners)
- Error states: shake animation + red glow

**Transitions:**
- Navigation changes: 300ms ease-out fade
- Modal/overlay: backdrop blur fade-in (200ms)
- Dropdown menus: 200ms ease-out slide down

---

## Images

**Hero Section:**
- Large floating VPN shield/lock illustration (right side, ~400px width)
- Subtle floating animation (translateY oscillation)
- PNG with transparency on dark background
- Fallback: FontAwesome shield icon scaled large

**Feature Icons:**
- Use FontAwesome solid icons throughout (fa-bolt, fa-lock, fa-globe, fa-server, fa-chart-line)
- Consistent 3xl-4xl sizing in feature cards
- Cyan color (#00f2fe) for primary icons

**User Avatars:**
- Circular placeholders with gradient backgrounds
- First letter of username in white, centered
- Hover: subtle cyan glow border

**Server Status:**
- Visual indicators: green dot (online), red dot (offline), yellow (warning)
- Positioned top-right of server cards

**No large decorative images needed** - focus on iconography and data visualization. The dark theme with neon accents provides sufficient visual interest.

---

## Platform-Specific Guidance

**Telegram Bot Visual Consistency:**
- Match button styles in inline keyboards to website CTAs
- Use emojis to replace icons (🔒 for VPN, 💰 for balance, ⚙️ for settings)
- Message formatting: bold for headers, code blocks for configs
- Success messages: ✅ prefix, errors: ❌ prefix

**Responsive Breakpoints:**
- Mobile (< 640px): Single column, stacked navigation
- Tablet (640-1024px): 2-column grids, collapsible sidebar
- Desktop (> 1024px): Full multi-column layouts, fixed sidebar

**Accessibility Consistency:**
- All interactive elements: min 44px touch target
- Form inputs: clear focus states with 2px cyan outline
- Error messages: icon + text (not color alone)
- Keyboard navigation: visible focus rings throughout