# Watermelon UI Migration - Design Document

## 1. Architecture Overview

### 1.1 High-Level Architecture

The migration transforms both the admin and teacher portals from a hybrid MUI/shadcn approach to a unified Watermelon UI component system. The architecture maintains existing backend integration patterns while modernizing the frontend presentation layer.

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Applications                     │
├──────────────────────────────┬──────────────────────────────┤
│      Teacher Portal          │       Admin Portal           │
│      (portal/)               │       (admin/)               │
├──────────────────────────────┴──────────────────────────────┤
│              Watermelon UI Component Layer                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Components (shadcn/ui architecture)                 │  │
│  │  - Card, Button, Dialog, Table, Select, Input       │  │
│  │  - Badge, Skeleton, Alert, Toast                     │  │
│  │  - Breadcrumb, Tabs, Dropdown, Command              │  │
│  │  - Charts (Recharts integration)                     │  │
│  └──────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│              Animation & Interaction Layer                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Framer Motion                                       │  │
│  │  - Page transitions, hover effects                   │  │
│  │  - Staggered animations, spring physics             │  │
│  │  - Loading states, micro-interactions                │  │
│  └──────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│                 Styling & Theming Layer                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Tailwind CSS v3                                     │  │
│  │  - Utility-first styling                             │  │
│  │  - CSS variables for theming                         │  │
│  │  - Dark mode (class-based)                           │  │
│  │  - Custom animations (tailwindcss-animate)           │  │
│  └──────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│              Primitive Components Layer                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Radix UI Primitives                                 │  │
│  │  - Accessible, unstyled components                   │  │
│  │  - Dialog, Select, Dropdown, Label, Tabs            │  │
│  │  - Slot, Toast, Separator                            │  │
│  └──────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│                 State & Data Management                      │
│  ┌─────────────────────┬──────────────────────────────────┐ │
│  │  Zustand            │  React Query (portal only)       │ │
│  │  - Global state     │  - Server state caching          │ │
│  │  - Auth state       │  - Real-time updates             │ │
│  └─────────────────────┴──────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│                     API Integration Layer                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Axios + Socket.IO                                   │  │
│  │  - REST API calls (adminApi.ts, portalApi.ts)       │  │
│  │  - Real-time WebSocket (teacher portal sessions)    │  │
│  │  - JWT authentication                                │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
         ┌────────────────────────────────────┐
         │    Backend API                     │
         │    https://api.atmyhome.tech/api/v1│
         └────────────────────────────────────┘
```

### 1.2 Component Architecture Principles

**Copy-Paste Architecture (shadcn/ui pattern):**
- Components are copied into the project (not installed as npm package)
- Full control over customization and styling
- Easy to modify and extend per project needs
- No dependency lock-in

**Composition Pattern:**
- Small, focused components that compose together
- Uses Radix UI primitives as foundation
- Variants managed with class-variance-authority (CVA)
- Props-based API for flexibility

**Styling Strategy:**
- Tailwind utility classes exclusively
- No CSS-in-JS or inline styles
- CSS variables for theme tokens
- Consistent spacing and typography scales

### 1.3 Dependency Changes

**Remove:**
```json
{
  "@mui/material": "^6.x",
  "@mui/icons-material": "^6.x",
  "@emotion/react": "^11.x",
  "@emotion/styled": "^11.x"
}
```

**Add (if not present):**
```json
{
  "framer-motion": "^13.1.1",
  "lucide-react": "^1.34.0",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "tailwind-merge": "^3.6.0",
  "tailwindcss-animate": "^1.0.7",
  "@radix-ui/react-*": "latest (as needed)",
  "sonner": "^2.0.8" (for toast notifications)
}
```

**Portal-Specific (keep):**
```json
{
  "qrcode.react": "^4.0.1",
  "socket.io-client": "^4.8.0",
  "@tanstack/react-query": "^5.59.0"
}
```

**Admin-Specific (keep):**
```json
{
  "recharts": "^3.10.1",
  "cmdk": "^1.1.1",
  "vaul": "^1.1.2"
}
```

### 1.4 Build Configuration

**Vite Configuration (vite.config.ts):**
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['framer-motion', 'lucide-react'],
          'vendor-radix': ['@radix-ui/react-dialog', '@radix-ui/react-select'],
        },
      },
    },
  },
})
```

**TypeScript Configuration (tsconfig.json):**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

---

## 2. Portal (Teacher Side) Design - **PRIORITY**

### 2.1 Page Designs

#### 2.1.1 DashboardPage

**Purpose:** Teacher home screen showing welcome message, quick stats, scheduled lectures, and active sessions.

**Component Hierarchy:**
```
DashboardPage
├── Header
│   ├── Welcome message with teacher name
│   ├── Refresh button (animated spinner)
│   └── "Start Session" button
├── Error Alert (conditional)
├── Quick Stats Grid (3 columns)
│   ├── Active Sessions Card (animate-in with delay: 0ms)
│   ├── Today's Sessions Card (animate-in with delay: 100ms)
│   └── Present Today Card (animate-in with delay: 200ms)
├── Today's Schedule Card (if timetable exists)
│   └── Lecture items with Start buttons
└── Live Sessions Card (if active sessions exist)
    └── Active session items with View buttons
```

**New Features:**
- **Staggered fade-in animation** for stat cards using Framer Motion
- **Hover lift effect** on stat cards (scale: 1.02, shadow increase)
- **Pulsing live indicator** on active session cards
- **Smooth page transition** on mount (fade in 300ms)

**Animation Specifications:**
```tsx
// Stat card animation
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, delay: index * 0.1 }}
  whileHover={{ scale: 1.02, y: -4 }}
>
  <Card>...</Card>
</motion.div>

// Live indicator pulse
<motion.div
  animate={{ scale: [1, 1.2, 1] }}
  transition={{ duration: 2, repeat: Infinity }}
>
  <Radio className="h-5 w-5 text-green-500" />
</motion.div>
```

**Component Mapping:**
- Keep: `Button`, `Card`, `Alert`, `Skeleton`
- Add: None (already has needed components)
- Enhance: Add Framer Motion wrappers

**Data Flow:**
```
loadData() → [getSessions(), getTimetable()] → setState → render with animations
```

**Current Implementation Status:** ✅ Mostly complete, needs animation layer

---

#### 2.1.2 NewSessionPage

**Purpose:** Form for teachers to manually start a new attendance session by selecting a course.

**Component Hierarchy:**
```
NewSessionPage
├── Header (Back button, title)
├── Form Card
│   ├── Course Selection (animated Select)
│   ├── Optional: Division override
│   ├── Optional: Start time override
│   └── Submit button (loading state)
└── Error Alert (conditional)
```

**New Features:**
- **Smooth select dropdown** with animated options
- **Form field focus animations** (ring expansion)
- **Submit button loading state** with spinner
- **Success toast** on session creation
- **Form validation feedback** with shake animation

