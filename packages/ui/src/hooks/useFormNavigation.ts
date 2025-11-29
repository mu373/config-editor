import { useCallback } from 'react';
import { useTreeStore } from '../store/treeStore';

/**
 * Hook for navigating to form fields by path.
 *
 * This is used by:
 * - Tree sidebar click navigation
 * - Editor alt-click navigation
 */
export function useFormNavigation() {
  const { expandFormAncestors } = useTreeStore();

  const navigateToPath = useCallback(
    (path: string) => {
      if (!path) return;

      // Expand all ancestors in the form
      expandFormAncestors(path);

      // Scroll to element after DOM update
      requestAnimationFrame(() => {
        const element = globalThis.document.querySelector(
          `[data-field-path="${path}"]`
        );
        if (element) {
          // Custom fast scroll with ease-out curve
          const scrollContainer = element.closest(
            '.overflow-auto, .overflow-y-auto'
          );
          if (scrollContainer) {
            const elementRect = element.getBoundingClientRect();
            const containerRect = scrollContainer.getBoundingClientRect();
            const targetScrollTop =
              scrollContainer.scrollTop +
              elementRect.top -
              containerRect.top -
              16; // 16px offset from top

            const startScrollTop = scrollContainer.scrollTop;
            const distance = targetScrollTop - startScrollTop;
            const duration = 200; // ms - fast scroll
            const startTime = performance.now();

            const easeOut = (t: number) => 1 - Math.pow(1 - t, 3); // cubic ease-out

            const animateScroll = (currentTime: number) => {
              const elapsed = currentTime - startTime;
              const progress = Math.min(elapsed / duration, 1);
              scrollContainer.scrollTop =
                startScrollTop + distance * easeOut(progress);

              if (progress < 1) {
                requestAnimationFrame(animateScroll);
              }
            };

            requestAnimationFrame(animateScroll);
          } else {
            // Fallback if no scroll container found
            element.scrollIntoView({ behavior: 'auto', block: 'start' });
          }

          // Add temporary highlight
          element.classList.add('tree-nav-highlight');
          setTimeout(
            () => element.classList.remove('tree-nav-highlight'),
            1500
          );
        }
      });
    },
    [expandFormAncestors]
  );

  return { navigateToPath };
}
