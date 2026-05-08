# KEPLAR Design System

## Product Context

- **What this is:** Multi-agent task collaboration platform for enterprise board presentations
- **Who it's for:** Board executives, executives (发起人), chain users (链路用户)
- **Space/industry:** Mechanical industry — railway metro project management
- **Project type:** Enterprise dashboard with goal spaces, kanban boards, AI agent status tracking
- **Memorable thing:** "透明治理" — every step is visible, traceable, and governed

---

## Aesthetic Direction

- **Direction:** Technical / Professional — dark slate backgrounds with cool blue accents
- **Decoration level:** Intentional — subtle textures, structured layouts, no decorative slop
- **Mood:** This is serious software for serious work. Every element communicates control, transparency, and AI-in-action.
- **Reference:** Enterprise dashboards for industrial software, monitoring systems, mission control aesthetics

---

## Typography

| Role | Font | Fallback | Rationale |
|------|------|----------|-----------|
| Display/Hero | Instrument Sans | system-ui, sans-serif | Clean authority without corporate coldness |
| Body | Instrument Sans | system-ui, sans-serif | Excellent readability at all sizes |
| UI/Labels | Instrument Sans | system-ui, sans-serif | Same as body for consistency |
| Data/Tables | JetBrains Mono | monospace | Tabular-nums support, technical feel matching mechanical industry |
| Code | JetBrains Mono | monospace | Standard for code display |

**Font loading:** Google Fonts CDN — `Instrument Sans` (400,500,600,700) + `JetBrains Mono` (400,500)

**Type scale:**
- Display: 48px / 700 / -0.02em tracking
- H1: 32px / 600 / -0.01em
- H2: 24px / 600
- H3: 18px / 600
- Body: 16px / 400 / 1.6 line-height
- Small: 13px / 400
- Micro: 11px / 500 / uppercase / 0.05em tracking

---

## Color

**Approach:** Restrained with meaningful accent — color is functional, not decorative

### Dark Mode (Default for Board presentations)

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-bg` | `#0B0F19` | Page background |
| `--color-surface` | `#111827` | Cards, panels |
| `--color-surface-elevated` | `#1F2937` | Hover states, nested elements |
| `--color-border` | `#374151` | Borders, dividers |
| `--color-text-primary` | `#F9FAFB` | Primary text |
| `--color-text-secondary` | `#9CA3AF` | Secondary text, labels |
| `--color-text-muted` | `#6B7280` | Muted text, timestamps |

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-primary` | `#0EA5E9` | Primary actions, AI status, links |
| `--color-primary-hover` | `#38BDF8` | Primary hover state |
| `--color-secondary` | `#64748B` | Secondary actions, muted elements |

### Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-success` | `#10B981` | Done state, successful operations |
| `--color-warning` | `#F59E0B` | Review state, caution |
| `--color-error` | `#EF4444` | Blocked state, critical issues |
| `--color-info` | `#6366F1` | AI roles, informational |

### Light Mode

Same token structure, values adjusted:
- Background: `#F9FAFB` (light gray)
- Surface: `#FFFFFF` (white)
- Text primary: `#111827` (near black)
- Border: `#E5E7EB` (light gray)

---

## Spacing

**Base unit:** 4px

**Density:** Comfortable — clear hierarchy, not cramped

| Token | Value | Usage |
|-------|-------|-------|
| `--space-2xs` | 4px | Micro gaps |
| `--space-xs` | 8px | Tight spacing |
| `--space-sm` | 12px | Component internal |
| `--space-md` | 16px | Standard gap |
| `--space-lg` | 24px | Section spacing |
| `--space-xl` | 32px | Large gaps |
| `--space-2xl` | 48px | Section separation |
| `--space-3xl` | 64px | Page sections |

---

## Layout

**Approach:** Grid-disciplined — clean columns, predictable alignment, no visual chaos

| Property | Value |
|----------|-------|
| Grid | 12-column, 24px gutter |
| Max content width | 1280px |
| Border radius (sm) | 4px |
| Border radius (md) | 8px |
| Border radius (lg) | 12px |
| Border radius (full) | 9999px |

**Structure:**
- Header: Logo + navigation + user actions
- Main: Goal space / Dashboard area
- Sidebar: Audit trail (as first-class UI, not buried)
- Footer: Minimal, version info only

---

## Motion

**Approach:** Minimal-functional — transitions serve comprehension, not decoration

| Type | Easing | Duration |
|------|--------|----------|
| Enter | ease-out | 200ms |
| Exit | ease-in | 150ms |
| Move | ease-in-out | 250ms |
| Hover | ease-out | 100ms |

**What's animated:**
- Card state changes (background color flash)
- Modal/drawer enter/exit
- Button press feedback
- SSE status indicator pulse (subtle)

**What's NOT animated:**
- No scroll animations
- No entrance choreography
- No decorative motion
- No loading spinners (use skeleton states instead)

---

## Component Tokens

### Card States

| State | Background | Text | Border |
|-------|-----------|------|--------|
| Active | `rgba(14,165,233,0.15)` | Primary blue | none |
| Waiting | `rgba(100,116,139,0.15)` | Secondary gray | none |
| Blocked | `rgba(239,68,68,0.15)` | Error red | none |
| Review | `rgba(245,158,11,0.15)` | Warning amber | none |
| Done | `rgba(16,185,129,0.15)` | Success green | none |

### Risk Badges

| Risk | Background | Text |
|------|-----------|------|
| High | `rgba(239,68,68,0.15)` | Error red |
| Medium | `rgba(245,158,11,0.15)` | Warning amber |
| Low | `rgba(16,185,129,0.15)` | Success green |

### Buttons

| Type | Background | Text | Border |
|------|-----------|------|--------|
| Primary | Primary blue | White | none |
| Secondary | Surface elevated | Text primary | Border color |
| Ghost | Transparent | Text secondary | none |

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-10 | Initial design system created | Based on board demo requirements: "透明治理" memorable thing, technical/modern aesthetic |
| 2026-05-10 | Dark mode as default | Board room projection clarity, focus on content |
| 2026-05-10 | JetBrains Mono for data | Matches mechanical industry technical feel |
| 2026-05-10 | Audit trail as primary UI | Supports "透明治理" — trace is visible, not buried |

---

## Implementation Notes

When building UI:
1. Use CSS custom properties for all tokens
2. Never hardcode hex values — always reference tokens
3. Card state colors use opacity backgrounds, not borders
4. Audit trail renders inline with kanban, not in a drawer/modal
5. Dark mode by default, light mode toggle available
6. Skeleton loading states preferred over spinners