# Watermelon UI Migration - Tasks

This document breaks down the Watermelon UI migration into actionable tasks organized by phase. Each task includes acceptance criteria, time estimates, dependencies, and files to modify.

---

## Phase 1: Portal (Teacher Side) Migration - PRIORITY

### Week 1: Setup & Foundation

#### Task 1.1: Remove MUI Dependencies
**Description:** Remove all Material-UI and Emotion packages from portal package.json

**Acceptance Criteria:**
- [x] All @mui/* packages removed from package.json
- [x] @emotion/react and @emotion/styled removed
- [x] No MUI imports remain in any portal files
- [x] Application builds successfully without MUI

**Time Estimate:** 1 hour

**Dependencies:** None

**Files to Modify:**
- `portal/package.json`

**Commands:**
```bash
cd portal
npm uninstall @mui/material @mui/icons-material @emotion/react @emotion/styled
```

---

#### Task 1.2: Install Core Dependencies
**Description:** Install Framer Motion, Sonner, and missing Radix UI components

**Acceptance Criteria:**
- [x] framer-motion installed (v13.1.1+)
- [x] sonner installed for toast notifications (v2.0.8+)
- [x] lucide-react icons installed (v1.34.0+)
- [x] class-variance-authority, clsx, tailwind-merge installed
- [x] tailwindcss-animate installed
- [x] All dependencies resolve correctly

**Time Estimate:** 30 minutes

**Dependencies:** Task 1.1

**Files to Modify:**
- `portal/package.json`

**Commands:**
```bash
cd portal
npm install framer-motion sonner lucide-react class-variance-authority clsx tailwind-merge tailwindcss-animate
```

---

#### Task 1.3: Initialize shadcn/Watermelon UI
**Description:** Initialize shadcn CLI in portal directory with Watermelon UI configuration

**Acceptance Criteria:**
- [x] components.json created with correct configuration
- [x] Path aliases configured (@/components, @/lib/utils)
- [x] TypeScript paths configured in tsconfig.json
- [x] Base color set to slate
- [x] CSS variables enabled
- [x] Tailwind config path set correctly

**Time Estimate:** 30 minutes

**Dependencies:** Task 1.2

**Files to Create/Modify:**
- `portal/components.json` (create)
- `portal/tsconfig.json` (update paths)
- `portal/vite.config.ts` (update aliases)

**Commands:**
```bash
cd portal
npx shadcn@latest init
# Answer prompts:
# - TypeScript: Yes
# - Style: Default
# - Base color: Slate
# - CSS variables: Yes
# - Tailwind config: tailwind.config.js
# - Components path: @/components/ui
# - Utils path: @/lib/utils
# - React Server Components: No
# - Install via: npm
```

---

#### Task 1.4: Audit Existing UI Components
**Description:** Review existing src/components/ui/ components and verify they match shadcn standards

**Acceptance Criteria:**
- [x] Document all existing UI components in portal/src/components/ui/
- [x] Compare with shadcn/ui component structure
- [x] Identify components that need updates
- [x] Identify missing components (badge, breadcrumb, dropdown-menu, separator)
- [x] Create audit report listing components status

**Time Estimate:** 1 hour

**Dependencies:** Task 1.3

**Files to Review:**
- `portal/src/components/ui/alert.tsx`
- `portal/src/components/ui/button.tsx`
- `portal/src/components/ui/card.tsx`
- `portal/src/components/ui/dialog.tsx`
- `portal/src/components/ui/input.tsx`
- `portal/src/components/ui/label.tsx`
- `portal/src/components/ui/select.tsx`
- `portal/src/components/ui/skeleton.tsx`
- `portal/src/components/ui/table.tsx`

---

#### Task 1.5: Install Missing UI Components
**Description:** Install badge, breadcrumb, dropdown-menu, and separator components via shadcn CLI

**Acceptance Criteria:**
- [x] Badge component installed
- [x] Breadcrumb component installed
- [x] Dropdown Menu component installed
- [x] Separator component installed
- [x] All components have proper TypeScript types
- [x] Components render correctly in isolation

**Time Estimate:** 30 minutes

**Dependencies:** Task 1.4

**Files to Create:**
- `portal/src/components/ui/badge.tsx`
- `portal/src/components/ui/breadcrumb.tsx`
- `portal/src/components/ui/dropdown-menu.tsx`
- `portal/src/components/ui/separator.tsx`

**Commands:**
```bash
cd portal
npx shadcn@latest add badge
npx shadcn@latest add breadcrumb
npx shadcn@latest add dropdown-menu
npx shadcn@latest add separator
```

---

#### Task 1.6: Update CSS Variables and Tailwind Config
**Description:** Update index.css with complete CSS variables for light/dark themes and enhance Tailwind config

**Acceptance Criteria:**
- [~] index.css contains all color variables for light mode
- [~] index.css contains all color variables for dark mode
- [~] Custom animations defined in Tailwind config
- [~] Container configuration set
- [~] Border radius variables configured
- [~] tailwindcss-animate plugin added
- [~] Dark mode set to 'class' mode

**Time Estimate:** 1 hour

**Dependencies:** Task 1.3

**Files to Modify:**
- `portal/src/index.css`
- `portal/tailwind.config.js`

---

#### Task 1.7: Create ThemeToggle Component
**Description:** Create a theme toggle component for dark mode switching

**Acceptance Criteria:**
- [~] ThemeToggle component created with Moon/Sun icons
- [~] Theme preference saved to localStorage
- [~] Dark mode class applied to document root
- [~] Smooth transition between themes (200ms)
- [~] Component uses Button with ghost variant and icon size
- [~] Screen reader label included

**Time Estimate:** 45 minutes

**Dependencies:** Task 1.5, Task 1.6

**Files to Create:**
- `portal/src/components/ThemeToggle.tsx`

---

#### Task 1.8: Add Breadcrumb Navigation to Layout
**Description:** Implement breadcrumb navigation in the Layout component that auto-generates from current route

**Acceptance Criteria:**
- [~] Breadcrumb component integrated into Layout
- [~] Breadcrumbs auto-generate from useLocation hook
- [~] Home icon links to dashboard
- [~] Path segments capitalized and formatted (replace hyphens with spaces)
- [~] Breadcrumbs display above main content
- [~] Hover effects on breadcrumb links work correctly

**Time Estimate:** 1 hour

**Dependencies:** Task 1.5

**Files to Modify:**
- `portal/src/components/Layout.tsx`

---

### Week 2: Dashboard & Core Pages

#### Task 2.1: Enhance DashboardPage with Animations
**Description:** Add Framer Motion animations to DashboardPage including staggered stat cards and hover effects

**Acceptance Criteria:**
- [~] Stat cards animate in with staggered timing (0ms, 100ms, 200ms delays)
- [~] Initial animation: fade in from bottom (y: 20 → 0, opacity: 0 → 1)
- [~] Hover effect: lift animation (y: -4, scale: 1.02)
- [~] Page fades in on mount (300ms duration)
- [~] Live session indicators have pulsing animation
- [~] All animations run at 60fps
- [~] No layout shift during animations

**Time Estimate:** 2 hours

**Dependencies:** Task 1.2, Task 1.8

**Files to Modify:**
- `portal/src/pages/DashboardPage.tsx`

**Animation Code Examples:**
```tsx
// Staggered container
<motion.div
  variants={container}
  initial="hidden"
  animate="show"
  className="grid grid-cols-1 md:grid-cols-3 gap-4"
>
  {stats.map((stat, i) => (
    <motion.div
      key={i}
      variants={item}
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <Card>...</Card>
    </motion.div>
  ))}
</motion.div>

// Pulse animation for live indicator
<motion.div
  animate={{ scale: [1, 1.2, 1] }}
  transition={{ duration: 2, repeat: Infinity }}
>
  <Radio className="h-5 w-5 text-green-500" />
</motion.div>
```

---

#### Task 2.2: Create/Enhance NewSessionPage
**Description:** Create or enhance the session creation page with animated select dropdown and form validation

**Acceptance Criteria:**
- [~] Form card layout created with proper spacing
- [~] Course selection dropdown with animated options
- [~] Optional division and start time override fields
- [~] Form validation with inline error messages
- [~] Error messages animate with shake effect
- [~] Submit button shows loading spinner when processing
- [~] Success toast appears on session creation
- [~] Navigation to session page after creation
- [~] Back button in header

**Time Estimate:** 3 hours

**Dependencies:** Task 1.5, Task 1.7

**Files to Create/Modify:**
- `portal/src/pages/NewSessionPage.tsx` (create or enhance)

**Validation Rules:**
- course_code: Required
- division_id: Optional
- start_time: Optional

---

#### Task 2.3: Add Toast Notifications with Sonner
**Description:** Integrate Sonner toast notifications throughout the portal for action feedback

**Acceptance Criteria:**
- [~] Toaster component added to Layout
- [~] Toast position set to bottom-right
- [~] Success toasts for: session created, session ended, CSV exported
- [~] Error toasts for: API failures, validation errors, network issues
- [~] Info toasts for: real-time updates, connection status
- [~] Toasts auto-dismiss after 4 seconds
- [~] Toasts support promise-based loading states

**Time Estimate:** 1.5 hours

**Dependencies:** Task 1.2

**Files to Modify:**
- `portal/src/components/Layout.tsx` (add Toaster)
- `portal/src/pages/DashboardPage.tsx` (add toast calls)
- `portal/src/pages/NewSessionPage.tsx` (add toast calls)
- `portal/src/pages/SessionPage.tsx` (add toast calls)

**Usage Examples:**
```tsx
import { toast } from 'sonner';

toast.success('Session started successfully');
toast.error('Failed to load sessions');
toast.info('Connected to real-time updates');
```

---

### Week 3: Session Management

#### Task 3.1: Enhance SessionPage with Real-Time Animations
**Description:** Add animations to SessionPage including QR pulse, real-time row animations, and improved table interactions

**Acceptance Criteria:**
- [~] QR code pulses subtly (scale animation 1 → 1.05 → 1 over 3s)
- [~] New attendance rows animate in with AnimatePresence
- [~] New rows highlight briefly with accent background
- [~] Table rows have hover effects (background transition)
- [~] Connection status indicator shows real-time state
- [~] Export button shows loading spinner during CSV generation
- [~] Refresh button rotates during data fetch
- [~] Live indicator badge pulses
- [~] Page transition animation on mount

**Time Estimate:** 3 hours

**Dependencies:** Task 1.2, Task 2.3

**Files to Modify:**
- `portal/src/pages/SessionPage.tsx`

**Animation Examples:**
```tsx
// QR pulse
<motion.div
  animate={{ scale: [1, 1.05, 1] }}
  transition={{ duration: 3, repeat: Infinity }}
>
  <QRCodeSVG value={qrData} size={256} />
</motion.div>

// New row animation
<AnimatePresence mode="popLayout">
  {attendance.map((record) => (
    <motion.tr
      key={record.ledger_uuid}
      initial={{ opacity: 0, x: -20, backgroundColor: "hsl(var(--accent))" }}
      animate={{ opacity: 1, x: 0, backgroundColor: "transparent" }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
    >
      ...
    </motion.tr>
  ))}
</AnimatePresence>
```

---

#### Task 3.2: Enhance ClassroomProjector Component
**Description:** Improve ClassroomProjector component for large-screen display with bigger QR code and animations

**Acceptance Criteria:**
- [~] QR code size increased to 512x512 pixels
- [~] QR code rendered in high contrast card with white background
- [~] Session info header shows course code and division
- [~] Animated instructions: "📱 Scan to mark your attendance"
- [~] Real-time student count display in footer
- [~] Pulse animation on QR code
- [~] Fade animation on instruction text
- [~] Full-screen layout optimized for projectors
- [~] Works correctly in both light and dark modes

**Time Estimate:** 2 hours

**Dependencies:** Task 1.2

**Files to Modify:**
- `portal/src/components/ClassroomProjector.tsx`

---

#### Task 3.3: Add QR Pulse Animations
**Description:** Implement subtle pulse animations for all QR code displays to indicate they are live

**Acceptance Criteria:**
- [~] QR codes pulse with scale animation (1 → 1.05 → 1)
- [~] Animation duration is 3 seconds
- [~] Animation repeats infinitely
- [~] Animation uses ease-in-out timing
- [~] QR codes maintain center alignment during animation
- [~] Animation respects prefers-reduced-motion setting

**Time Estimate:** 45 minutes

**Dependencies:** Task 3.1, Task 3.2

**Files to Modify:**
- `portal/src/pages/SessionPage.tsx`
- `portal/src/components/ClassroomProjector.tsx`

---

### Week 4: Polish & Deployment

#### Task 4.1: Visual Testing - Light Mode
**Description:** Comprehensive visual testing of all portal pages in light mode

**Acceptance Criteria:**
- [~] DashboardPage renders correctly with proper spacing
- [~] NewSessionPage form elements display correctly
- [~] SessionPage table and QR display correctly
- [~] LoginPage form looks polished
- [~] All stat cards have consistent styling
- [~] All buttons have correct variants and sizes
- [~] Icons are consistently sized
- [~] Typography follows scale (text-4xl, text-2xl, etc.)
- [~] Spacing is consistent (space-y-6, gap-4, etc.)
- [~] No layout shift during loading

**Time Estimate:** 2 hours

**Dependencies:** Tasks 2.1, 2.2, 3.1, 3.2

**Testing Checklist:**
- Dashboard stats load and animate correctly
- Session creation form validates properly
- Active session displays QR and table
- Toasts appear in correct position
- Breadcrumbs display current location

---

#### Task 4.2: Visual Testing - Dark Mode
**Description:** Comprehensive visual testing of all portal pages in dark mode

**Acceptance Criteria:**
- [~] All pages render correctly in dark mode
- [~] Text contrast meets WCAG AA standards (4.5:1 for body text)
- [~] QR codes have sufficient contrast on dark background
- [~] Hover states visible in dark mode
- [~] Focus indicators visible in dark mode
- [~] Card borders visible but not harsh
- [~] No color inversion issues
- [~] Theme toggle switches modes smoothly
- [~] localStorage persists theme preference

**Time Estimate:** 2 hours

**Dependencies:** Task 4.1

**Testing Checklist:**
- Toggle to dark mode on each page
- Verify text readability
- Check QR code visibility
- Test form inputs in dark mode
- Verify table row hover effects

---

#### Task 4.3: Add Breadcrumb Navigation
**Description:** Ensure breadcrumb navigation is working correctly across all portal routes

**Acceptance Criteria:**
- [~] Breadcrumbs display on all pages except login
- [~] Home icon links to dashboard (/)
- [~] Current page shown as non-clickable
- [~] Path segments properly formatted
- [~] Separator icons between items
- [~] Hover effects on clickable links
- [~] Responsive on mobile (collapse if needed)

**Time Estimate:** 1 hour

**Dependencies:** Task 1.8

**Files to Verify:**
- `portal/src/components/Layout.tsx`

---

#### Task 4.4: Implement Dark Mode Toggle
**Description:** Ensure dark mode toggle is accessible and functional in the Layout header

**Acceptance Criteria:**
- [~] ThemeToggle button placed in Layout header
- [~] Moon icon shown in light mode
- [~] Sun icon shown in dark mode
- [~] Button has ghost variant and icon size
- [~] Tooltip or aria-label describes action
- [~] Theme persists across page reloads
- [~] Theme transition is smooth (200ms)

**Time Estimate:** 30 minutes

**Dependencies:** Task 1.7

**Files to Modify:**
- `portal/src/components/Layout.tsx`

---

#### Task 4.5: Responsive Layout Testing
**Description:** Test all portal pages across mobile, tablet, and desktop breakpoints

**Acceptance Criteria:**
- [~] Mobile (375px): Single column, touch-friendly buttons (min-height: 44px)
- [~] Tablet (768px): 2-column grid for stat cards
- [~] Desktop (1024px+): 3-column grid for stat cards
- [~] No horizontal scroll at any breakpoint
- [~] Forms stack properly on mobile
- [~] Tables scroll horizontally on mobile if needed
- [~] Sidebar collapses on mobile with hamburger menu
- [~] Touch targets meet 44x44px minimum on mobile

**Time Estimate:** 2 hours

**Dependencies:** Tasks 4.1, 4.2

**Breakpoints to Test:**
- 375px (mobile)
- 768px (tablet)
- 1024px (desktop)
- 1440px (large desktop)

---

#### Task 4.6: Accessibility Audit
**Description:** Run automated accessibility tools and perform manual keyboard/screen reader testing

**Acceptance Criteria:**
- [~] axe DevTools reports zero critical issues
- [~] Lighthouse accessibility score ≥ 95
- [~] All interactive elements keyboard accessible (Tab, Enter, Escape)
- [~] Focus indicators visible on all focusable elements
- [~] Form labels associated with inputs
- [~] Error messages announced by screen readers
- [~] Modals trap focus when open
- [~] ARIA labels present where needed
- [~] Color contrast ratios meet WCAG AA (4.5:1)
- [~] Skip links available if needed

**Time Estimate:** 3 hours

**Dependencies:** Task 4.5

**Testing Tools:**
- Chrome axe DevTools extension
- Lighthouse (Chrome DevTools)
- Keyboard navigation testing
- NVDA/JAWS screen reader testing (Windows)
- VoiceOver testing (Mac)

---

#### Task 4.7: Performance Optimization
**Description:** Optimize bundle size and runtime performance

**Acceptance Criteria:**
- [~] Bundle size < 500KB (gzipped)
- [~] Bundle size reduced by at least 30% from pre-migration
- [~] Lighthouse performance score ≥ 90
- [~] First Contentful Paint < 1.5s
- [~] Largest Contentful Paint < 2.5s
- [~] Time to Interactive < 3.5s
- [~] Cumulative Layout Shift < 0.1
- [ ] All animations run at 60fps
- [~] No animation jank on low-end devices

**Time Estimate:** 2 hours

**Dependencies:** Task 4.6

**Optimization Tasks:**
- Run bundle analyzer: `npm run build && npx vite-bundle-visualizer`
- Code split routes with React.lazy if needed
- Optimize images (use WebP if applicable)
- Memoize expensive components
- Profile with React DevTools

---

#### Task 4.8: Docker Configuration Update
**Description:** Ensure Docker build works correctly with new dependencies and optimized build

**Acceptance Criteria:**
- [~] Dockerfile builds successfully
- [~] Build includes all new dependencies
- [~] nginx.conf.template configured for SPA routing
- [~] Static assets cached correctly (1 year for JS/CSS)
- [~] HTML not cached (no-cache header)
- [~] Environment variables injected correctly
- [~] Docker image size reasonable (< 50MB)
- [~] Built image runs correctly in container

**Time Estimate:** 1 hour

**Dependencies:** Task 4.7

**Files to Verify:**
- `portal/Dockerfile`
- `portal/nginx.conf.template`

**Test Commands:**
```bash
cd portal
docker build -t attendance-portal:latest .
docker run -p 8080:80 attendance-portal:latest
# Test: http://localhost:8080
```

---

#### Task 4.9: Production Deployment
**Description:** Deploy migrated portal to production environment

**Acceptance Criteria:**
- [~] Build completes without errors
- [~] Environment variables set correctly (VITE_API_URL, VITE_APP_URL)
- [~] Docker image pushed to registry
- [~] Deployment successful
- [~] Health check passes
- [~] All API integrations working
- [~] Real-time Socket.IO connections working
- [~] QR codes generating correctly
- [~] No console errors in production
- [~] Rollback plan tested and ready

**Time Estimate:** 2 hours

**Dependencies:** Task 4.8

**Deployment Checklist:**
- Build production bundle
- Test in staging environment
- Backup current production image
- Deploy new image
- Monitor logs for errors
- Test critical user flows
- Keep rollback image ready

---

## Phase 2: Admin Portal Migration

### Week 1: Setup & Core Components

#### Task 5.1: Remove MUI Dependencies from Admin
**Description:** Remove all Material-UI and Emotion packages from admin package.json

**Acceptance Criteria:**
- [~] All @mui/* packages removed from admin/package.json
- [ ] @emotion/react and @emotion/styled removed
- [~] No MUI imports remain in any admin files
- [ ] Application builds successfully without MUI

**Time Estimate:** 1 hour

**Dependencies:** Phase 1 complete

**Files to Modify:**
- `admin/package.json`

**Commands:**
```bash
cd admin
npm uninstall @mui/material @mui/icons-material @emotion/react @emotion/styled
```

---

#### Task 5.2: Install Admin Dependencies
**Description:** Install all required dependencies for admin portal migration

**Acceptance Criteria:**
- [~] framer-motion installed
- [~] sonner installed (if not already present)
- [~] lucide-react installed
- [ ] class-variance-authority, clsx, tailwind-merge installed
- [ ] tailwindcss-animate installed
- [~] All Radix UI dependencies installed
- [~] Dependencies resolve correctly

**Time Estimate:** 30 minutes

**Dependencies:** Task 5.1

**Files to Modify:**
- `admin/package.json`

**Commands:**
```bash
cd admin
npm install framer-motion sonner lucide-react class-variance-authority clsx tailwind-merge tailwindcss-animate
```

---

#### Task 5.3: Initialize shadcn in Admin
**Description:** Initialize shadcn CLI in admin directory

**Acceptance Criteria:**
- [~] components.json created
- [~] Path aliases configured
- [~] TypeScript paths updated
- [~] Base color: slate
- [ ] CSS variables enabled

**Time Estimate:** 30 minutes

**Dependencies:** Task 5.2

**Files to Create/Modify:**
- `admin/components.json`
- `admin/tsconfig.json`
- `admin/vite.config.ts`

**Commands:**
```bash
cd admin
npx shadcn@latest init
```

---

#### Task 5.4: Audit Admin UI Components
**Description:** Review existing admin/src/components/ui/ components

**Acceptance Criteria:**
- [~] Document all existing components
- [~] Compare with shadcn standards
- [~] Identify components needing updates
- [~] Identify missing components (calendar, popover, tooltip)
- [~] Create component status report

**Time Estimate:** 1 hour

**Dependencies:** Task 5.3

**Files to Review:**
- All files in `admin/src/components/ui/`

---

#### Task 5.5: Install Missing Admin Components
**Description:** Install calendar, popover, tooltip, and any other missing components

**Acceptance Criteria:**
- [~] Calendar component installed
- [~] Popover component installed
- [~] Tooltip component installed
- [~] Badge component installed (if missing)
- [~] Breadcrumb component installed (if missing)
- [~] All components render correctly

**Time Estimate:** 30 minutes

**Dependencies:** Task 5.4

**Commands:**
```bash
cd admin
npx shadcn@latest add calendar
npx shadcn@latest add popover
npx shadcn@latest add tooltip
npx shadcn@latest add badge
npx shadcn@latest add breadcrumb
```

---

#### Task 5.6: Update Admin CSS and Tailwind Config
**Description:** Update admin index.css and tailwind.config.js

**Acceptance Criteria:**
- [~] CSS variables for light/dark mode
- [~] Custom animations defined
- [~] Container configuration
- [~] Dark mode set to 'class'
- [ ] tailwindcss-animate plugin added

**Time Estimate:** 1 hour

**Dependencies:** Task 5.3

**Files to Modify:**
- `admin/src/index.css`
- `admin/tailwind.config.js`

---

#### Task 5.7: Add ThemeToggle to Admin Layout
**Description:** Create ThemeToggle component and add to admin Layout

**Acceptance Criteria:**
- [~] ThemeToggle component created
- [~] Added to admin Layout header
- [~] Theme persists to localStorage
- [~] Smooth transition between themes

**Time Estimate:** 45 minutes

**Dependencies:** Task 5.6

**Files to Create/Modify:**
- `admin/src/components/ThemeToggle.tsx`
- `admin/src/components/Layout.tsx`

---

#### Task 5.8: Add Breadcrumb to Admin Layout
**Description:** Implement breadcrumb navigation in admin Layout

**Acceptance Criteria:**
- [~] Breadcrumbs auto-generate from route
- [ ] Home icon links to dashboard
- [~] Path segments formatted correctly
- [~] Hover effects work

**Time Estimate:** 1 hour

**Dependencies:** Task 5.5

**Files to Modify:**
- `admin/src/components/Layout.tsx`

---

### Week 2: Dashboard & Data Tables

#### Task 6.1: Migrate Admin Dashboard
**Description:** Add animations to admin Dashboard stat cards and charts

**Acceptance Criteria:**
- [~] Stat cards animate in with stagger
- [~] Hover effects on cards (lift animation)
- [~] Chart animations (if using Recharts)
- [~] Page transition animation
- [~] Loading skeletons for all sections
- [~] Error states with alert component

**Time Estimate:** 2 hours

**Dependencies:** Task 5.8

**Files to Modify:**
- `admin/src/pages/Dashboard.tsx`

---

#### Task 6.2: Enhance Teachers Page
**Description:** Add animations to Teachers data table and CRUD modals

**Acceptance Criteria:**
- [~] Table row hover effects
- [~] Action button hover effects
- [~] Modal slide-in animation
- [~] Form validation with error animations
- [~] Submit button loading states
- [~] Success/error toasts
- [~] Skeleton loading for table

**Time Estimate:** 3 hours

**Dependencies:** Task 5.8

**Files to Modify:**
- `admin/src/pages/Teachers.tsx`

---

#### Task 6.3: Enhance Students Page
**Description:** Add animations to Students data table and CRUD modals

**Acceptance Criteria:**
- [ ] Table row hover effects
- [ ] Action button hover effects
- [ ] Modal slide-in animation
- [ ] Form validation with error animations
- [ ] Submit button loading states
- [ ] Success/error toasts
- [ ] Skeleton loading for table

**Time Estimate:** 3 hours

**Dependencies:** Task 5.8

**Files to Modify:**
- `admin/src/pages/Students.tsx`

---

### Week 3: CRUD Pages

#### Task 7.1: Migrate Divisions Page
**Description:** Enhance Divisions page with animations and polish

**Acceptance Criteria:**
- [~] Card-based layout with hover effects
- [~] Add/Edit dialog animations
- [~] Form validation and error handling
- [~] Button loading states
- [~] Toast notifications
- [~] Skeleton loading states

**Time Estimate:** 2 hours

**Dependencies:** Task 5.8

**Files to Modify:**
- `admin/src/pages/Divisions.tsx`

---

#### Task 7.2: Migrate Courses Page
**Description:** Enhance Courses page with animations and polish

**Acceptance Criteria:**
- [ ] Card-based layout with hover effects
- [ ] Add/Edit dialog animations
- [ ] Form validation and error handling
- [ ] Button loading states
- [ ] Toast notifications
- [ ] Skeleton loading states

**Time Estimate:** 2 hours

**Dependencies:** Task 5.8

**Files to Modify:**
- `admin/src/pages/Courses.tsx`

---

#### Task 7.3: Migrate API Keys Page
**Description:** Enhance API Keys page with animations and copy feedback

**Acceptance Criteria:**
- [~] List items with hover effects
- [~] Generation dialog animation
- [~] Copy button with feedback (toast or tooltip)
- [~] Revoke confirmation dialog
- [ ] Button loading states
- [ ] Toast notifications

**Time Estimate:** 2 hours

**Dependencies:** Task 5.8

**Files to Modify:**
- `admin/src/pages/ApiKeys.tsx`

---

### Week 4: Timetable & Polish

#### Task 8.1: Migrate Assignments (Timetable) Page
**Description:** Integrate Calendar component and add animations to timetable page

**Acceptance Criteria:**
- [~] Calendar component integrated
- [~] Date selection animations
- [~] Assignment creation dialog
- [~] Time slot display with visual grouping
- [~] Form validation
- [ ] Toast notifications
- [~] Responsive calendar view

**Time Estimate:** 3 hours

**Dependencies:** Task 5.5

**Files to Modify:**
- `admin/src/pages/Assignments.tsx`

---

#### Task 8.2: Add Page Transitions to Admin
**Description:** Implement smooth page transitions for admin portal routing

**Acceptance Criteria:**
- [~] Page fade-in on route change (300ms)
- [~] AnimatePresence wrapping routes
- [~] No layout shift during transitions
- [~] Transitions respect reduced-motion preference

**Time Estimate:** 1 hour

**Dependencies:** Task 5.2

**Files to Modify:**
- `admin/src/App.tsx` or routing file

---

#### Task 8.3: Admin Visual Testing - Light Mode
**Description:** Comprehensive visual testing of all admin pages in light mode

**Acceptance Criteria:**
- [~] All pages render correctly
- [~] Consistent spacing and typography
- [~] All animations smooth
- [~] No layout shift
- [~] Charts display correctly
- [~] Tables render properly
- [~] Forms validate correctly

**Time Estimate:** 2 hours

**Dependencies:** Tasks 6.1-6.3, 7.1-7.3, 8.1

**Pages to Test:**
- Dashboard
- Teachers
- Students
- Divisions
- Courses
- Assignments
- API Keys

---

#### Task 8.4: Admin Visual Testing - Dark Mode
**Description:** Comprehensive visual testing of all admin pages in dark mode

**Acceptance Criteria:**
- [ ] All pages render correctly in dark mode
- [~] Text contrast meets WCAG AA
- [~] Charts visible in dark mode
- [~] Tables readable
- [~] Form inputs styled correctly
- [ ] No color inversion issues

**Time Estimate:** 2 hours

**Dependencies:** Task 8.3

---

#### Task 8.5: Admin Responsive Testing
**Description:** Test admin portal across all breakpoints

**Acceptance Criteria:**
- [~] Mobile (375px): Single column, touch-friendly
- [~] Tablet (768px): 2-column where appropriate
- [~] Desktop (1024px+): Full layouts
- [~] No horizontal scroll
- [~] Tables scroll on mobile if needed
- [~] Dialogs responsive
- [~] Calendar responsive

**Time Estimate:** 2 hours

**Dependencies:** Task 8.4

---

#### Task 8.6: Admin Accessibility Audit
**Description:** Run accessibility testing on admin portal

**Acceptance Criteria:**
- [~] axe DevTools zero critical issues
- [~] Lighthouse accessibility ≥ 95
- [~] Keyboard navigation works
- [~] Focus indicators visible
- [~] Screen reader testing passes
- [~] ARIA labels present
- [~] Color contrast compliant

**Time Estimate:** 3 hours

**Dependencies:** Task 8.5

---

#### Task 8.7: Admin Performance Optimization
**Description:** Optimize admin bundle size and runtime performance

**Acceptance Criteria:**
- [~] Bundle size < 600KB (gzipped)
- [~] 30%+ reduction from pre-migration
- [~] Lighthouse performance ≥ 90
- [~] All metrics meet targets (FCP, LCP, TTI, CLS)
- [~] Animations 60fps
- [~] Bundle analyzer run

**Time Estimate:** 2 hours

**Dependencies:** Task 8.6

---

#### Task 8.8: Admin Docker Configuration
**Description:** Update admin Docker build and nginx config

**Acceptance Criteria:**
- [ ] Dockerfile builds successfully
- [~] nginx.conf configured for SPA
- [~] Static assets cached
- [~] Environment variables work
- [~] Image size reasonable
- [~] Container runs correctly

**Time Estimate:** 1 hour

**Dependencies:** Task 8.7

**Files to Verify:**
- `admin/Dockerfile`
- `admin/nginx.conf.template`

---

#### Task 8.9: Admin Production Deployment
**Description:** Deploy migrated admin portal to production

**Acceptance Criteria:**
- [~] Build succeeds
- [~] Environment variables set
- [~] Docker image pushed
- [ ] Deployment successful
- [ ] Health check passes
- [~] All features working
- [~] No console errors
- [~] Rollback plan ready

**Time Estimate:** 2 hours

**Dependencies:** Task 8.8

---

## Phase 3: Quality & Documentation

### Week 1: Final Polish & Documentation

#### Task 9.1: Cross-Browser Testing
**Description:** Test both portals across Chrome, Firefox, Safari, and Edge

**Acceptance Criteria:**
- [~] Chrome 100+: All features work
- [~] Firefox 100+: All features work
- [~] Safari 15+: All features work
- [~] Edge 100+: All features work
- [~] Known browser quirks documented
- [~] Framer Motion animations work correctly in all browsers

**Time Estimate:** 3 hours

**Dependencies:** Phase 1 & 2 complete

**Testing Matrix:**
- Portal: Dashboard, New Session, Active Session
- Admin: Dashboard, Teachers, Students, Timetable
- Test: Navigation, forms, animations, real-time updates

---

#### Task 9.2: Integration Testing
**Description:** End-to-end testing of both portals with backend API

**Acceptance Criteria:**
- [~] Teacher login/logout works
- [~] Admin login/logout works
- [~] Session creation and management works
- [~] Real-time attendance updates work
- [~] QR code generation works
- [~] CSV export works
- [~] All CRUD operations work
- [~] API error handling works
- [~] Authentication flows work
- [~] Token refresh works

**Time Estimate:** 4 hours

**Dependencies:** Task 9.1

**Test Scenarios:**
1. Teacher creates session → students scan QR → attendance appears
2. Admin creates teacher → teacher logs in → starts session
3. Network error → retry mechanism works
4. Token expires → refresh or redirect to login

---

#### Task 9.3: Component Documentation
**Description:** Document all custom components and usage patterns

**Acceptance Criteria:**
- [~] Each custom component has JSDoc comments
- [~] Props documented with descriptions and types
- [~] Usage examples in comments
- [~] Variants documented
- [~] Animation patterns documented

**Time Estimate:** 3 hours

**Dependencies:** Phase 1 & 2 complete

**Components to Document:**
- ThemeToggle
- ClassroomProjector
- Animated stat cards
- Custom form components
- Layout components

---

#### Task 9.4: Migration Guide
**Description:** Create comprehensive migration guide documenting component mappings

**Acceptance Criteria:**
- [~] MUI → Watermelon UI component mapping table
- [~] Before/after code examples
- [~] Common pitfalls and solutions
- [~] Animation patterns guide
- [~] Dark mode implementation guide
- [~] Accessibility checklist
- [~] Performance optimization tips

**Time Estimate:** 4 hours

**Dependencies:** Task 9.3

**Document Sections:**
1. Component mapping (MUI Button → Watermelon Button)
2. Styling changes (CSS-in-JS → Tailwind)
3. Icon migration (MUI Icons → Lucide React)
4. Animation implementation (Framer Motion patterns)
5. Theme customization
6. Troubleshooting guide

---

#### Task 9.5: Update README Files
**Description:** Update README.md files in portal and admin directories

**Acceptance Criteria:**
- [~] Installation instructions updated
- [~] New dependencies listed
- [~] Development commands documented
- [~] Build and deployment instructions
- [~] Environment variables documented
- [~] Component structure explained
- [~] Contributing guidelines updated

**Time Estimate:** 2 hours

**Dependencies:** Task 9.4

**Files to Update:**
- `portal/README.md`
- `admin/README.md`
- Root `README.md` (if exists)

---

#### Task 9.6: Performance Benchmarking
**Description:** Run final performance benchmarks and create comparison report

**Acceptance Criteria:**
- [~] Lighthouse reports for both portals (before/after)
- [~] Bundle size comparison (before/after)
- [~] Load time metrics (FCP, LCP, TTI)
- [~] Animation performance metrics (FPS)
- [~] Memory usage comparison
- [~] Report documents all improvements

**Time Estimate:** 2 hours

**Dependencies:** Phase 1 & 2 complete

**Metrics to Capture:**
- Bundle size (gzipped)
- Lighthouse scores (Performance, Accessibility, Best Practices)
- Core Web Vitals (FCP, LCP, TTI, CLS)
- Animation frame rate
- Memory consumption

---

#### Task 9.7: User Acceptance Testing Preparation
**Description:** Prepare UAT environment and test scenarios

**Acceptance Criteria:**
- [~] Staging environment deployed with migrations
- [~] Test accounts created (teachers and admins)
- [~] Test data seeded
- [~] UAT test scenarios documented
- [~] Feedback collection mechanism ready
- [~] Known issues documented

**Time Estimate:** 3 hours

**Dependencies:** Task 9.2

**UAT Scenarios:**
1. Teacher Dashboard: View stats, start session, end session
2. Session Management: Create session, scan QR, view attendance
3. Admin Dashboard: View college stats, manage users
4. CRUD Operations: Create/edit/delete teachers, students, courses
5. Timetable: Create assignments, view schedule
6. Dark Mode: Toggle theme, verify all pages

---

#### Task 9.8: Final Security Audit
**Description:** Security review of UI changes

**Acceptance Criteria:**
- [~] No secrets exposed in frontend code
- [~] API keys properly masked in UI
- [~] XSS prevention verified
- [~] CSRF protection maintained
- [~] Authentication flows secure
- [~] No sensitive data in localStorage (except theme)
- [~] Dependency vulnerabilities checked (npm audit)

**Time Estimate:** 2 hours

**Dependencies:** Task 9.2

**Security Checks:**
- Run `npm audit` in both portals
- Check for exposed API keys or secrets
- Verify JWT handling
- Test authentication edge cases
- Review form input sanitization

---

#### Task 9.9: Rollback Plan Documentation
**Description:** Document rollback procedures and create rollback artifacts

**Acceptance Criteria:**
- [~] Rollback steps documented
- [~] Pre-migration Docker images saved
- [~] Database rollback scripts (if any)
- [~] Git rollback commands documented
- [~] Emergency contact list
- [~] Monitoring alert setup

**Time Estimate:** 2 hours

**Dependencies:** Phase 1 & 2 complete

**Rollback Artifacts:**
- Pre-migration git commit hash
- Docker images tagged as `pre-migration`
- Deployment rollback script
- Database state backup (if applicable)

---

#### Task 9.10: Production Monitoring Setup
**Description:** Setup monitoring and alerting for production deployments

**Acceptance Criteria:**
- [~] Error tracking configured (Sentry or similar)
- [~] Performance monitoring setup
- [~] Health check endpoints verified
- [~] Alert thresholds configured
- [~] Dashboard for key metrics
- [~] Log aggregation working

**Time Estimate:** 3 hours

**Dependencies:** Task 9.9

**Monitoring Metrics:**
- Error rate
- Response time
- Page load time
- API call success rate
- WebSocket connection stability
- Bundle load failures

---

## Summary

### Phase 1: Portal Migration (4 weeks)
- **Total Tasks:** 18
- **Estimated Time:** 35.75 hours
- **Priority:** HIGH
- **Deliverable:** Fully migrated teacher portal with animations and dark mode

### Phase 2: Admin Migration (4 weeks)
- **Total Tasks:** 19
- **Estimated Time:** 37.25 hours
- **Priority:** MEDIUM
- **Deliverable:** Fully migrated admin portal with consistent design

### Phase 3: Quality & Documentation (1 week)
- **Total Tasks:** 10
- **Estimated Time:** 28 hours
- **Priority:** HIGH
- **Deliverable:** Comprehensive documentation, testing, and production readiness

### Grand Total
- **Total Tasks:** 47
- **Estimated Time:** 101 hours (approximately 12-13 working days)
- **Timeline:** 9 weeks total

---

## Task Dependencies Diagram

```
Phase 1 (Portal)
├─ Week 1: Setup
│  └─ 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7 → 1.8
├─ Week 2: Core Pages
│  └─ 2.1 → 2.2 → 2.3
├─ Week 3: Sessions
│  └─ 3.1 → 3.2 → 3.3
└─ Week 4: Polish
   └─ 4.1 → 4.2 → 4.3 → 4.4 → 4.5 → 4.6 → 4.7 → 4.8 → 4.9

Phase 2 (Admin)
├─ Week 1: Setup
│  └─ 5.1 → 5.2 → 5.3 → 5.4 → 5.5 → 5.6 → 5.7 → 5.8
├─ Week 2: Tables
│  └─ 6.1 → 6.2 → 6.3
├─ Week 3: CRUD
│  └─ 7.1 → 7.2 → 7.3
└─ Week 4: Polish
   └─ 8.1 → 8.2 → 8.3 → 8.4 → 8.5 → 8.6 → 8.7 → 8.8 → 8.9

Phase 3 (Quality)
└─ Week 1: Final
   └─ 9.1 → 9.2 → 9.3 → 9.4 → 9.5 → 9.6 → 9.7 → 9.8 → 9.9 → 9.10
```

---

## Quick Reference: Key Files by Task

### Portal Files
- **Layout & Navigation:** `portal/src/components/Layout.tsx`
- **Dashboard:** `portal/src/pages/DashboardPage.tsx`
- **Session Creation:** `portal/src/pages/NewSessionPage.tsx`
- **Active Session:** `portal/src/pages/SessionPage.tsx`
- **Projector:** `portal/src/components/ClassroomProjector.tsx`
- **Config:** `portal/package.json`, `portal/vite.config.ts`, `portal/tailwind.config.js`
- **Styles:** `portal/src/index.css`

### Admin Files
- **Layout & Navigation:** `admin/src/components/Layout.tsx`
- **Dashboard:** `admin/src/pages/Dashboard.tsx`
- **Data Tables:** `admin/src/pages/Teachers.tsx`, `admin/src/pages/Students.tsx`
- **CRUD Pages:** `admin/src/pages/Divisions.tsx`, `admin/src/pages/Courses.tsx`, `admin/src/pages/ApiKeys.tsx`
- **Timetable:** `admin/src/pages/Assignments.tsx`
- **Config:** `admin/package.json`, `admin/vite.config.ts`, `admin/tailwind.config.js`
- **Styles:** `admin/src/index.css`

### Shared Patterns
- **UI Components:** `*/src/components/ui/*.tsx`
- **Theme Toggle:** `*/src/components/ThemeToggle.tsx`
- **Utils:** `*/src/lib/utils.ts`

---

## Notes

- All time estimates are for a single developer
- Dependencies must be completed before starting dependent tasks
- Phase 1 (Portal) is prioritized and can be deployed independently
- Testing tasks should not be skipped or rushed
- Documentation tasks are critical for maintainability
- Always test in both light and dark modes
- Respect `prefers-reduced-motion` for accessibility
- Keep rollback plan ready during deployments
