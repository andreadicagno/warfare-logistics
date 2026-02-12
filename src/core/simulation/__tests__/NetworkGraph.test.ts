import { describe, expect, it } from 'vitest';
import { NetworkGraph } from '../NetworkGraph';

describe('NetworkGraph', () => {
  it('finds shortest path between two directly connected nodes', () => {
    const graph = new NetworkGraph();
    graph.addEdge('A', 'B', 1);
    expect(graph.shortestPath('A', 'B')).toEqual(['A', 'B']);
  });

  it('finds shortest path through intermediate nodes', () => {
    const graph = new NetworkGraph();
    graph.addEdge('A', 'B', 1);
    graph.addEdge('B', 'C', 1);
    graph.addEdge('A', 'C', 10);
    expect(graph.shortestPath('A', 'C')).toEqual(['A', 'B', 'C']);
  });

  it('returns null for disconnected nodes', () => {
    const graph = new NetworkGraph();
    graph.addEdge('A', 'B', 1);
    expect(graph.shortestPath('A', 'C')).toBeNull();
  });

  it('returns single-element path for same source and destination', () => {
    const graph = new NetworkGraph();
    graph.addEdge('A', 'B', 1);
    expect(graph.shortestPath('A', 'A')).toEqual(['A']);
  });

  it('handles bidirectional edges', () => {
    const graph = new NetworkGraph();
    graph.addEdge('A', 'B', 2);
    graph.addEdge('B', 'A', 2);
    expect(graph.shortestPath('B', 'A')).toEqual(['B', 'A']);
  });

  it('prefers faster (lower weight) paths', () => {
    const graph = new NetworkGraph();
    // Fast path: A → D → C (weight 2)
    graph.addEdge('A', 'D', 1);
    graph.addEdge('D', 'C', 1);
    // Slow path: A → B → C (weight 20)
    graph.addEdge('A', 'B', 10);
    graph.addEdge('B', 'C', 10);
    expect(graph.shortestPath('A', 'C')).toEqual(['A', 'D', 'C']);
  });

  it('clears all edges', () => {
    const graph = new NetworkGraph();
    graph.addEdge('A', 'B', 1);
    graph.clear();
    expect(graph.shortestPath('A', 'B')).toBeNull();
  });

  it('returns all reachable facility IDs from a node', () => {
    const graph = new NetworkGraph();
    graph.addEdge('A', 'B', 1);
    graph.addEdge('B', 'C', 1);
    const reachable = graph.reachableFrom('A');
    expect(reachable).toContain('B');
    expect(reachable).toContain('C');
    expect(reachable).not.toContain('D');
  });
});
