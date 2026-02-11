/**
 * Lightweight profiler for measuring phase timings.
 * Groups related measurements under a label and logs a summary table.
 */
export class Profiler {
  private label: string;
  private entries: { name: string; ms: number }[] = [];
  private activeStart: number = 0;

  constructor(label: string) {
    this.label = label;
  }

  /** Start timing a phase. */
  start(): void {
    this.activeStart = performance.now();
  }

  /** End the current phase and record it. */
  end(name: string): void {
    const ms = performance.now() - this.activeStart;
    this.entries.push({ name, ms });
  }

  /** Measure a synchronous function and record it. */
  measure<T>(name: string, fn: () => T): T {
    this.start();
    const result = fn();
    this.end(name);
    return result;
  }

  /** Log all recorded phases as a grouped console table. */
  log(): void {
    const total = this.entries.reduce((sum, e) => sum + e.ms, 0);

    console.group(`⏱ ${this.label}  —  ${total.toFixed(1)}ms`);
    for (const entry of this.entries) {
      const pct = total > 0 ? ((entry.ms / total) * 100).toFixed(0) : '0';
      const bar = '█'.repeat(Math.round((entry.ms / total) * 20));
      console.log(
        `${entry.ms.toFixed(1).padStart(8)}ms  ${pct.padStart(3)}%  ${bar}  ${entry.name}`,
      );
    }
    console.groupEnd();
  }
}