**Animation Specifications:**
```tsx
// Select dropdown animation
<Select>
  <SelectContent>
    {options.map((option, i) => (
      <motion.div
        key={option.value}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: i * 0.05 }}
      >
        <SelectItem value={option.value}>
          {option.label}
        </SelectItem>
      </motion.div>
    ))}
  </SelectContent>
</Select>

// Form error shake
<motion.div
  animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
  transition={{ duration: 0.4 }}
>
  <Input {...field} />
  {error && <p className="text-sm text-destructive">{error}</p>}
</motion.div>
```

**Component Mapping:**
- Keep: `Button`, `Card`, `Select`, `Input`, `Label`
- Add: `Toast` (using Sonner)

**Form Validation:**
```typescript
interface NewSessionForm {
  course_code: string; // Required
  division_id?: string; // Optional override
  start_time?: string; // Optional override
}

const schema = {
  course_code: required("Please select a course"),
};
```

**Current Implementation Status:** 🟡 Needs new component creation

---

#### 2.1.3 SessionPage (Active Session)

**Purpose:** Display QR code, session metadata, and real-time attendance table for an active session.

**Component Hierarchy:**
```
SessionPage
├── Header
│   ├── Back button
│   └── Action buttons (Refresh, Export CSV, Show QR)
├── Session Info Card
│   ├── Course code & timestamp
│   ├── Live indicator (pulsing)
│   └── Stats (present count, total scans)
├── Error Alert (conditional)
├── Attendance Table Card
│   └── Real-time table (auto-refresh every 5s)
└── QR Dialog (modal)
    └── ClassroomProjector component
```

**New Features:**
- **QR code pulse animation** to indicate it's live
- **Real-time row animation** when new attendance appears
- **Hover highlight on table rows**
- **Export button feedback** (icon spin + toast)
- **Large, accessible QR display** in dialog
- **Connection status indicator** for real-time updates

**Animation Specifications:**
```tsx
// QR pulse animation
<motion.div
  animate={{ scale: [1, 1.05, 1] }}
  transition={{ duration: 3, repeat: Infinity }}
>
  <QRCodeSVG value={qrData} size={256} />
</motion.div>

// New attendance row animation (AnimatePresence)
<AnimatePresence mode="popLayout">
  {attendance.map((record) => (
    <motion.tr
      key={record.ledger_uuid}
      initial={{ opacity: 0, x: -20, backgroundColor: "hsl(var(--accent))" }}
      animate={{ opacity: 1, x: 0, backgroundColor: "transparent" }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
    >
      <TableCell>{record.student_roll_no}</TableCell>
      ...
    </motion.tr>
  ))}
</AnimatePresence>

// Row hover effect
<TableRow className="hover:bg-accent transition-colors duration-200">
```

**Component Mapping:**
- Keep: `Button`, `Card`, `Table`, `Dialog`, `Skeleton`
- Add: `Badge` (for status indicators), `Breadcrumb`
- Enhance: Add AnimatePresence for table rows

**Real-time Integration:**
```typescript
// Socket.IO listener (if available)
socket.on('attendance:new', (data) => {
  setAttendance(prev => [data, ...prev]); // AnimatePresence handles animation
});

// Fallback: polling every 5 seconds
useEffect(() => {
  const interval = setInterval(loadAttendance, 5000);
  return () => clearInterval(interval);
}, [sessionId]);
```

**Current Implementation Status:** ✅ Mostly complete, needs animation enhancements

---

#### 2.1.4 LoginPage

**Purpose:** Teacher authentication form.

**Component Hierarchy:**
```
LoginPage
├── Centered Container
│   ├── Logo/Header
│   ├── Login Form Card
│   │   ├── Email Input
│   │   ├── Password Input
│   │   └── Submit Button (loading state)
│   └── Error Alert (conditional)
```

**New Features:**
- **Focus animations** on inputs (ring color transition)
- **Submit button loading state** with spinner
- **Error shake animation** on failed login
- **Success transition** to dashboard

**Current Implementation Status:** 🟡 Exists, needs visual polish

---

### 2.2 Layout Component

**Purpose:** Shared layout wrapper with navigation, header, and content area.

**Component Hierarchy:**
```
Layout
├── Sidebar (collapsible on mobile)
│   ├── Logo/Branding
│   ├── Navigation Links
│   │   ├── Dashboard
│   │   ├── New Session
│   │   └── History (future)
│   └── User Menu
│       ├── Profile
│       ├── Settings
│       └── Logout
├── Main Content Area
│   ├── Breadcrumb Navigation
│   ├── Page Content (children)
│   └── Footer (optional)
└── Toast Container (Sonner)
```

**New Features:**
- **Breadcrumb navigation** (auto-generated from route)
- **Sidebar collapse animation** (smooth width transition)
- **Nav item hover effects** (background color slide)
- **User menu dropdown** with animated expansion

**Breadcrumb Implementation:**
```tsx
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const Breadcrumb = () => {
  const location = useLocation();
  const paths = location.pathname.split('/').filter(Boolean);
  
  return (
    <nav className="flex items-center gap-2 text-sm text-muted-foreground">
      <Link to="/" className="hover:text-foreground transition-colors">
        <Home className="h-4 w-4" />
      </Link>
      {paths.map((path, i) => (
        <div key={i} className="flex items-center gap-2">
          <ChevronRight className="h-4 w-4" />
          <Link 
            to={`/${paths.slice(0, i + 1).join('/')}`}
            className="hover:text-foreground transition-colors capitalize"
          >
            {path.replace('-', ' ')}
          </Link>
        </div>
      ))}
    </nav>
  );
};
```

**Component Mapping:**
- Keep: `Button`, `Dialog`
- Add: `Breadcrumb`, `Dropdown Menu`, `Separator`

**Current Implementation Status:** ✅ Exists (Layout.tsx), needs breadcrumb addition

---

### 2.3 Custom Components

#### 2.3.1 ClassroomProjector (Enhanced)

**Purpose:** Full-screen QR code display optimized for classroom projectors.

**Current Implementation:** Exists (ClassroomProjector.tsx)

**Enhancements Needed:**
- Larger QR code (512x512 minimum)
- High-contrast mode for projector visibility
- Animated instructions ("Scan to mark attendance")
- Session info header (course, division, time)
- Real-time student count display

**Design:**
```tsx
<div className="h-full flex flex-col bg-background">
  {/* Header */}
  <div className="p-8 border-b">
    <h1 className="text-4xl font-bold">{session.course_code}</h1>
    <p className="text-2xl text-muted-foreground">{session.division_name}</p>
  </div>
  
  {/* QR Code (centered) */}
  <div className="flex-1 flex items-center justify-center">
    <motion.div
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 3, repeat: Infinity }}
      className="p-8 bg-white rounded-2xl shadow-2xl"
    >
      <QRCodeSVG 
        value={qrData} 
        size={512}
        level="H"
        includeMargin
      />
    </motion.div>
  </div>
  
  {/* Footer with instructions */}
  <div className="p-8 border-t text-center">
    <motion.p
      animate={{ opacity: [0.7, 1, 0.7] }}
      transition={{ duration: 2, repeat: Infinity }}
      className="text-3xl font-semibold"
    >
      📱 Scan to mark your attendance
    </motion.p>
    <p className="text-xl text-muted-foreground mt-4">
      {presentCount} students present
    </p>
  </div>
</div>
```

