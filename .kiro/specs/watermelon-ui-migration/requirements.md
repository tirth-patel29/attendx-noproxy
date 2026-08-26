# UI Migration Requirements Document

## Introduction

The attendance-gateway project requires a comprehensive UI redesign and migration to modernize both the admin portal and teacher portal. Currently, both portals use Material-UI (MUI) components with inconsistent theming and dated visual design. The admin portal has been partially migrated to shadcn/ui components, while the teacher portal still heavily relies on MUI with a dark theme. This migration will remove all MUI dependencies, implement Watermelon UI components (https://ui.watermelon.sh), and create a cohesive, modern, animated user experience across both portals.

**Project Scope:** Complete UI redesign of admin and teacher portals

**User Impact:** ALL users (administrators and teachers)

**Design System:** Watermelon UI (shadcn/ui-compatible registry with 260+ components)

**Technical Stack:**
- React 18+ with TypeScript
- Tailwind CSS v4
- Radix UI primitives
- Framer Motion for animations
- Watermelon UI component registry
- NO Material-UI dependencies

## Background

### Current State Analysis

**Admin Portal (admin/):**
- Uses shadcn/ui components for some UI elements (Card, Button, Dialog, Select, Table)
- Still contains MUI dependencies (@mui/material, @mui/icons-material, @emotion/react, @emotion/styled)
- Has modern Tailwind-based components but lacks consistent animations
- Pages: Dashboard, Teachers, Students, Divisions, Courses, Assignments, API Keys
- Already has some Watermelon-compatible infrastructure (Radix UI, Framer Motion, lucide-react icons)

**Teacher Portal (portal/):**
- Heavily relies on MUI components with dark theme
- Contains full MUI dependency stack
- Pages: DashboardPage, NewSessionPage, SessionPage (active sessions with QR codes)
- Uses some shadcn/ui components but not consistently
- Has real-time session management with Socket.IO
- Displays QR codes for student attendance (qrcode.react library)

### Pain Points

1. **Inconsistent Design Language:** Mixed MUI and shadcn/ui components create visual inconsistency
2. **Performance:** MUI bundle size increases load times unnecessarily
3. **Dated Appearance:** Current UI lacks modern animations and polish
4. **Limited Interactivity:** Static components without smooth transitions or hover effects
5. **Navigation Clarity:** Missing breadcrumb navigation and clear hierarchical structure
6. **Action Feedback:** Insufficient loading states, transitions, and user feedback
7. **Theme Inconsistency:** Admin and teacher portals look disconnected

### Design Goals

1. **Visual Consistency:** Unified design language across both portals using Watermelon UI
2. **Modern Aesthetics:** Smooth animations, hover effects, and micro-interactions
3. **Performance:** Remove heavy MUI dependencies, optimize bundle size
4. **User Experience:** Clear navigation (breadcrumbs), intuitive interactions, responsive feedback
5. **Accessibility:** Maintain or improve accessibility using Radix UI primitives
6. **Maintainability:** Copy-paste component architecture for easy customization
7. **Dark Mode:** Full dark mode support with smooth theme transitions

## User Requirements

### 1. Admin Portal User Interface

**1.1 Dashboard Page**

1.1.1 WHEN an administrator views the dashboard THEN they SHALL see animated stat cards displaying college overview metrics (teachers, students, divisions, courses, timetable entries, active sessions)

1.1.2 WHEN stat cards load THEN they SHALL animate in with staggered fade-in effects using Framer Motion

1.1.3 WHEN the administrator hovers over a stat card THEN the card SHALL display a subtle lift animation and shadow transition

1.1.4 WHEN the dashboard is loading THEN it SHALL display skeleton loading states for all card components

1.1.5 WHEN data fails to load THEN an animated error alert SHALL appear with retry functionality

**1.2 Data Tables (Teachers, Students)**

1.2.1 WHEN viewing teachers or students list THEN the administrator SHALL see a modern data table with hover effects on rows

1.2.2 WHEN the administrator hovers over a table row THEN the row SHALL highlight with a smooth background color transition

1.2.3 WHEN the table contains action buttons (edit, delete) THEN they SHALL appear as a button group with icons and hover effects

1.2.4 WHEN the administrator clicks an action button THEN it SHALL provide visual feedback (scale animation, loading spinner)

1.2.5 WHEN adding or editing records THEN a modal dialog SHALL appear with smooth slide-in animation

1.2.6 WHEN the table is loading THEN it SHALL display skeleton rows maintaining layout structure

**1.3 CRUD Interfaces (Divisions, Courses)**

1.3.1 WHEN viewing divisions or courses THEN the administrator SHALL see cards or list items with action buttons

1.3.2 WHEN creating new items THEN a dialog SHALL open with form fields and validation feedback

1.3.3 WHEN submitting forms THEN buttons SHALL show loading states with spinners

1.3.4 WHEN form submission succeeds THEN a toast notification SHALL appear from the corner with success animation

1.3.5 WHEN form validation fails THEN error messages SHALL appear with shake animation below invalid fields

**1.4 Timetable/Assignments Page**

1.4.1 WHEN viewing timetable assignments THEN the administrator SHALL see a calendar component with date navigation

1.4.2 WHEN selecting dates THEN the calendar SHALL highlight selection with smooth color transitions

1.4.3 WHEN viewing assignments for a specific date THEN they SHALL be displayed in organized time slots with visual grouping

1.4.4 WHEN creating new assignments THEN a dialog SHALL provide course selection, division selection, and time pickers

1.4.5 WHEN the calendar view changes (day/week/month) THEN the transition SHALL animate smoothly

**1.5 API Keys Management**

1.5.1 WHEN viewing API keys THEN the administrator SHALL see a list of keys with creation dates and status indicators

1.5.2 WHEN creating a new API key THEN a dialog SHALL appear with key generation options

1.5.3 WHEN a key is generated THEN it SHALL be displayed once with a copy-to-clipboard button that shows feedback animation

1.5.4 WHEN revoking a key THEN a confirmation dialog SHALL appear with warning styling

1.5.5 WHEN an API key is copied THEN a tooltip or toast SHALL appear confirming the action

**1.6 Navigation and Layout**

1.6.1 WHEN navigating the admin portal THEN breadcrumb navigation SHALL display the current location hierarchy

1.6.2 WHEN clicking breadcrumb items THEN smooth navigation transitions SHALL occur

1.6.3 WHEN the sidebar is collapsed/expanded THEN it SHALL animate smoothly with content reflow

1.6.4 WHEN hovering over navigation items THEN they SHALL highlight with background color transitions

1.6.5 WHEN navigating between pages THEN page content SHALL fade in smoothly

### 2. Teacher Portal User Interface

**2.1 Teacher Dashboard**

2.1.1 WHEN a teacher logs in THEN they SHALL see a personalized welcome message with their name

2.1.2 WHEN the dashboard loads THEN quick stats cards (active sessions, today's sessions, students present) SHALL animate in with staggered timing

2.1.3 WHEN hovering over stat cards THEN they SHALL display subtle scale and shadow animations

2.1.4 WHEN today's schedule exists THEN lecture cards SHALL display with course codes, time slots, and division information

2.1.5 WHEN clicking "Start" on a scheduled lecture THEN the button SHALL show loading state and navigate to the session page

2.1.6 WHEN active sessions exist THEN they SHALL be displayed in a visually distinct section with pulsing live indicators

2.1.7 WHEN clicking on an active session card THEN smooth navigation to the session detail page SHALL occur

**2.2 Start Session Page**

2.2.1 WHEN starting a new session THEN the teacher SHALL see a clean form with course selection dropdown

2.2.2 WHEN selecting a course THEN the dropdown SHALL display animated options with search capability

2.2.3 WHEN the form is submitted THEN the submit button SHALL show loading spinner and disable interaction

2.2.4 WHEN session creation succeeds THEN navigation to the active session page SHALL occur with page transition

2.2.5 WHEN course data is loading THEN skeleton loaders SHALL indicate loading state

**2.3 Active Session Page**

2.3.1 WHEN viewing an active session THEN the teacher SHALL see session metadata (course, division, start time) in a prominent header card

2.3.2 WHEN the QR code is displayed THEN it SHALL be rendered in a centered, large, high-contrast card with proper padding

2.3.3 WHEN the QR code is displayed THEN a subtle pulse animation SHALL indicate it is active

2.3.4 WHEN attendance records update in real-time THEN new entries SHALL animate in from the top of the list

2.3.5 WHEN the attendance list loads THEN it SHALL display student names, timestamps, and verification status with icons

2.3.6 WHEN hovering over attendance records THEN rows SHALL highlight smoothly

2.3.7 WHEN ending a session THEN a confirmation dialog SHALL appear with warning styling and animation

2.3.8 WHEN a session ends successfully THEN a success toast SHALL appear and navigation back to dashboard SHALL occur

2.3.9 WHEN real-time updates fail THEN a connection status indicator SHALL appear with retry option

**2.4 Session History**

2.4.1 WHEN viewing session history THEN the teacher SHALL see a paginated list of past sessions

2.4.2 WHEN expanding a past session THEN details SHALL expand smoothly with accordion animation

2.4.3 WHEN viewing session statistics THEN charts or progress indicators SHALL animate on render

2.4.4 WHEN filtering history THEN results SHALL update with smooth transitions

### 3. Shared UI Components and Behaviors

**3.1 Animation and Motion**

3.1.1 WHEN any component loads THEN it SHALL use Framer Motion for animations with appropriate easing curves

3.1.2 WHEN page transitions occur THEN content SHALL fade in with 200-300ms duration

3.1.3 WHEN hovering over interactive elements THEN transitions SHALL be subtle and perform at 60fps

3.1.4 WHEN modals/dialogs open THEN they SHALL animate with scale and opacity (spring animation)

3.1.5 WHEN toasts appear THEN they SHALL slide in from the corner with bounce effect

**3.2 Loading States**

3.2.1 WHEN data is loading THEN skeleton components SHALL match the final content layout

3.2.2 WHEN buttons are processing actions THEN they SHALL display inline spinners and disable interaction

3.2.3 WHEN pages are loading THEN full-page or section-level skeleton grids SHALL appear

3.2.4 WHEN network requests are pending THEN appropriate loading indicators SHALL be visible within 200ms

**3.3 Feedback and Notifications**

3.3.1 WHEN actions succeed THEN toast notifications SHALL appear with success styling (green accent)

3.3.2 WHEN actions fail THEN toast notifications SHALL appear with error styling (red accent) and error messages

3.3.3 WHEN user input is invalid THEN inline error messages SHALL appear below form fields with red text

3.3.4 WHEN hover feedback is needed THEN cursor changes, color transitions, or scale animations SHALL occur

3.3.5 WHEN clipboard operations occur THEN immediate visual feedback (tooltip, toast, or button state change) SHALL confirm the action

**3.4 Responsive Design**

3.4.1 WHEN viewing on mobile devices THEN layouts SHALL adapt to single-column with touch-friendly spacing

3.4.2 WHEN viewing on tablets THEN layouts SHALL use responsive grid systems (2-column where appropriate)

3.4.3 WHEN viewing on desktop THEN full multi-column layouts SHALL be utilized with optimal spacing

3.4.4 WHEN resizing the browser THEN layout transitions SHALL be smooth without content jumping

**3.5 Dark Mode Support**

3.5.1 WHEN the system or user preference is dark mode THEN all components SHALL render with dark theme colors

3.5.2 WHEN toggling between light and dark mode THEN the transition SHALL be smooth (200ms color transition)

3.5.3 WHEN using dark mode THEN text contrast SHALL meet WCAG AA standards

3.5.4 WHEN displaying QR codes THEN they SHALL have sufficient contrast in both light and dark modes

**3.6 Accessibility**

3.6.1 WHEN using keyboard navigation THEN all interactive elements SHALL be focusable with visible focus indicators

3.6.2 WHEN using screen readers THEN all components SHALL have appropriate ARIA labels and descriptions

3.6.3 WHEN navigating with Tab key THEN focus order SHALL be logical and intuitive

3.6.4 WHEN color is used to convey information THEN additional indicators (icons, text) SHALL also be present

### 4. Component Migration Requirements

**4.1 Component Removal**

4.1.1 WHEN migrating components THEN ALL MUI imports (@mui/material, @mui/icons-material) SHALL be removed from both portals

4.1.2 WHEN removing MUI THEN @emotion/react and @emotion/styled dependencies SHALL also be removed

4.1.3 WHEN MUI components are removed THEN no MUI-specific styling or theming code SHALL remain

**4.2 Component Installation**

4.2.1 WHEN adding Watermelon UI components THEN they SHALL be installed via the shadcn CLI pointing to https://registry.watermelon.sh

4.2.2 WHEN installing components THEN they SHALL be placed in src/components/ui/ directory

4.2.3 WHEN components require dependencies THEN those SHALL be automatically added to package.json

4.2.4 WHEN installing components THEN TypeScript types SHALL be included and properly configured

**4.3 Component Usage**

4.3.1 WHEN using Watermelon UI components THEN imports SHALL use the @/components/ui path alias

4.3.2 WHEN customizing components THEN modifications SHALL be made directly in the copied component files

4.3.3 WHEN components need variants THEN class-variance-authority (CVA) SHALL be used for variant management

4.3.4 WHEN styling components THEN Tailwind utility classes SHALL be used exclusively

**4.4 Icon Migration**

4.4.1 WHEN replacing MUI icons THEN lucide-react icons SHALL be used as the replacement library

4.4.2 WHEN using icons THEN they SHALL maintain consistent sizing (h-4 w-4 for inline, h-5 w-5 for larger contexts)

4.4.3 WHEN icons need colors THEN Tailwind color classes SHALL be applied

### 5. Technical Implementation Requirements

**5.1 Dependency Management**

5.1.1 WHEN package.json is updated THEN it SHALL NOT contain any @mui/* packages

5.1.2 WHEN package.json is updated THEN it SHALL NOT contain @emotion/react or @emotion/styled

5.1.3 WHEN package.json is updated THEN it SHALL contain framer-motion for animations

5.1.4 WHEN package.json is updated THEN it SHALL contain necessary Radix UI primitives used by Watermelon components

5.1.5 WHEN package.json is updated THEN it SHALL contain lucide-react for icons

5.1.6 WHEN package.json is updated THEN it SHALL contain tailwindcss, tailwindcss-animate, and tailwind-merge

**5.2 Build Configuration**

5.2.1 WHEN building the project THEN Vite configuration SHALL support React and TypeScript

5.2.2 WHEN building THEN path aliases (@/ pointing to src/) SHALL be properly configured

5.2.3 WHEN building THEN PostCSS SHALL be configured for Tailwind CSS processing

5.2.4 WHEN building THEN bundle size SHALL be smaller than current build (due to MUI removal)

**5.3 Styling Configuration**

5.3.1 WHEN configuring Tailwind THEN tailwind.config.js SHALL include Watermelon UI color tokens

5.3.2 WHEN configuring Tailwind THEN custom animations SHALL be defined in the config

5.3.3 WHEN configuring Tailwind THEN dark mode SHALL be set to 'class' mode

5.3.4 WHEN configuring CSS variables THEN they SHALL be defined in index.css for light and dark themes

**5.4 API Integration Compatibility**

5.4.1 WHEN UI components change THEN existing API service files (adminApi.ts, portalApi.ts) SHALL remain functional

5.4.2 WHEN making API calls THEN loading states and error handling SHALL be properly implemented in the new UI

5.4.3 WHEN using real-time features (Socket.IO in teacher portal) THEN existing socket connection logic SHALL be preserved

5.4.4 WHEN displaying QR codes THEN qrcode.react library SHALL continue to be used with new styling

**5.5 State Management**

5.5.1 WHEN managing state THEN existing Zustand stores SHALL be compatible with new UI components

5.5.2 WHEN using React Query (in portal) THEN @tanstack/react-query integration SHALL be maintained

5.5.3 WHEN using auth context THEN existing AuthContext implementations SHALL work with new layouts

**5.6 Routing**

5.6.1 WHEN navigating THEN existing react-router-dom routes SHALL be preserved

5.6.2 WHEN route changes occur THEN page transition animations SHALL be added via Framer Motion

5.6.3 WHEN implementing breadcrumbs THEN they SHALL derive location from react-router-dom's useLocation hook

### 6. Quality and Performance Requirements

**6.1 Performance Metrics**

6.1.1 WHEN the application loads THEN First Contentful Paint SHALL occur within 1.5 seconds on 3G connection

6.1.2 WHEN animations run THEN they SHALL maintain 60fps on modern browsers

6.1.3 WHEN bundle size is measured THEN it SHALL be at least 30% smaller than current size (after MUI removal)

6.1.4 WHEN Lighthouse performance audit runs THEN score SHALL be 90 or above

**6.2 Browser Compatibility**

6.2.1 WHEN running in Chrome/Edge THEN all features SHALL work in versions from the last 2 years

6.2.2 WHEN running in Firefox THEN all features SHALL work in versions from the last 2 years

6.2.3 WHEN running in Safari THEN all features SHALL work in versions from the last 2 years

6.2.4 WHEN animations are not supported THEN graceful degradation SHALL occur without breaking functionality

**6.3 Accessibility Compliance**

6.3.1 WHEN audited for accessibility THEN the application SHALL meet WCAG 2.1 Level AA standards

6.3.2 WHEN using automated tools (axe, Lighthouse) THEN no critical accessibility issues SHALL be reported

6.3.3 WHEN testing with keyboard only THEN all functionality SHALL be accessible

6.3.4 WHEN testing with screen readers THEN navigation and actions SHALL be properly announced

**6.4 Visual Consistency**

6.4.1 WHEN comparing admin and teacher portals THEN they SHALL share the same visual design language

6.4.2 WHEN viewing different pages THEN spacing, typography, and color usage SHALL be consistent

6.4.3 WHEN components are reused THEN they SHALL look identical across different contexts

6.4.4 WHEN comparing to Watermelon UI examples THEN the implementation SHALL match the design quality

### 7. Testing and Validation Requirements

**7.1 Visual Testing**

7.1.1 WHEN components render THEN they SHALL visually match Watermelon UI component examples

7.1.2 WHEN testing animations THEN they SHALL run smoothly without jank or frame drops

7.1.3 WHEN testing dark mode THEN all components SHALL render correctly with proper contrast

7.1.4 WHEN testing responsive layouts THEN breakpoints SHALL work correctly across device sizes

**7.2 Functional Testing**

7.2.1 WHEN testing admin CRUD operations THEN all create, read, update, delete actions SHALL work correctly

7.2.2 WHEN testing teacher session management THEN starting, viewing, and ending sessions SHALL work correctly

7.2.3 WHEN testing real-time attendance updates THEN Socket.IO updates SHALL display correctly in the new UI

7.2.4 WHEN testing form submissions THEN validation, loading states, and success/error handling SHALL work correctly

**7.3 Integration Testing**

7.3.1 WHEN testing against the backend API THEN all endpoints (https://api.atmyhome.tech/api/v1) SHALL integrate correctly

7.3.2 WHEN testing authentication flows THEN login, logout, and token refresh SHALL work correctly

7.3.3 WHEN testing API error scenarios THEN error messages SHALL display correctly in toast notifications

7.3.4 WHEN testing network failures THEN appropriate error states and retry mechanisms SHALL function

### 8. Documentation Requirements

**8.1 Component Documentation**

8.1.1 WHEN adding custom Watermelon UI components THEN usage examples SHALL be documented in code comments

8.1.2 WHEN components have variants THEN available variants SHALL be documented

8.1.3 WHEN components have specific props THEN prop types SHALL be documented with JSDoc comments

**8.2 Migration Documentation**

8.2.1 WHEN the migration is complete THEN a migration guide SHALL document the component mappings (MUI → Watermelon UI)

8.2.2 WHEN the migration is complete THEN a changelog SHALL list all visual and functional changes

8.2.3 WHEN the migration is complete THEN updated setup instructions SHALL be provided in README files

**8.3 Developer Guidelines**

8.3.1 WHEN adding new features THEN developers SHALL use Watermelon UI components from the registry

8.3.2 WHEN styling components THEN developers SHALL use Tailwind utility classes following project conventions

8.3.3 WHEN adding animations THEN developers SHALL use Framer Motion following established patterns

## Non-Functional Requirements

### Maintainability

- Components SHALL be copy-pasted into the project (not installed as package) for full customization control
- Component structure SHALL follow shadcn/ui patterns for easy updates from Watermelon registry
- Code SHALL be well-organized with clear separation between pages, components, and services

### Scalability

- Component architecture SHALL support easy addition of new Watermelon UI components
- Design system SHALL scale to accommodate future features and pages
- Animation patterns SHALL be reusable across new components

### Security

- UI changes SHALL NOT introduce new security vulnerabilities
- Existing authentication and authorization SHALL be maintained
- API keys SHALL be properly masked in the UI with secure copy mechanisms

### Compatibility

- Existing backend API endpoints SHALL NOT require changes
- Mobile app (Flutter) SHALL continue to work with the backend API
- Docker deployments SHALL work with the new frontend builds

## Constraints and Assumptions

### Technical Constraints

- Must maintain TypeScript for type safety
- Must use React 18+ (React 19 compatible)
- Must maintain existing API integration structure
- Cannot require backend changes
- Must deploy via existing Docker containers

### Design Constraints

- Must follow Watermelon UI design patterns and component structure
- Must maintain shadcn/ui compatibility for future component additions
- Must use Tailwind CSS exclusively for styling (no CSS-in-JS)

### Operational Constraints

- Migration should minimize downtime
- Should be deployable in phases (admin first, then portal)
- Must maintain feature parity with current implementation

### Assumptions

- Backend API (https://api.atmyhome.tech/api/v1) is stable and documented via /openapi.json
- Current functionality works correctly and should be preserved
- Users can adapt to the new visual design without training
- Watermelon UI registry remains available and maintained
- Framer Motion animations are acceptable performance-wise

## Success Criteria

The UI migration will be considered successful when:

1. **Zero MUI Dependencies:** No @mui/* or @emotion/* packages remain in package.json
2. **Visual Consistency:** Admin and teacher portals use cohesive Watermelon UI design language
3. **Animation Quality:** Smooth 60fps animations on hover, click, and page transitions
4. **Feature Parity:** All existing functionality works identically to current implementation
5. **Performance Improvement:** Bundle size reduced by 30%+ and Lighthouse score 90+
6. **Accessibility:** WCAG 2.1 AA compliance maintained
7. **User Feedback:** Positive reception from administrators and teachers on visual polish
8. **Developer Experience:** Easy to add new Watermelon UI components via shadcn CLI

## Glossary

- **Watermelon UI:** Open-source component registry with 260+ React components (https://ui.watermelon.sh)
- **shadcn/ui:** Component architecture pattern where components are copied into project
- **MUI (Material-UI):** React component library being removed from the project
- **Framer Motion:** Animation library for React
- **Radix UI:** Unstyled, accessible component primitives
- **Tailwind CSS:** Utility-first CSS framework
- **Lucide React:** Icon library with 1000+ icons
- **CVA (class-variance-authority):** Utility for managing component variants
- **QR Code:** Quick Response code displayed in teacher portal for student attendance scanning
- **Socket.IO:** Real-time bidirectional communication for live attendance updates
- **Zustand:** State management library used in the project
- **React Query (@tanstack/react-query):** Server state management library used in portal

## References

- Watermelon UI Website: https://watermelon.sh/
- Watermelon UI Registry: https://ui.watermelon.sh
- Watermelon UI GitHub: https://github.com/WatermelonCorp/watermellon-registry
- Backend API: https://api.atmyhome.tech/api/v1
- API Documentation: https://api.atmyhome.tech/openapi.json
- shadcn/ui Documentation: https://ui.shadcn.com
- Framer Motion Documentation: https://www.framer.com/motion/
- Radix UI Documentation: https://www.radix-ui.com/
- Tailwind CSS Documentation: https://tailwindcss.com/
