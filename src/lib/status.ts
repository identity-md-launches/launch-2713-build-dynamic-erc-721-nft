export type Mood = 'resting' | 'active' | 'energetic' | 'unknown';
export type HamsterStatus = {
  rpmMilli: number;
  spinning: boolean;
  observedAt: number;
  receivedAt: number;
  staleAfterSeconds: number;
  fresh: boolean;
  provenance: string;
  blockHeight: bigint | null;
  blockProgress: bigint | null;
  revision: string;
};

const decimal = (value: unknown): bigint | null =>
  typeof value === 'string' && /^\d+$/.test(value) ? BigInt(value) : null;

export function parseStatus(raw: unknown, now = Date.now()): HamsterStatus {
  if (!raw || typeof raw !== 'object') throw new Error('The hamster feed returned an invalid response.');
  const data = raw as Record<string, any>;
  if (data.schemaVersion !== 1 || typeof data.revision !== 'string' || !data.measurement) {
    throw new Error('The hamster feed is unavailable or its format has changed.');
  }
  const m = data.measurement;
  if (!Number.isInteger(m.rpmMilli) || m.rpmMilli < 0 || m.rpmMilli > 4_294_967_295
      || !['IDLE', 'ACTIVE', 'COUNTER_FAULT'].includes(m.coreStatus)
      || !['online', 'stale'].includes(m.freshness)
      || !Number.isFinite(Date.parse(m.observedAt)) || !Number.isFinite(Date.parse(m.receivedAt))
      || !Number.isFinite(m.staleAfterSeconds) || m.staleAfterSeconds <= 0
      || !['hardware', 'simulated', 'replay', 'derived'].includes(m.provenance)) {
    throw new Error('The wheel measurement is incomplete. Try refreshing the feed.');
  }
  const observedAt = Date.parse(m.observedAt);
  const receivedAt = Date.parse(m.receivedAt);
  const anchor = data.builder?.status === 'available' ? data.builder.anchor : undefined;
  const blockHeight = decimal(anchor?.blockHeight);
  const progress = decimal(anchor?.blockProgress);
  const fresh = m.freshness === 'online' && m.coreStatus !== 'COUNTER_FAULT'
    && observedAt <= now + 15_000 && receivedAt <= now + 15_000
    && now - receivedAt <= Math.min(m.staleAfterSeconds, 120) * 1000
    && now - observedAt <= Math.min(m.staleAfterSeconds, 120) * 1000;
  return {
    rpmMilli: m.rpmMilli, spinning: m.coreStatus === 'ACTIVE', observedAt, receivedAt,
    staleAfterSeconds: Math.min(m.staleAfterSeconds, 120), fresh, provenance: m.provenance,
    blockHeight, blockProgress: progress !== null && progress < 1_000_000_000n ? progress : null,
    revision: data.revision,
  };
}

export function moodFor(status: Pick<HamsterStatus, 'fresh' | 'spinning' | 'rpmMilli'> | null): Mood {
  if (!status?.fresh) return 'unknown';
  if (!status.spinning) return 'resting';
  return status.rpmMilli >= 60_000 ? 'energetic' : 'active';
}

export const MOODS: Record<Mood, { label: string; detail: string; wheel: string }> = {
  resting: { label: 'Resting', detail: 'Little paws. Well-earned pause.', wheel: 'Idle' },
  active: { label: 'Active', detail: 'A little spin in its step.', wheel: 'Spinning' },
  energetic: { label: 'Energetic', detail: 'Big wheel. Bigger energy.', wheel: 'Spinning fast' },
  unknown: { label: 'Awaiting signal', detail: 'A little patience for the next reading.', wheel: 'Unknown' },
};

export const rpmText = (rpmMilli: number) => (rpmMilli / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 });
export const progressText = (progress: bigint) => `${(Number(progress) / 10_000_000).toFixed(1)}%`;
