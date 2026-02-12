/**
 * Weighted directed graph with Dijkstra shortest-path.
 * Nodes are string IDs (facility IDs or hex keys).
 * Edge weight = 1/speed (lower = faster path).
 */
export class NetworkGraph {
  private adjacency = new Map<string, Map<string, number>>();

  addEdge(from: string, to: string, weight: number): void {
    if (!this.adjacency.has(from)) this.adjacency.set(from, new Map());
    if (!this.adjacency.has(to)) this.adjacency.set(to, new Map());
    const existing = this.adjacency.get(from)!.get(to);
    if (existing === undefined || weight < existing) {
      this.adjacency.get(from)!.set(to, weight);
    }
  }

  clear(): void {
    this.adjacency.clear();
  }

  shortestPath(from: string, to: string): string[] | null {
    if (from === to) return [from];
    if (!this.adjacency.has(from) || !this.adjacency.has(to)) return null;

    const dist = new Map<string, number>();
    const prev = new Map<string, string>();
    const visited = new Set<string>();

    // Simple priority queue via sorted array (adequate for small graphs)
    const queue: Array<{ node: string; cost: number }> = [];

    dist.set(from, 0);
    queue.push({ node: from, cost: 0 });

    while (queue.length > 0) {
      queue.sort((a, b) => a.cost - b.cost);
      const { node, cost } = queue.shift()!;

      if (visited.has(node)) continue;
      visited.add(node);

      if (node === to) {
        // Reconstruct path
        const path: string[] = [];
        let current: string | undefined = to;
        while (current !== undefined) {
          path.unshift(current);
          current = prev.get(current);
        }
        return path;
      }

      const neighbors = this.adjacency.get(node);
      if (!neighbors) continue;

      for (const [neighbor, weight] of neighbors) {
        if (visited.has(neighbor)) continue;
        const newCost = cost + weight;
        const oldCost = dist.get(neighbor);
        if (oldCost === undefined || newCost < oldCost) {
          dist.set(neighbor, newCost);
          prev.set(neighbor, node);
          queue.push({ node: neighbor, cost: newCost });
        }
      }
    }

    return null;
  }

  reachableFrom(start: string): string[] {
    const visited = new Set<string>();
    const stack = [start];

    while (stack.length > 0) {
      const node = stack.pop()!;
      if (visited.has(node)) continue;
      visited.add(node);
      const neighbors = this.adjacency.get(node);
      if (neighbors) {
        for (const neighbor of neighbors.keys()) {
          if (!visited.has(neighbor)) stack.push(neighbor);
        }
      }
    }

    visited.delete(start);
    return [...visited];
  }
}
