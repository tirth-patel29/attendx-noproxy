/**
 * Manual Testing Guide for ThemeToggle Component
 * 
 * This component should be tested manually to verify:
 * 
 * 1. **Visual Verification:**
 *    - In light mode: Moon icon should be visible
 *    - In dark mode: Sun icon should be visible
 *    - Icon size should be h-5 w-5 (20px)
 * 
 * 2. **Functionality:**
 *    - Clicking the button toggles between light and dark mode
 *    - Theme preference persists after page reload (check localStorage)
 *    - Theme class is applied to document root element
 * 
 * 3. **Transition:**
 *    - Theme change should be smooth (200ms transition)
 *    - No jarring visual changes
 * 
 * 4. **Accessibility:**
 *    - Button has proper aria-label
 *    - Button has title attribute for tooltip
 *    - Screen reader text is present (sr-only class)
 *    - Button is keyboard accessible (can be focused and activated)
 * 
 * 5. **Integration:**
 *    - Component appears in Layout header (top-right)
 *    - Button uses ghost variant
 *    - Button uses icon size
 * 
 * To test:
 * 1. Run the development server: npm run dev
 * 2. Navigate to any page with the Layout component
 * 3. Click the theme toggle button in the header
 * 4. Verify the theme changes smoothly
 * 5. Reload the page and verify the theme persists
 * 6. Open browser DevTools > Application > Local Storage
 * 7. Verify "theme" key exists with value "light" or "dark"
 * 8. Inspect the <html> element and verify "light" or "dark" class is present
 * 9. Use keyboard (Tab to focus, Enter to activate) to test accessibility
 * 10. Test with screen reader to verify announcements
 */

// This is a documentation file, not actual test code
// Actual testing should be done manually in the browser
