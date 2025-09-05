export interface DomainEvent<T = unknown> {
  eventId: string;
  type: string;
  version: number;
  occurredAt: string;
  source: string;
  correlationId?: string;
  causationId?: string;
  payload: T;
}

export interface XpAdjustedPayload {
  userId: string;
  delta: number;
  newTotalXp: number;
  level: number;
  sourceEventId: string;
}
