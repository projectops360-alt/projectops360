// Shared view-model types for the Rhythm Center UI (client-safe).

import type {
  EventType, EventStatus, EventPriority, RhythmMeetingType,
  AgendaSection, AttendeeRole, AttendanceStatus,
} from "@/types/database";

export interface AttendeeView {
  id: string;
  name: string | null;
  stakeholderId: string | null;
  role: AttendeeRole;
  attendanceStatus: AttendanceStatus;
}

export interface DecisionView {
  id: string;
  title: string;
  impactArea: string | null;
}

export interface ActionItemView {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: string;
  status: string;
}

export interface MeetingView {
  id: string;
  meetingType: RhythmMeetingType | null;
  objective: string | null;
  expectedOutcome: string | null;
  agenda: AgendaSection[];
  notes: string;
  summary: string;
  meetingStatus: EventStatus;
  meetingLink: string | null;
  attendees: AttendeeView[];
  decisions: DecisionView[];
  actionItems: ActionItemView[];
  memorySynced: boolean;
}

export interface EventView {
  id: string;
  title: string;
  description: string | null;
  eventType: EventType;
  startDatetime: string;
  endDatetime: string | null;
  status: EventStatus;
  priority: EventPriority;
  /** Present when this event is a meeting. */
  meeting: MeetingView | null;
}

export interface StakeholderOption {
  id: string;
  name: string;
}