---

#### 2.3.2 QRCodeModal (Deprecate)

**Action:** Remove this component, functionality merged into SessionPage Dialog

---

### 2.4 Portal Component Installation Plan

Components to install from Watermelon UI registry:

```bash
npx shadcn@latest add button card table dialog select input label alert skeleton badge breadcrumb dropdown-menu separator toast
```

**Installation Command for Portal:**
```bash
cd portal
npx shadcn@latest init

# When prompted:
# - TypeScript: Yes
# - Style: Default
# - Base color: Slate
# - CSS variables: Yes
# - Tailwind config: tailwind.config.js
# - Components path: @/components/ui
# - Utils path: @/lib/utils
# - React Server Components: No
# - Install via: npm

# Then install components:
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add table
npx shadcn@latest add dialog
npx shadcn@latest add select
npx shadcn@latest add input
npx shadcn@latest add label
npx shadcn@latest add alert
npx shadcn@latest add skeleton
npx shadcn@latest add badge
npx shadcn@latest add breadcrumb
npx shadcn@latest add dropdown-menu
npx shadcn@latest add separator
```

**Note:** Most components already exist in `portal/src/components/ui/`. We need to:
1. Verify they match shadcn/ui structure
2. Add missing components (badge, breadcrumb, dropdown-menu, separator)
3. Update existing components if needed

---

## 3. Admin Portal Design - Phase 2

### 3.1 Page Designs Overview

The admin portal migration follows after portal completion. Key pages:

1. **Dashboard** - College overview with animated stat cards
2. **Teachers** - Data table with CRUD operations
3. **Students** - Data table with CRUD operations
4. **Divisions** - Card-based list with actions
5. **Courses** - Card-based list with actions
6. **Assignments (Timetable)** - Calendar interface
7. **API Keys** - List with generation and revocation

**Common Patterns:**
- Data tables with hover effects
- Modal dialogs for CRUD forms
- Toast notifications for feedback
- Skeleton loading states
- Consistent action button styling

### 3.2 Admin Component Installation Plan

```bash
cd admin
# Same init process as portal
npx shadcn@latest add calendar command popover chart tooltip
```

Additional components needed:
- `Calendar` - For timetable/assignments page
- `Command` - Already installed (cmdk), for search
- `Popover` - For dropdowns and tooltips
- `Chart` - Already using Recharts
- `Tooltip` - For icon button hints

---

## 4. Component Installation & Setup

### 4.1 Watermelon UI Registry Setup

**Registry Configuration:**
```json
// components.json (generated by shadcn init)
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

**Alternative: Use Watermelon Registry directly:**
```bash
# Point to Watermelon registry instead of shadcn
# (if they have a custom registry endpoint)
npx shadcn@latest add button --registry=https://registry.watermelon.sh
```

**Note:** Watermelon UI is shadcn-compatible, so standard shadcn CLI works. If Watermelon has specific components, we'll add them manually from their GitHub.

### 4.2 Component Installation Sequence

**Phase 1 (Portal Priority):**
1. Initialize shadcn in portal directory
2. Audit existing `ui/` components
3. Add missing components: badge, breadcrumb, dropdown-menu, separator
4. Install Sonner for toasts: `npm install sonner`
5. Update index.css with any new CSS variables

**Phase 2 (Admin):**
1. Initialize shadcn in admin directory (if not done)
2. Add admin-specific components: calendar, popover, tooltip
3. Verify chart integration with Recharts

### 4.3 Utility Setup

**lib/utils.ts** (standard shadcn utility):
```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

This utility combines Tailwind classes intelligently, allowing overrides.

---

## 5. Animation Strategy

### 5.1 Framer Motion Integration

**Installation:**
```bash
npm install framer-motion
```

**Usage Patterns:**

#### 5.1.1 Page Transitions
```tsx
// App.tsx or Layout.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

function AnimatedOutlet() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.3 }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}
```

#### 5.1.2 Staggered Lists
```tsx
// Dashboard stats cards
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

<motion.div variants={container} initial="hidden" animate="show">
  {stats.map((stat, i) => (
    <motion.div key={i} variants={item}>
      <Card>...</Card>
    </motion.div>
  ))}
</motion.div>
```

#### 5.1.3 Hover Effects
```tsx
// Card hover lift
<motion.div
  whileHover={{ y: -4, scale: 1.02 }}
  transition={{ duration: 0.2 }}
>
  <Card>...</Card>
</motion.div>

// Button press effect
<motion.button
  whileTap={{ scale: 0.95 }}
  transition={{ duration: 0.1 }}
>
  Click me
</motion.button>
```

#### 5.1.4 Loading States
```tsx
// Spinner animation
<motion.div
  animate={{ rotate: 360 }}
  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
>
  <Loader2 className="h-4 w-4" />
</motion.div>

// Pulse effect (live indicators)
<motion.div
  animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
  transition={{ duration: 2, repeat: Infinity }}
>
  <Radio className="h-5 w-5 text-green-500" />
</motion.div>
```

#### 5.1.5 Modal/Dialog Animations
```tsx
// Dialog content animation (add to Dialog component)
<DialogContent>
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.95 }}
    transition={{ duration: 0.2 }}
  >
    {children}
  </motion.div>
</DialogContent>
```

### 5.2 CSS Transitions (Tailwind)

For simple transitions, use Tailwind classes:

```tsx
// Hover color change
<button className="bg-primary hover:bg-primary/90 transition-colors duration-200">
  Click
</button>

// Focus ring expansion
<input className="focus:ring-2 focus:ring-ring transition-shadow duration-150" />

// Background transition
<tr className="hover:bg-accent transition-colors duration-200">
```

### 5.3 Animation Performance Guidelines

**Best Practices:**
- Use `transform` and `opacity` for 60fps animations
- Avoid animating `width`, `height`, `top`, `left` (use `scale` instead)
- Use `will-change` sparingly
- Debounce rapid animations
- Respect `prefers-reduced-motion` media query

**Reduced Motion Support:**
```tsx
// Respect user preferences
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

<motion.div
  animate={prefersReducedMotion ? {} : { y: [0, -10, 0] }}
  transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
>
```

---

## 6. Styling System

### 6.1 Tailwind Configuration

