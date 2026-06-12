// ============================================================================
// ProjectOps360° — Tests for centralized status mappings completeness
// ============================================================================
import { describe, it, expect } from 'vitest';
import {
  MILESTONE_STATUS_COLORS,
  MILESTONE_STATUS_ICON_NAMES,
  MILESTONE_STATUS_BAR_CLASSES,
  MILESTONE_HEALTH_HEX,
  MILESTONE_STATUS_CARD_CONFIG,
  TASK_STATUS_ICON_DEFS,
  TASK_STATUS_BADGE_CLASSES,
  TASK_STATUS_BAR_CLASSES,
  PRIORITY_BADGE_CLASSES,
  MILESTONE_BOARD_COLUMNS,
  MILESTONE_ICON_KEY_NAMES,
  TASK_COMPLETE_STATUSES,
  DEPENDENCY_COMPLETE_STATUSES,
} from '@/lib/roadmap/status-mappings';
import type { MilestoneStatus, MilestoneStatusDisplay, TaskStatus, TaskPriority } from '@/types/database';

// ── Completeness tests ──────────────────────────────────────────────────────────

describe('Milestone status mapping completeness', () => {
  const allMilestoneStatuses: MilestoneStatus[] = ['planned', 'in_progress', 'completed', 'blocked', 'deferred'];
  const allDisplayStatuses: MilestoneStatusDisplay[] = [...allMilestoneStatuses, 'at_risk'];

  it('MILESTONE_STATUS_COLORS covers all display statuses', () => {
    for (const status of allDisplayStatuses) {
      expect(MILESTONE_STATUS_COLORS[status], `Missing color mapping for "${status}"`).toBeDefined();
      expect(MILESTONE_STATUS_COLORS[status].ring).toBeTruthy();
      expect(MILESTONE_STATUS_COLORS[status].fill).toBeTruthy();
      expect(MILESTONE_STATUS_COLORS[status].bar).toBeTruthy();
      expect(MILESTONE_STATUS_COLORS[status].badge).toBeTruthy();
    }
  });

  it('MILESTONE_STATUS_ICON_NAMES covers all display statuses', () => {
    for (const status of allDisplayStatuses) {
      expect(MILESTONE_STATUS_ICON_NAMES[status], `Missing icon for "${status}"`).toBeTruthy();
    }
  });

  it('MILESTONE_STATUS_BAR_CLASSES covers all display statuses', () => {
    for (const status of allDisplayStatuses) {
      expect(MILESTONE_STATUS_BAR_CLASSES[status], `Missing bar class for "${status}"`).toBeDefined();
      expect(MILESTONE_STATUS_BAR_CLASSES[status].fill).toBeTruthy();
    }
  });

  it('MILESTONE_HEALTH_HEX covers all display statuses', () => {
    for (const status of allDisplayStatuses) {
      expect(MILESTONE_HEALTH_HEX[status], `Missing hex color for "${status}"`).toBeDefined();
      expect(MILESTONE_HEALTH_HEX[status].color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('MILESTONE_STATUS_CARD_CONFIG covers all display statuses', () => {
    for (const status of allDisplayStatuses) {
      expect(MILESTONE_STATUS_CARD_CONFIG[status], `Missing card config for "${status}"`).toBeDefined();
      expect(MILESTONE_STATUS_CARD_CONFIG[status].color).toBeTruthy();
    }
  });

  it('at_risk has distinct colors from planned', () => {
    expect(MILESTONE_STATUS_COLORS.at_risk.fill).not.toBe(MILESTONE_STATUS_COLORS.planned.fill);
    expect(MILESTONE_HEALTH_HEX.at_risk.color).not.toBe(MILESTONE_HEALTH_HEX.planned.color);
  });

  it('deferred has distinct colors from planned', () => {
    expect(MILESTONE_STATUS_COLORS.deferred.fill).not.toBe(MILESTONE_STATUS_COLORS.planned.fill);
    expect(MILESTONE_HEALTH_HEX.deferred.color).not.toBe(MILESTONE_HEALTH_HEX.planned.color);
  });
});

describe('Task status mapping completeness', () => {
  const allTaskStatuses: TaskStatus[] = [
    'not_started', 'prompt_ready', 'sent_to_ai', 'in_progress',
    'implemented', 'tested', 'done', 'blocked', 'deferred',
  ];

  it('TASK_STATUS_ICON_DEFS covers all task statuses', () => {
    for (const status of allTaskStatuses) {
      expect(TASK_STATUS_ICON_DEFS[status], `Missing icon def for "${status}"`).toBeDefined();
      expect(TASK_STATUS_ICON_DEFS[status].iconName).toBeTruthy();
    }
  });

  it('TASK_STATUS_BADGE_CLASSES covers all task statuses', () => {
    for (const status of allTaskStatuses) {
      expect(TASK_STATUS_BADGE_CLASSES[status], `Missing badge class for "${status}"`).toBeTruthy();
    }
  });

  it('TASK_STATUS_BAR_CLASSES covers all task statuses', () => {
    for (const status of allTaskStatuses) {
      expect(TASK_STATUS_BAR_CLASSES[status], `Missing bar class for "${status}"`).toBeDefined();
      expect(TASK_STATUS_BAR_CLASSES[status].fill).toBeTruthy();
    }
  });
});

describe('Priority mapping completeness', () => {
  it('PRIORITY_BADGE_CLASSES covers p1, p2, p3', () => {
    expect(PRIORITY_BADGE_CLASSES.p1).toBeTruthy();
    expect(PRIORITY_BADGE_CLASSES.p2).toBeTruthy();
    expect(PRIORITY_BADGE_CLASSES.p3).toBeTruthy();
  });
});

describe('Task completion status sets', () => {
  it('TASK_COMPLETE_STATUSES contains only "done"', () => {
    expect(TASK_COMPLETE_STATUSES).toEqual(['done']);
  });

  it('DEPENDENCY_COMPLETE_STATUSES contains "done" and "tested"', () => {
    expect(DEPENDENCY_COMPLETE_STATUSES).toEqual(['done', 'tested']);
  });
});

describe('Milestone board columns', () => {
  it('MILESTONE_BOARD_COLUMNS covers all 5 stored statuses', () => {
    const statuses = MILESTONE_BOARD_COLUMNS.map(c => c.status);
    expect(statuses).toContain('completed');
    expect(statuses).toContain('in_progress');
    expect(statuses).toContain('planned');
    expect(statuses).toContain('blocked');
    expect(statuses).toContain('deferred');
  });
});

describe('Milestone icon key names', () => {
  it('MILESTONE_ICON_KEY_NAMES has expected entries', () => {
    expect(MILESTONE_ICON_KEY_NAMES.setup).toBe('Settings');
    expect(MILESTONE_ICON_KEY_NAMES.sparkles).toBe('Sparkles');
    expect(MILESTONE_ICON_KEY_NAMES.rocket).toBe('Rocket');
  });
});