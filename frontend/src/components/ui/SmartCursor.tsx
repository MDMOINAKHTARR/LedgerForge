import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useMotionValue, useSpring, AnimatePresence } from 'motion/react';

// ─── Label Rules ─────────────────────────────────────────────────────────────
// Priority: data-cursor-label attribute > semantic element type matching > null
//
// To assign a custom label to any element, add: data-cursor-label="Launch"
// To exclude an element from label detection: data-cursor-label=""
// ─────────────────────────────────────────────────────────────────────────────

const SELECTOR_LABELS: Array<{ selector: string; label: string }> = [
  // Specific text / role patterns (checked via closest ancestor)
  { selector: '[data-cursor-label]', label: '' }, // handled separately

  // Navigation links
  { selector: 'a[href]', label: 'Explore' },

  // Primary / CTA buttons
  { selector: 'button[type="button"], button[type="submit"]', label: 'Click' },
  { selector: 'button', label: 'Click' },

  // Inputs / text areas
  { selector: 'input, textarea, select', label: 'Type' },

  // Images
  { selector: 'img', label: 'View' },

  // Videos
  { selector: 'video, iframe', label: 'Watch' },

  // Cards / clickable divs
  { selector: '[role="button"], [tabindex]', label: 'Select' },
];

// Override labels based on keywords found in element text, class, href, or aria-label.
// SAFE to use broader patterns here because this only runs on confirmed interactive elements
// (button, a, input, role=button, etc.) — non-interactive divs/sections never reach this.
// Order matters: more specific patterns first.
const TEXT_LABEL_OVERRIDES: Array<{ match: RegExp; label: string }> = [
  // ── Navigation / page links ───────────────────────────────────────────────
  { match: /how.?it.?works/i,                        label: 'Learn'      },
  { match: /architecture/i,                          label: 'Learn'      },
  { match: /see.?how|learn.?more/i,                  label: 'Learn'      },

  // ── Specific CTAs ─────────────────────────────────────────────────────────
  { match: /reconcil/i,                              label: 'Reconcile'  },
  { match: /watch.?demo|see.?demo|play.?demo/i,      label: 'Watch'      },
  { match: /pric(e|ing)/i,                           label: 'Pricing'    },
  { match: /pilot/i,                                 label: 'Pricing'    },

  // ── Trust / security ──────────────────────────────────────────────────────
  { match: /audit/i,                                 label: 'Audit'      },
  { match: /security/i,                              label: 'Audit'      },
  { match: /trust/i,                                 label: 'Audit'      },

  // ── Download / files ──────────────────────────────────────────────────────
  { match: /download/i,                              label: 'Download'   },
  { match: /\.csv|sample.?data/i,                    label: 'Download'   },

  // ── Documentation / resources ─────────────────────────────────────────────
  { match: /resource/i,                              label: 'Read'       },
  { match: /\bdoc(s|umentation)?\b/i,               label: 'Read'       },

  // ── External platforms ────────────────────────────────────────────────────
  { match: /github/i,                               label: 'Code'       },
  { match: /twitter|x\.com/i,                       label: 'Tweet'      },
  { match: /youtube|youtu\.be/i,                    label: 'Watch'      },

  // ── Video / media ─────────────────────────────────────────────────────────
  { match: /\bvideo\b|\bwatch\b|\bplay\b|\bdemo\b/i, label: 'Watch'     },

  // ── Contact / email ───────────────────────────────────────────────────────
  { match: /contact|email|reach.?out/i,              label: 'Contact'   },

  // ── Navigation helpers ────────────────────────────────────────────────────
  { match: /\bback\b|return.?home/i,                 label: 'Home'      },
  { match: /\bhome\b/i,                              label: 'Home'      },

  // ── Auth ──────────────────────────────────────────────────────────────────
  { match: /sign.?in|log.?in/i,                     label: 'Sign In'   },

  // ── Utility ───────────────────────────────────────────────────────────────
  { match: /upload/i,                               label: 'Upload'    },
  { match: /search/i,                               label: 'Search'    },
  { match: /exception|resolve/i,                    label: 'Review'    },
];

// Interactive tags that can receive a label
const INTERACTIVE_TAGS = new Set(['button', 'a', 'input', 'textarea', 'select', 'video', 'iframe', 'img']);

function isInteractive(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (INTERACTIVE_TAGS.has(tag)) return true;
  if (el.getAttribute('role') === 'button') return true;
  const ti = el.getAttribute('tabindex');
  if (ti !== null && ti !== '-1') return true;
  return false;
}