**tailwind.config.js** (enhanced):
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-in-from-top": {
          from: { transform: "translateY(-10px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "slide-in-from-bottom": {
          from: { transform: "translateY(10px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in": "slide-in-from-bottom 0.3s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

### 6.2 CSS Variables (index.css)

**src/index.css:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}

/* Custom animations */
@layer utilities {
  .animate-fade-in {
    animation: fade-in 0.3s ease-out;
  }
  
  .animate-slide-in {
    animation: slide-in-from-bottom 0.3s ease-out;
  }
}
```

### 6.3 Dark Mode Implementation

**Dark Mode Toggle Component:**
```tsx
// components/ThemeToggle.tsx
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("theme") as "light" | "dark") || "light"
  );

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
    >
      {theme === "light" ? (
        <Moon className="h-5 w-5" />
      ) : (
        <Sun className="h-5 w-5" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
```

**Integration in Layout:**
```tsx
// Layout.tsx
<header className="border-b">
  <div className="flex items-center justify-between p-4">
    <h1>Attendance Portal</h1>
    <ThemeToggle />
  </div>
</header>
```

### 6.4 Typography Scale

**Headings:**
- `text-4xl font-bold` - Page titles (h1)
- `text-3xl font-bold` - Section headers (h2)
- `text-2xl font-semibold` - Card titles (h3)
- `text-xl font-semibold` - Subsections (h4)
- `text-lg font-medium` - Emphasized text

**Body:**
- `text-base` - Default body text
- `text-sm` - Secondary text, labels
- `text-xs` - Captions, metadata

**Spacing:**
- `space-y-6` - Between major sections
- `space-y-4` - Between cards
- `space-y-2` - Within forms
- `gap-4` - Grid/flex gaps

---

## 7. Migration Path & Phasing

### 7.1 Phase 1: Portal (Teacher Side) - PRIORITY

**Duration Estimate:** 2-3 weeks

**Week 1: Setup & Foundation**
- [ ] Remove MUI dependencies from package.json
- [ ] Install Framer Motion, Sonner, missing Radix components
- [ ] Initialize shadcn CLI in portal directory
- [ ] Audit existing `ui/` components vs shadcn standards
- [ ] Install missing components (badge, breadcrumb, dropdown-menu, separator)
- [ ] Update index.css with complete CSS variables
- [ ] Setup Tailwind config with animations
- [ ] Create ThemeToggle component
- [ ] Add Breadcrumb to Layout component

**Week 2: Page Migrations**
- [ ] Enhance DashboardPage with Framer Motion animations
  - Staggered stat card entrance
  - Hover effects on cards
  - Pulsing live indicators
- [ ] Create/enhance NewSessionPage
  - Animated select dropdown
  - Form validation with shake animation
  - Toast notifications with Sonner
- [ ] Enhance SessionPage
  - QR pulse animation
  - Real-time row animations with AnimatePresence
  - Improved table hover effects
- [ ] Enhance ClassroomProjector component
  - Larger QR code (512x512)
  - Animated instructions
  - Real-time student count

**Week 3: Polish & Testing**
- [ ] Add page transition animations (fade in/out)
- [ ] Implement loading states everywhere
- [ ] Test dark mode across all pages
- [ ] Test responsive layouts (mobile, tablet, desktop)
- [ ] Performance audit (Lighthouse)
- [ ] Accessibility audit (axe DevTools)
- [ ] Manual keyboard navigation testing
- [ ] Fix any animation jank or performance issues

**Deliverables:**
- Fully migrated teacher portal with zero MUI dependencies
- Smooth 60fps animations throughout
- Dark mode support
- Breadcrumb navigation
- Comprehensive loading states
- Toast notifications for all actions

---

### 7.2 Phase 2: Admin Portal

**Duration Estimate:** 3-4 weeks

**Week 1: Setup & Core Components**
- [ ] Remove MUI dependencies from admin package.json
- [ ] Install missing dependencies
- [ ] Initialize shadcn CLI in admin directory
- [ ] Audit and update `ui/` components
- [ ] Install admin-specific components (calendar, tooltip, popover)
- [ ] Update index.css and Tailwind config
- [ ] Add ThemeToggle and Breadcrumb to admin Layout

**Week 2: Dashboard & Data Tables**
- [ ] Migrate Dashboard page
  - Animated stat cards
  - Chart animations (Recharts)
- [ ] Migrate Teachers page
  - Animated data table
  - CRUD modals with animations
  - Row hover effects
- [ ] Migrate Students page
  - Same as Teachers

**Week 3: CRUD Pages**
- [ ] Migrate Divisions page
  - Card-based layout
  - Animated CRUD dialogs
- [ ] Migrate Courses page
  - Same as Divisions
- [ ] Migrate API Keys page
  - Key generation modal
  - Copy feedback animation

**Week 4: Timetable & Polish**
- [ ] Migrate Assignments (Timetable) page
  - Calendar component integration
  - Date selection animations
  - Assignment creation dialog
- [ ] Polish all pages
- [ ] Add page transitions
- [ ] Comprehensive testing
- [ ] Performance & accessibility audits

**Deliverables:**
- Fully migrated admin portal with zero MUI dependencies
- Consistent design language with teacher portal
- All CRUD operations working smoothly
- Toast notifications throughout
- Calendar-based timetable management

---

### 7.3 Backward Compatibility Strategy

**During Migration:**
- Both portals can be migrated independently (separate deployments)
- Backend API remains unchanged (no breaking changes)
- Mobile Flutter app unaffected

**Gradual Rollout:**
1. Deploy migrated portal to staging environment
2. Test thoroughly with teachers
3. Deploy to production (feature flag if needed)
4. Repeat for admin portal

**Rollback Plan:**
- Keep MUI versions in separate git branches
- Maintain Docker images of pre-migration builds
- Can roll back deployments if critical issues found

---

## 8. Component Reference Guide

### 8.1 Core Components (Watermelon UI / shadcn)

#### Button
```tsx
import { Button } from "@/components/ui/button"

<Button variant="default | destructive | outline | secondary | ghost | link" size="default | sm | lg | icon">
  Click me
</Button>
```

#### Card
```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description</CardDescription>
  </CardHeader>
  <CardContent>
    Content goes here
  </CardContent>
  <CardFooter>
    Footer content
  </CardFooter>
</Card>
```

#### Table
```tsx
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Column 1</TableHead>
      <TableHead>Column 2</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Data 1</TableCell>
      <TableCell>Data 2</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

#### Dialog
```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>Dialog description</DialogDescription>
    </DialogHeader>
    <div>Dialog body content</div>
    <DialogFooter>
      <Button onClick={() => setOpen(false)}>Close</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

#### Select
```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

<Select value={value} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="Select option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
  </SelectContent>
</Select>
```

#### Input
```tsx
import { Input } from "@/components/ui/input"

<Input type="text" placeholder="Enter text" value={value} onChange={e => setValue(e.target.value)} />
```

#### Label
```tsx
import { Label } from "@/components/ui/label"

<Label htmlFor="input-id">Label text</Label>
<Input id="input-id" />
```

#### Alert
```tsx
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

<Alert variant="default | destructive">
  <AlertTitle>Alert Title</AlertTitle>
  <AlertDescription>Alert message</AlertDescription>
</Alert>
```

#### Skeleton
```tsx
import { Skeleton } from "@/components/ui/skeleton"

<Skeleton className="h-32 w-full" />
```

#### Badge
```tsx
import { Badge } from "@/components/ui/badge"

<Badge variant="default | secondary | destructive | outline">Badge</Badge>
```

#### Breadcrumb
```tsx
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"

<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem>
      <BreadcrumbLink href="/">Home</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbPage>Current Page</BreadcrumbPage>
    </BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>
```

#### Toast (Sonner)
```tsx
import { Toaster, toast } from "sonner"

// In Layout or App:
<Toaster position="bottom-right" />

// Usage:
toast.success("Success message")
toast.error("Error message")
toast.info("Info message")
toast.promise(promise, {
  loading: 'Loading...',
  success: 'Success!',
  error: 'Error occurred',
})
```

### 8.2 Icon Library (Lucide React)

**Common Icons:**
```tsx
import {
  Home, Users, Calendar, Settings, LogOut,
  Plus, Edit, Trash2, Download, Upload,
  ChevronLeft, ChevronRight, ChevronDown,
  Check, X, Search, Filter,
  Radio, QrCode, Clock, Play,
  Loader2, RefreshCw, AlertCircle,
} from "lucide-react"

// Usage:
<Home className="h-4 w-4" />
<Users className="mr-2 h-5 w-5" />
<Loader2 className="animate-spin" />
```

**Icon Sizing Convention:**
- `h-3 w-3` - Very small (12px)
- `h-4 w-4` - Small, inline with text (16px)
- `h-5 w-5` - Default (20px)
- `h-6 w-6` - Large (24px)
- `h-8 w-8` - Extra large (32px)

### 8.3 Animation Patterns

**Fade In:**
```tsx
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.3 }}
>
```

**Slide In:**
```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
```

**Stagger Children:**
```tsx
<motion.div
  variants={{
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }}
  initial="hidden"
  animate="show"
