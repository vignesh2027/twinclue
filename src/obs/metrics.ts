// A tiny Prometheus text-format registry. No dependency, no global state: the server owns one instance.
type Labels = Record<string, string>;

function labelKey(labels: Labels): string {
  return Object.keys(labels).sort().map(key => `${key}="${escapeLabel(labels[key]!)}"`).join(',');
}
function escapeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

export class Counter {
  private readonly values = new Map<string, number>();
  constructor(readonly name: string, readonly help: string, readonly type: 'counter' | 'gauge' = 'counter') {}
  inc(labels: Labels = {}, by = 1): void {
    const key = labelKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + by);
  }
  set(labels: Labels, value: number): void { this.values.set(labelKey(labels), value); }
  get(labels: Labels = {}): number { return this.values.get(labelKey(labels)) ?? 0; }
  total(): number { let sum = 0; for (const value of this.values.values()) sum += value; return sum; }
  render(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} ${this.type}`];
    if (!this.values.size && this.type === 'counter') lines.push(`${this.name} 0`);
    for (const [key, value] of this.values) lines.push(`${this.name}${key ? `{${key}}` : ''} ${value}`);
    return lines.join('\n');
  }
}

export class Histogram {
  private readonly counts: number[];
  private sum = 0;
  private count = 0;
  constructor(readonly name: string, readonly help: string, readonly buckets: number[]) {
    this.counts = buckets.map(() => 0);
  }
  /** The largest value observed, exact rather than bucketed. */
  max = 0;
  observe(value: number): void {
    this.sum += value;
    this.count++;
    if (value > this.max) this.max = value;
    for (let i = 0; i < this.buckets.length; i++) if (value <= this.buckets[i]!) { this.counts[i]!++; break; }
  }
  get observations(): number { return this.count; }
  /** Benchmarks reset between phases; the server never does. */
  reset(): void { this.counts.fill(0); this.sum = 0; this.count = 0; this.max = 0; }
  /** Bucket-resolution quantile estimate: the upper bound of the bucket holding the q-th observation. */
  quantile(q: number): number {
    if (!this.count) return 0;
    const target = Math.ceil(q * this.count);
    let seen = 0;
    for (let i = 0; i < this.buckets.length; i++) { seen += this.counts[i]!; if (seen >= target) return this.buckets[i]!; }
    return Infinity;
  }
  render(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];
    let cumulative = 0;
    for (let i = 0; i < this.buckets.length; i++) {
      cumulative += this.counts[i]!;
      lines.push(`${this.name}_bucket{le="${this.buckets[i]}"} ${cumulative}`);
    }
    lines.push(`${this.name}_bucket{le="+Inf"} ${this.count}`, `${this.name}_sum ${this.sum}`, `${this.name}_count ${this.count}`);
    return lines.join('\n');
  }
}

export class Metrics {
  readonly messagesIn = new Counter('twinclue_chat_messages_in_total', 'Chat notifications accepted from EventSub, by community side.');
  readonly votes = new Counter('twinclue_votes_total', 'Vote commands by outcome (voted, unchanged, rate_limited, blocked, inactive).');
  readonly duplicates = new Counter('twinclue_duplicates_dropped_total', 'EventSub notifications dropped as duplicates, by reason.');
  readonly shed = new Counter('twinclue_shed_total', 'Display work skipped under load, by kind (ticker, frame). Votes and round transitions are never shed.');
  readonly reconnects = new Counter('twinclue_eventsub_reconnects_total', 'EventSub reconnects by reason.');
  readonly hints = new Counter('twinclue_hint_requests_total', 'Viewer !hint requests by outcome (asked, unlocked, repeat, wrong_side, unavailable, inactive).');
  readonly chatSends = new Counter('twinclue_chat_sends_total', 'Bot chat sends by result (sent, dropped, failed, rate_limited).');
  readonly overlayClients = new Counter('twinclue_overlay_clients', 'Connected overlay and panel sockets, by view.', 'gauge');
  readonly eventsubConnected = new Counter('twinclue_eventsub_connected', 'Whether the EventSub socket has a live session (1) or not (0).', 'gauge');
  readonly snapshots = new Counter('twinclue_snapshots_total', 'Session snapshots written, by result.');
  readonly framesSent = new Counter('twinclue_overlay_frames_total', 'Overlay and panel frames sent, by view.');
  readonly snapshotSeconds = new Histogram('twinclue_snapshot_seconds', 'Time to serialise and write one session snapshot, including file I/O.', [0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1]);
  readonly snapshotBlockingSeconds = new Histogram('twinclue_snapshot_blocking_seconds', 'Event loop time one snapshot blocks while serialising the vote map.', [0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1]);
  readonly latency = new Histogram('twinclue_vote_to_frame_seconds', 'Time from a chat notification being received to the overlay frame that reflects it being sent.',
    [0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.125, 0.15, 0.2, 0.25, 0.5, 1, 2.5, 5]);

  render(): string {
    return [this.messagesIn, this.votes, this.hints, this.duplicates, this.shed, this.reconnects, this.chatSends, this.overlayClients,
      this.eventsubConnected, this.snapshots, this.framesSent, this.snapshotSeconds, this.snapshotBlockingSeconds, this.latency].map(metric => metric.render()).join('\n') + '\n';
  }
}