function getLabelForElement(el: Element | null): string | null {
  if (!el) return null;

  // Walk up the DOM tree (max 6 levels)
  let current: Element | null = el;
  for (let i = 0; i < 6; i++) {
    if (!current || current === document.body) break;

    // 1. Explicit data-cursor-label attribute — highest priority, any element
    const explicit = current.getAttribute('data-cursor-label');
    if (explicit !== null) {
      return explicit === '' ? null : explicit;
    }

    const tag = current.tagName.toLowerCase();

    // 2. Only proceed with automatic detection on interactive elements
    if (isInteractive(current)) {
      // Use full textContent on the interactive element — buttons wrap text in <span> children
      // so direct text nodes are empty. textContent is safe here because we only reach
      // this branch on a confirmed interactive element, not a generic div/section.
      const fullText  = (current.textContent || '').trim().slice(0, 120);
      const classList = (typeof current.className === 'string' ? current.className : '');
      const href      = current.getAttribute('href') || '';
      const ariaLabel = current.getAttribute('aria-label') || '';
      const title     = current.getAttribute('title') || '';

      const combined = `${fullText} ${classList} ${href} ${ariaLabel} ${title}`.toLowerCase();

      // Text/class/href overrides — checked before element-type defaults
      for (const { match, label } of TEXT_LABEL_OVERRIDES) {
        if (match.test(combined)) return label;
      }

      // Element type defaults (fallback when no text override matched)
      if (tag === 'button') return 'Click';
      if (tag === 'a' && current.getAttribute('href')) return 'Explore';
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return 'Type';
      if (tag === 'img') return 'View';
      if (tag === 'video' || tag === 'iframe') return 'Watch';
      return 'Select';
    }

    current = current.parentElement;
  }

  return null;
}

// ─── Smart Cursor Component ───────────────────────────────────────────────────

export function SmartCursor() {
  const [pos, setPos] = useState({ x: -200, y: -200 });
  const [label, setLabel] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const lx = useMotionValue(-200);
  const ly = useMotionValue(-200);

  const springX = useSpring(lx, { stiffness: 520, damping: 50, bounce: 0 });
  const springY = useSpring(ly, { stiffness: 520, damping: 50, bounce: 0 });

  const rafRef = useRef<number | null>(null);
  const pendingPos = useRef({ x: -200, y: -200 });

  const update = useCallback(() => {
    x.set(pendingPos.current.x);
    y.set(pendingPos.current.y);
    lx.set(pendingPos.current.x + 14);
    ly.set(pendingPos.current.y + 14);
    rafRef.current = null;
  }, [x, y, lx, ly]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      pendingPos.current = { x: e.clientX, y: e.clientY };
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(update);
      }
      setVisible(true);

      const el = document.elementFromPoint(e.clientX, e.clientY) as Element | null;
      const newLabel = getLabelForElement(el);
      setLabel(newLabel);
    };

    const onLeave = () => {
      setVisible(false);
      setLabel(null);
    };
    const onEnter = () => setVisible(true);

    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    document.addEventListener('mouseenter', onEnter);

    return () => {
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('mouseenter', onEnter);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [update]);

  // Hide native cursor globally
  useEffect(() => {
    if (visible) {
      document.documentElement.classList.add('custom-cursor-none');
    } else {
      document.documentElement.classList.remove('custom-cursor-none');
    }
    return () => document.documentElement.classList.remove('custom-cursor-none');
  }, [visible]);

  return (
    <>
      {/* Arrow Cursor */}
      <AnimatePresence>
        {visible && (
          <motion.div
            key="cursor-arrow"
            style={{
              position: 'fixed',
              top: y,
              left: x,
              transform: 'translate(0, 0)',
              pointerEvents: 'none',
              zIndex: 99999,
            }}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            <svg
              style={{
                width: '22px',
                height: '22px',
                filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.22))',
                display: 'block',
              }}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 40 40"
            >
              <path
                fill="#3b82f6"
                d="M1.8 4.4 7 36.2c.3 1.8 2.6 2.3 3.6.8l3.9-5.7c1.7-2.5 4.5-4.1 7.5-4.3l6.9-.5c1.8-.1 2.5-2.4 1.1-3.5L5 2.5c-1.4-1.1-3.5 0-3.3 1.9Z"
              />
              <path
                fill="rgba(255,255,255,0.28)"
                d="M1.8 4.4 7 36.2c.3 1.8 2.6 2.3 3.6.8l3.9-5.7c1.7-2.5 4.5-4.1 7.5-4.3l6.9-.5c1.8-.1 2.5-2.4 1.1-3.5L5 2.5c-1.4-1.1-3.5 0-3.3 1.9Z"
              />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spring-animated label badge — only when there's a label */}
      <AnimatePresence>
        {visible && label && (
          <motion.div
            key={`label-${label}`}
            style={{
              position: 'fixed',
              top: springY,
              left: springX,
              pointerEvents: 'none',
              zIndex: 99998,
            }}
            initial={{ scale: 0.7, opacity: 0, y: 4 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.7, opacity: 0, y: 4 }}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
          >
            <div
              style={{
                background: '#3b82f6',
                color: 'white',
                padding: '2px 9px',
                borderRadius: '7px',
                fontSize: '11px',
                fontWeight: '600',
                fontFamily: 'Inter, system-ui, sans-serif',
                boxShadow: '0 2px 10px rgba(59,130,246,0.38)',
                whiteSpace: 'nowrap',
                letterSpacing: '0.01em',
                userSelect: 'none',
                lineHeight: '1.6',
              }}
            >
              {label}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default SmartCursor;