>
  {items.map(item => (
    <motion.div
      key={item.id}
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
      }}
    >
```

**Hover Effect:**
```tsx
<motion.div
  whileHover={{ scale: 1.05, y: -4 }}
  transition={{ duration: 0.2 }}
>
```

**List Item Animation (with exit):**
```tsx
<AnimatePresence mode="popLayout">
  {items.map(item => (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      layout
    >
```

---

## 9. Testing Strategy

### 9.1 Visual Testing Checklist

**Per Page:**
- [ ] Components render correctly in light mode
- [ ] Components render correctly in dark mode
- [ ] Hover states work on interactive elements
- [ ] Focus states visible for keyboard navigation
- [ ] Loading skeletons match final layout
- [ ] Animations run smoothly at 60fps
- [ ] No layout shift during loading
- [ ] Icons sized consistently

**Responsive Testing:**
- [ ] Mobile (375px): Single column, touch-friendly
- [ ] Tablet (768px): 2-column where appropriate
- [ ] Desktop (1024px+): Full multi-column layouts
- [ ] No horizontal scroll at any breakpoint

### 9.2 Functional Testing Checklist

**Portal (Teacher):**
- [ ] Login/logout flow works
- [ ] Dashboard loads with correct stats
- [ ] Can start new session from dashboard
- [ ] Can start session from schedule
- [ ] SessionPage displays QR code correctly
- [ ] Attendance updates in real-time (or every 5s)
- [ ] Can export attendance CSV
- [ ] QR dialog opens and displays full-screen
- [ ] Can navigate back to dashboard
- [ ] Toast notifications appear for all actions
- [ ] Error states display correctly

**Admin:**
- [ ] Login/logout flow works
- [ ] Dashboard loads with college stats
- [ ] Can create/edit/delete teachers
- [ ] Can create/edit/delete students
- [ ] Can manage divisions
- [ ] Can manage courses
- [ ] Can create timetable assignments
- [ ] Calendar navigation works
- [ ] Can generate API keys
- [ ] Can revoke API keys
- [ ] Copy-to-clipboard provides feedback

### 9.3 Performance Testing

**Metrics to Track:**
- First Contentful Paint (FCP): < 1.5s
- Largest Contentful Paint (LCP): < 2.5s
- Time to Interactive (TTI): < 3.5s
- Cumulative Layout Shift (CLS): < 0.1
- Bundle size reduction: > 30% (after MUI removal)

**Tools:**
- Lighthouse (Chrome DevTools)
- Bundle analyzer: `npm run build -- --analyze`
- React DevTools Profiler

**Target Bundle Sizes (gzipped):**
- Portal: < 300KB total JS
- Admin: < 350KB total JS

### 9.4 Accessibility Testing

**Automated Tools:**
- axe DevTools (Chrome extension)
- Lighthouse accessibility audit
- WAVE (WebAIM)

**Manual Testing:**
- [ ] Keyboard navigation (Tab, Enter, Escape, Arrow keys)
- [ ] Screen reader (NVDA/JAWS on Windows, VoiceOver on Mac)
- [ ] Focus indicators visible
- [ ] Color contrast ratios meet WCAG AA (4.5:1 for text)
- [ ] Form labels associated with inputs
- [ ] Error messages announced by screen readers
- [ ] Modals trap focus when open
- [ ] Skip links available (if needed)

**WCAG 2.1 AA Requirements:**
- Perceivable: Text alternatives, adaptable, distinguishable
- Operable: Keyboard accessible, enough time, seizure-safe, navigable
- Understandable: Readable, predictable, input assistance
- Robust: Compatible with assistive technologies

### 9.5 Browser Testing

**Target Browsers:**
- Chrome 100+ (primary)
- Edge 100+
- Firefox 100+
- Safari 15+

**Known Issues to Watch:**
- Safari: Framer Motion spring animations may differ slightly
- Firefox: Some CSS grid behaviors differ
- All: Ensure `prefers-reduced-motion` respected

---

## 10. API Integration Preservation

### 10.1 Portal API Service (portalApi.ts)

**Current Implementation:** Uses Axios with interceptors for JWT auth

**Endpoints Used:**
- `GET /sessions` - List teacher's sessions
- `POST /sessions` - Start new session
- `GET /sessions/:id` - Get session details
- `GET /sessions/:id/attendance` - Get attendance records
- `GET /timetable` - Get today's timetable
- `POST /auth/login` - Teacher login
- `POST /auth/refresh` - Refresh JWT token

**No Changes Needed:** API service remains identical, only UI changes.

### 10.2 Admin API Service (adminApi.ts)

**Current Implementation:** Uses Axios with admin auth

**Endpoints Used:**
- Dashboard stats: `GET /stats`
- Teachers CRUD: `GET/POST/PUT/DELETE /teachers`
- Students CRUD: `GET/POST/PUT/DELETE /students`
- Divisions CRUD: `GET/POST/PUT/DELETE /divisions`
- Courses CRUD: `GET/POST/PUT/DELETE /courses`
- Timetable: `GET/POST/PUT/DELETE /timetable`
- API Keys: `GET/POST/DELETE /apikeys`

**No Changes Needed:** API service remains identical.

### 10.3 Socket.IO Integration (Portal)

**Current Usage:** Real-time attendance updates in SessionPage

**Implementation:**
```typescript
// services/socket.ts
import { io } from 'socket.io-client';

const socket = io('https://api.atmyhome.tech', {
  auth: {
    token: localStorage.getItem('token')
  }
});

socket.on('connect', () => {
  console.log('Connected to real-time server');
});

socket.on('attendance:new', (data) => {
  // Handle new attendance record
});

export default socket;
```

**Usage in SessionPage:**
```tsx
useEffect(() => {
  socket.emit('session:join', sessionId);
  
  socket.on('attendance:new', (attendance) => {
    setAttendance(prev => [attendance, ...prev]);
  });
  
  return () => {
    socket.emit('session:leave', sessionId);
    socket.off('attendance:new');
  };
}, [sessionId]);
```

**No Changes Needed:** Socket.IO integration remains the same, just add animations to new attendance rows.

### 10.4 QR Code Generation (qrcode.react)

**Current Usage:** Displaying session QR codes

**Implementation:**
```tsx
import { QRCodeSVG } from 'qrcode.react';

<QRCodeSVG
  value={`${process.env.VITE_APP_URL}/scan/${sessionId}/${session.qr_token}`}
  size={256}
  level="H"
  includeMargin={true}
/>
```

**Enhancements:**
- Increase size to 512x512 for projector display
- Add pulse animation with Framer Motion
- Ensure high contrast in both light and dark modes

**No API Changes:** QR data format remains the same.

---

## 11. Error Handling & Loading States

### 11.1 Error Handling Patterns

**API Error Display:**
```tsx
const [error, setError] = useState<string | null>(null);

try {
  const res = await portalApi.getSessions();
  setSessions(res.data);
  setError(null);
} catch (err: any) {
  setError(err?.response?.data?.error?.message || 'Failed to load sessions');
  toast.error('Failed to load sessions');
}

// In render:
{error && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription>{error}</AlertDescription>
  </Alert>
)}
```

**Form Validation Errors:**
```tsx
<div>
  <Input
    {...field}
    className={errors.course_code ? 'border-destructive' : ''}
  />
  {errors.course_code && (
    <motion.p
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-sm text-destructive mt-1"
    >
      {errors.course_code.message}
    </motion.p>
  )}
</div>
```

**Network Error Handling:**
```tsx
// Axios interceptor (already in place)
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/login';
    } else if (error.response?.status === 500) {
      toast.error('Server error. Please try again later.');
    } else if (!error.response) {
      toast.error('Network error. Check your connection.');
    }
    return Promise.reject(error);
  }
);
```

### 11.2 Loading State Patterns

**Page Loading:**
```tsx
const [loading, setLoading] = useState(true);

useEffect(() => {
  loadData();
}, []);

if (loading) {
  return (
    <div className="space-y-4">
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

return <div>{/* actual content */}</div>;
```

**Button Loading:**
```tsx
const [submitting, setSubmitting] = useState(false);

<Button disabled={submitting} onClick={handleSubmit}>
  {submitting ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Processing...
    </>
  ) : (
    'Submit'
  )}
</Button>
```

**Table Loading:**
```tsx
{loading ? (
  <TableBody>
    {[...Array(5)].map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      </TableRow>
    ))}
  </TableBody>
) : (
  <TableBody>
    {data.map(row => (
      <TableRow key={row.id}>...</TableRow>
    ))}
  </TableBody>
)}
```

**Inline Refresh Loading:**
```tsx
<Button variant="outline" size="icon" onClick={refresh} disabled={refreshing}>
  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
</Button>
```

---

## 12. Deployment Considerations

### 12.1 Docker Build

**Portal Dockerfile (unchanged):**
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Build Command:**
```bash
docker build -t attendance-portal:latest ./portal
docker build -t attendance-admin:latest ./admin
```

### 12.2 Environment Variables

**Portal (.env):**
```
VITE_API_URL=https://api.atmyhome.tech/api/v1
VITE_APP_URL=https://portal.atmyhome.tech
```

**Admin (.env):**
```
VITE_API_URL=https://api.atmyhome.tech/api/v1
```

### 12.3 Bundle Size Monitoring

**Before Migration (estimated):**
- Portal: ~800KB (with MUI)
- Admin: ~900KB (with MUI)

**After Migration (target):**
- Portal: ~500KB (37% reduction)
- Admin: ~600KB (33% reduction)

**Monitoring:**
```bash
npm run build
npx vite-bundle-visualizer
```

### 12.4 CDN & Caching

**Nginx Configuration (nginx.conf.template):**
```nginx
server {
    listen 80;
    server_name ${NGINX_HOST};
    root /usr/share/nginx/html;
    index index.html;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Don't cache HTML
    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 13. Future Enhancements

### 13.1 Additional Watermelon Components

**Future Pages/Features:**
- Command Palette (Cmd+K) for quick navigation
- Data visualization dashboard with advanced charts
- Drag-and-drop timetable editor
- Advanced filtering and search
- Export reports with custom formats

**Components to Add Later:**
- `Command` - Already installed in admin, add to portal
- `Popover` - For tooltips and popovers
- `Tooltip` - For icon button hints
- `Accordion` - For expandable sections
- `Tabs` - For tabbed interfaces
- `Progress` - For upload/download progress
- `Slider` - For range inputs

### 13.2 Advanced Animations

**Page Transitions with Route-Based Animations:**
```tsx
// Different animations per route
const pageTransitions = {
  '/dashboard': { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } },
  '/sessions/new': { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 } },
  '/sessions/:id': { initial: { opacity: 0, x: 100 }, animate: { opacity: 1, x: 0 } },
};
```

**Gesture-Based Interactions:**
```tsx
// Swipe to dismiss (mobile)
<motion.div
  drag="x"
  dragConstraints={{ left: 0, right: 0 }}
  onDragEnd={(e, info) => {
    if (info.offset.x > 100) handleDismiss();
  }}
>
```

### 13.3 Performance Optimizations

**Code Splitting:**
```tsx
// Lazy load pages
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SessionPage = lazy(() => import('./pages/SessionPage'));

<Suspense fallback={<Skeleton className="h-screen" />}>
  <Routes>
    <Route path="/" element={<DashboardPage />} />
    <Route path="/sessions/:id" element={<SessionPage />} />
  </Routes>
</Suspense>
```

**Memoization:**
```tsx
const StatCard = memo(({ title, value, icon }: StatCardProps) => (
  <Card>...</Card>
));

const memoizedData = useMemo(() => processData(rawData), [rawData]);
```

**Virtual Scrolling (for large tables):**
```tsx
// Use @tanstack/react-virtual for tables with 1000+ rows
import { useVirtualizer } from '@tanstack/react-virtual';
```

### 13.4 Accessibility Enhancements

**Skip Links:**
```tsx
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground">
  Skip to main content
</a>
```

**Keyboard Shortcuts:**
```tsx
// Global keyboard shortcuts
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.metaKey && e.key === 'k') {
      e.preventDefault();
      openCommandPalette();
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

**Announce Dynamic Changes:**
```tsx
// ARIA live regions for real-time updates
<div role="status" aria-live="polite" className="sr-only">
  {announceMessage}
</div>

// When new attendance arrives:
setAnnounceMessage(`${student.name} marked present`);
```

---

## 14. Risk Mitigation

### 14.1 Potential Risks

**Technical Risks:**
1. **Animation Performance:** Framer Motion animations could cause jank on low-end devices
   - *Mitigation:* Use `prefers-reduced-motion`, optimize animations, test on low-end hardware
   
2. **Bundle Size Increase:** Adding Framer Motion increases bundle size
   - *Mitigation:* Tree-shake unused components, code split routes, monitor bundle size

3. **Breaking Changes:** Removing MUI might reveal undiscovered dependencies
   - *Mitigation:* Thorough code search for MUI imports, gradual removal, extensive testing

4. **Dark Mode Issues:** CSS variable-based theming might have edge cases
   - *Mitigation:* Comprehensive dark mode testing, QA on all pages

**User Experience Risks:**
1. **User Confusion:** Visual changes might confuse existing users
   - *Mitigation:* Maintain similar layouts, provide onboarding tooltips if needed

2. **Accessibility Regression:** New components might have accessibility issues
   - *Mitigation:* Use Radix UI primitives (already accessible), test with screen readers

3. **Mobile Usability:** Animations might not work well on mobile
   - *Mitigation:* Test on real devices, reduce motion on mobile if needed

**Project Risks:**
1. **Timeline Overrun:** Migration takes longer than estimated
   - *Mitigation:* Phased approach (portal first), MVP feature set, defer polish

2. **Resource Unavailability:** Dependencies become unavailable
   - *Mitigation:* Lock dependency versions, keep copies of critical components

### 14.2 Rollback Strategy

**Git Strategy:**
```bash
# Create migration branch
git checkout -b migration/watermelon-ui

# Keep main stable
git checkout main

# If issues arise after deployment:
git revert <migration-commit>
docker build -t attendance-portal:rollback .
# Deploy rollback image
```

**Feature Flags (optional):**
```tsx
// If gradual rollout needed
const useNewUI = import.meta.env.VITE_ENABLE_NEW_UI === 'true';

{useNewUI ? <NewDashboard /> : <OldDashboard />}
```

**Database Compatibility:**
- No database schema changes required
- API remains backward compatible
- Can run old and new frontends simultaneously

---

## 15. Success Metrics & Acceptance Criteria

### 15.1 Technical Metrics

**Bundle Size:**
- [ ] Portal bundle < 500KB (gzipped)
- [ ] Admin bundle < 600KB (gzipped)
- [ ] At least 30% reduction from pre-migration

**Performance:**
- [ ] Lighthouse performance score ≥ 90
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3.5s
- [ ] No layout shift (CLS < 0.1)

**Code Quality:**
- [ ] Zero ESLint errors
- [ ] Zero TypeScript errors
- [ ] All components have proper types
- [ ] No `any` types (except necessary)

### 15.2 Functional Metrics

**Feature Parity:**
- [ ] All existing features work identically
- [ ] No regressions in functionality
- [ ] Real-time updates work correctly
- [ ] QR code generation works
- [ ] CSV export works
- [ ] All CRUD operations work

**User Experience:**
- [ ] All animations run at 60fps
- [ ] No animation jank or stutter
- [ ] Hover effects work consistently
- [ ] Loading states provide clear feedback
- [ ] Error states display helpful messages
- [ ] Toast notifications appear for all actions

### 15.3 Accessibility Metrics

**WCAG 2.1 AA Compliance:**
- [ ] axe DevTools reports zero critical issues
- [ ] Lighthouse accessibility score ≥ 95
- [ ] All interactive elements keyboard accessible
- [ ] Focus indicators visible
- [ ] Color contrast ratios ≥ 4.5:1
- [ ] Screen reader testing passes

**Keyboard Navigation:**
- [ ] Tab order logical on all pages
- [ ] Escape closes modals
- [ ] Enter submits forms
- [ ] Arrow keys navigate lists (where applicable)

### 15.4 User Acceptance

**Teacher Portal:**
- [ ] Teachers can log in
- [ ] Can view dashboard with stats
- [ ] Can start sessions from schedule
- [ ] Can manually start sessions
- [ ] Can view active sessions with QR
- [ ] Can see real-time attendance
- [ ] Can export attendance CSV
- [ ] Dark mode works correctly

**Admin Portal:**
- [ ] Admins can log in
- [ ] Can view college stats
- [ ] Can manage teachers
- [ ] Can manage students
- [ ] Can manage divisions and courses
- [ ] Can create timetable assignments
- [ ] Can generate/revoke API keys
- [ ] All CRUD operations work smoothly

### 15.5 Final Checklist

**Before Production Deployment:**
- [ ] All unit tests pass (if any)
- [ ] Manual testing complete (all pages, all features)
- [ ] Browser compatibility testing complete
- [ ] Mobile responsive testing complete
- [ ] Dark mode testing complete
- [ ] Accessibility testing complete
- [ ] Performance testing complete
- [ ] Security audit (no exposed secrets, XSS prevention)
- [ ] Bundle size within targets
- [ ] Docker builds successful
- [ ] Staging deployment successful
- [ ] User acceptance testing complete
- [ ] Documentation updated
- [ ] Rollback plan ready

---

## 16. Component Inventory

### 16.1 Portal Components Status

| Component | Status | Action Required |
|-----------|--------|-----------------|
| Button | ✅ Exists | Verify shadcn structure |
| Card | ✅ Exists | Verify shadcn structure |
| Table | ✅ Exists | Verify shadcn structure |
| Dialog | ✅ Exists | Verify shadcn structure |
| Select | ✅ Exists | Verify shadcn structure |
| Input | ✅ Exists | Verify shadcn structure |
| Label | ✅ Exists | Verify shadcn structure |
| Alert | ✅ Exists | Verify shadcn structure |
| Skeleton | ✅ Exists | Verify shadcn structure |
| Badge | ❌ Missing | Install via shadcn CLI |
| Breadcrumb | ❌ Missing | Install via shadcn CLI |
| Dropdown Menu | ❌ Missing | Install via shadcn CLI |
| Separator | ❌ Missing | Install via shadcn CLI |
| Toast (Sonner) | ❌ Missing | Install sonner package |

### 16.2 Admin Components Status

| Component | Status | Action Required |
|-----------|--------|-----------------|
| Button | ✅ Exists | Verify shadcn structure |
| Card | ✅ Exists | Verify shadcn structure |
| Table | ✅ Exists | Verify shadcn structure |
| Dialog | ✅ Exists | Verify shadcn structure |
| Select | ✅ Exists | Verify shadcn structure |
| Input | ✅ Exists | Verify shadcn structure |
| Label | ✅ Exists | Verify shadcn structure |
| Alert | ✅ Exists | Verify shadcn structure |
| Skeleton | ✅ Exists | Verify shadcn structure |
| Badge | ❌ Missing | Install via shadcn CLI |
| Breadcrumb | ❌ Missing | Install via shadcn CLI |
| Dropdown Menu | ✅ Exists | Verify shadcn structure |
| Separator | ✅ Exists | Verify shadcn structure |
| Calendar | ❌ Missing | Install via shadcn CLI |
| Popover | ❌ Missing | Install via shadcn CLI |
| Tooltip | ❌ Missing | Install via shadcn CLI |
| Toast (Sonner) | ✅ Exists | Already using sonner |
| Command | ✅ Exists | Already using cmdk |

### 16.3 Pages Requiring Updates

**Portal:**
- [ ] DashboardPage - Add animations, enhance layout
- [ ] NewSessionPage - Create/enhance form
- [ ] SessionPage - Add real-time animations
- [ ] LoginPage - Polish design
- [ ] Layout - Add breadcrumbs
- [ ] ClassroomProjector - Enhance QR display

**Admin:**
- [ ] Dashboard - Add animations
- [ ] Teachers - Enhance table
- [ ] Students - Enhance table
- [ ] Divisions - Polish design
- [ ] Courses - Polish design
- [ ] Assignments - Add calendar
- [ ] API Keys - Polish design
- [ ] Layout - Add breadcrumbs

---

## 17. Code Examples

### 17.1 Animated Stat Card Component

```tsx
// components/StatCard.tsx
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle: string;
  icon: LucideIcon;
  iconColor?: string;
  delay?: number;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-primary',
  delay = 0,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      whileHover={{ y: -4, scale: 1.02 }}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Usage:
<div className="grid gap-4 md:grid-cols-3">
  <StatCard
    title="Active Sessions"
    value={activeSessions}
    subtitle="Live attendance tracking"
    icon={Radio}
    iconColor="text-green-500"
    delay={0}
  />
  <StatCard
    title="Today's Sessions"
    value={todaySessions}
    subtitle="Total sessions conducted"
    icon={Calendar}
    iconColor="text-blue-500"
    delay={0.1}
  />
  <StatCard
    title="Present Today"
    value={presentToday}
    subtitle="Students marked present"
    icon={Users}
    iconColor="text-purple-500"
    delay={0.2}
  />
</div>
```

### 17.2 Animated Table Row Component

```tsx
// components/AnimatedTableRow.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { TableRow, TableCell } from '@/components/ui/table';

interface AnimatedTableRowProps {
  children: React.ReactNode;
  id: string;
  isNew?: boolean;
}

export function AnimatedTableRow({ children, id, isNew = false }: AnimatedTableRowProps) {
  return (
    <motion.tr
      key={id}
      initial={isNew ? { opacity: 0, x: -20, backgroundColor: 'hsl(var(--accent))' } : false}
      animate={{ opacity: 1, x: 0, backgroundColor: 'transparent' }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="hover:bg-accent transition-colors"
    >
      {children}
    </motion.tr>
  );
}

// Usage in SessionPage:
<TableBody>
  <AnimatePresence mode="popLayout">
    {attendance.map((record, i) => (
      <AnimatedTableRow key={record.ledger_uuid} id={record.ledger_uuid} isNew={i === 0 && justAdded}>
        <TableCell>{record.student_roll_no}</TableCell>
        <TableCell>{record.student_email}</TableCell>
        <TableCell>{new Date(record.client_claimed_time).toLocaleTimeString()}</TableCell>
        <TableCell>
          <Badge variant={record.status === 'PRESENT' ? 'default' : 'secondary'}>
            {record.status}
          </Badge>
        </TableCell>
      </AnimatedTableRow>
    ))}
  </AnimatePresence>
</TableBody>
```

### 17.3 Loading Button Component

```tsx
// components/LoadingButton.tsx
import { Button, ButtonProps } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
  loadingText?: string;
}

export function LoadingButton({
  children,
  loading = false,
  loadingText,
  disabled,
  ...props
}: LoadingButtonProps) {
  return (
    <Button disabled={disabled || loading} {...props}>
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {loadingText || 'Loading...'}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

// Usage:
<LoadingButton
  loading={submitting}
  loadingText="Creating session..."
  onClick={handleStartSession}
>
  <Play className="mr-2 h-4 w-4" />
  Start Session
</LoadingButton>
```

### 17.4 Enhanced ClassroomProjector Component

```tsx
// components/ClassroomProjector.tsx
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { portalApi } from '@/services/portalApi';
import { Users, Clock } from 'lucide-react';

interface ClassroomProjectorProps {
  sessionId: string;
}

export default function ClassroomProjector({ sessionId }: ClassroomProjectorProps) {
  const [session, setSession] = useState<any>(null);
  const [presentCount, setPresentCount] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      const [sessionRes, attendanceRes] = await Promise.all([
        portalApi.getSession(sessionId),
        portalApi.getSessionAttendance(sessionId),
      ]);
      setSession(sessionRes.data);
      setPresentCount(attendanceRes.data.filter((a: any) => a.status === 'PRESENT').length);
    };

    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [sessionId]);

  if (!session) return null;

  const qrData = `${import.meta.env.VITE_APP_URL}/scan/${sessionId}/${session.qr_token}`;

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-background to-accent/20">
      {/* Header */}
      <div className="p-12 border-b">
        <h1 className="text-5xl font-bold mb-2">{session.course_code}</h1>
        <div className="flex items-center gap-6 text-2xl text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-6 w-6" />
            <span>{new Date(session.created_at).toLocaleTimeString()}</span>
          </div>
          <span>•</span>
          <span>{session.division_name || 'All Divisions'}</span>
        </div>
      </div>

      {/* QR Code */}
      <div className="flex-1 flex items-center justify-center p-12">
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="p-12 bg-white dark:bg-gray-900 rounded-3xl shadow-2xl"
        >
          <QRCodeSVG
            value={qrData}
            size={512}
            level="H"
            includeMargin={true}
            bgColor="transparent"
            fgColor="currentColor"
            className="text-foreground"
          />
        </motion.div>
      </div>

      {/* Footer */}
      <div className="p-12 border-t">
        <motion.div
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-center mb-6"
        >
          <p className="text-4xl font-semibold">
            📱 Scan to mark your attendance
          </p>
        </motion.div>
        
        <div className="flex items-center justify-center gap-4 text-2xl text-muted-foreground">
          <Users className="h-8 w-8" />
          <span className="font-bold text-foreground">{presentCount}</span>
          <span>students present</span>
        </div>
      </div>
    </div>
  );
}
```

---

## 18. Conclusion

This design document provides a comprehensive blueprint for migrating the attendance-gateway project from Material-UI to Watermelon UI. The migration is structured in two phases, with the teacher portal (most critical for daily operations) prioritized first.

**Key Takeaways:**

1. **Component Architecture:** Using shadcn/ui's copy-paste approach provides full control and eliminates package dependencies
2. **Animation Strategy:** Framer Motion adds polish and micro-interactions that enhance user experience
3. **Styling System:** Tailwind CSS with CSS variables provides a consistent, themeable design system
4. **Phased Approach:** Portal first, admin second minimizes risk and allows for iterative feedback
5. **API Preservation:** No backend changes required, maintaining stability
6. **Performance Focus:** Bundle size reduction and 60fps animations improve user experience
7. **Accessibility:** Radix UI primitives ensure WCAG 2.1 AA compliance out of the box

**Next Steps:**

1. Review and approve this design document
2. Create detailed task breakdown in tasks.md
3. Begin Phase 1: Portal migration
4. Iterative testing and refinement
5. Deploy to production
6. Begin Phase 2: Admin migration

The migration will result in a modern, performant, accessible UI that sets the foundation for future feature development while maintaining all existing functionality.
