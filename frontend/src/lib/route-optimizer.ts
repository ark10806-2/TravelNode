import { routeLegKey } from '@/lib/schedule-utils';
import type { RouteLeg, RouteMode } from '@/types/schedule';
import type { Place } from '@/types/travel';

type EdgeChoice = {
  mode: RouteMode;
  minutes: number;
};

type OptimizedRoute = {
  places: Place[];
  segments: Place[][];
  selectedModes: (RouteMode | null)[];
  selectedReturnMode: RouteMode | null;
};

type OptimizePlaceOrderOptions = {
  keyForEdge?: (from: Place, to: Place) => string;
  segments?: Place[][];
  fixedFirstSegmentIndex?: number | null;
  fixedLastSegmentIndex?: number | null;
};

type OptimizationNode = {
  places: Place[];
  head: Place;
  tail: Place;
};

const exactOptimizationLimit = 12;

export function selectBestRouteMode(leg?: RouteLeg): EdgeChoice | null {
  if (!leg) return null;

  const transitMinutes = leg.transit ? routeModeMinutes(leg.transit.durationLabel, leg.transit.status === 'loading') : null;
  const walkingMinutes = leg.walking ? routeModeMinutes(leg.walking.durationLabel, leg.walking.status === 'loading') : null;

  if (transitMinutes == null && walkingMinutes == null) return null;
  if (walkingMinutes == null) return { mode: 'transit', minutes: transitMinutes! };
  if (transitMinutes == null) return { mode: 'walking', minutes: walkingMinutes };

  if (Math.abs(walkingMinutes - transitMinutes) <= 5) return { mode: 'walking', minutes: walkingMinutes };
  return walkingMinutes < transitMinutes
    ? { mode: 'walking', minutes: walkingMinutes }
    : { mode: 'transit', minutes: transitMinutes };
}

export function optimizePlaceOrder(
  places: Place[],
  routeLegs: Record<string, RouteLeg>,
  start: Place,
  end: Place,
  options: OptimizePlaceOrderOptions = {}
): OptimizedRoute | null {
  if (places.length < 1) return null;

  const nodes = createOptimizationNodes(places, options.segments);
  if (!nodes.length) return null;

  const fixedFirstSegmentIndex = normalizeFixedSegmentIndex(options.fixedFirstSegmentIndex, nodes.length);
  const fixedLastSegmentIndex = normalizeFixedSegmentIndex(options.fixedLastSegmentIndex, nodes.length);
  if (fixedFirstSegmentIndex != null && fixedLastSegmentIndex != null && fixedFirstSegmentIndex === fixedLastSegmentIndex && nodes.length > 1) {
    return null;
  }

  const graph = createOptimizationGraph(nodes, routeLegs, start, end, options);
  if (graph.internal.some((cost) => !Number.isFinite(cost))) return null;

  const order = nodes.length <= exactOptimizationLimit
    ? exactShortestPathOrder(graph)
    : heuristicShortestPathOrder(graph);

  if (!order.length) return null;

  const orderedSegments = order.map((index) => nodes[index].places);
  const orderedPlaces = orderedSegments.flat();
  const lastPlace = orderedPlaces.at(-1);
  return {
    places: orderedPlaces,
    segments: orderedSegments,
    selectedModes: orderedPlaces.map((place, index) => {
      const from = index === 0 ? start : orderedPlaces[index - 1];
      return selectBestEdgeChoice(routeLegs, from, place, options)?.mode ?? null;
    }),
    selectedReturnMode: lastPlace ? selectBestEdgeChoice(routeLegs, lastPlace, end, options)?.mode ?? null : null
  };
}

function createOptimizationGraph(
  nodes: OptimizationNode[],
  routeLegs: Record<string, RouteLeg>,
  start: Place,
  end: Place,
  options: OptimizePlaceOrderOptions
) {
  return {
    between: nodes.map((from) =>
      nodes.map((to) => {
        if (from === to) return null;
        return selectBestEdgeChoice(routeLegs, from.tail, to.head, options);
      })
    ),
    fromStart: nodes.map((node) => selectBestEdgeChoice(routeLegs, start, node.head, options)),
    toEnd: nodes.map((node) => selectBestEdgeChoice(routeLegs, node.tail, end, options)),
    internal: nodes.map((node) => segmentInternalCost(node.places, routeLegs, options)),
    fixedFirst: normalizeFixedSegmentIndex(options.fixedFirstSegmentIndex, nodes.length),
    fixedLast: normalizeFixedSegmentIndex(options.fixedLastSegmentIndex, nodes.length)
  };
}

function createOptimizationNodes(places: Place[], segments: Place[][] | undefined): OptimizationNode[] {
  const rawSegments = segments?.length ? segments : places.map((place) => [place]);

  return rawSegments
    .filter((segment) => segment.length > 0)
    .map((segment) => ({
      places: segment,
      head: segment[0],
      tail: segment[segment.length - 1]
    }));
}

function segmentInternalCost(
  places: Place[],
  routeLegs: Record<string, RouteLeg>,
  options: OptimizePlaceOrderOptions
) {
  return places.slice(1).reduce((sum, place, index) => {
    const from = places[index];
    const edge = selectBestEdgeChoice(routeLegs, from, place, options);
    return sum + (edge?.minutes ?? Infinity);
  }, 0);
}

function normalizeFixedSegmentIndex(value: number | null | undefined, length: number) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < length ? value : null;
}

function selectBestEdgeChoice(
  routeLegs: Record<string, RouteLeg>,
  from: Place,
  to: Place,
  options: OptimizePlaceOrderOptions
): EdgeChoice | null {
  if (from.id === to.id) return { mode: 'walking', minutes: 0 };
  return selectBestRouteMode(routeLegs[edgeKey(from, to, options)]);
}

function edgeKey(from: Place, to: Place, options: OptimizePlaceOrderOptions) {
  return options.keyForEdge?.(from, to) ?? routeLegKey(from, to);
}

type OptimizationGraph = ReturnType<typeof createOptimizationGraph>;

function exactShortestPathOrder(graph: OptimizationGraph) {
  const n = graph.between.length;
  const size = 1 << n;
  const fullMask = size - 1;
  const dp = Array.from({ length: size }, () => Array<number>(n).fill(Infinity));
  const parent = Array.from({ length: size }, () => Array<number>(n).fill(-1));
  const startCandidates = graph.fixedFirst == null ? Array.from({ length: n }, (_, index) => index) : [graph.fixedFirst];

  for (const i of startCandidates) {
    dp[1 << i][i] = graph.fromStart[i]?.minutes ?? Infinity;
  }

  for (let mask = 1; mask < size; mask += 1) {
    for (let last = 0; last < n; last += 1) {
      const currentCost = dp[mask][last];
      if (!Number.isFinite(currentCost)) continue;

      for (let next = 0; next < n; next += 1) {
        if (mask & (1 << next)) continue;
        const nextMask = mask | (1 << next);
        if (graph.fixedLast != null && next === graph.fixedLast && nextMask !== fullMask) continue;

        const edge = graph.between[last][next];
        if (!edge) continue;

        const nextCost = currentCost + edge.minutes;
        if (nextCost < dp[nextMask][next]) {
          dp[nextMask][next] = nextCost;
          parent[nextMask][next] = last;
        }
      }
    }
  }

  let bestLast = -1;
  let bestCost = Infinity;
  const lastCandidates = graph.fixedLast == null ? Array.from({ length: n }, (_, index) => index) : [graph.fixedLast];
  for (const last of lastCandidates) {
    const returnCost = graph.toEnd[last]?.minutes ?? Infinity;
    const cost = dp[fullMask][last] + returnCost;
    if (cost < bestCost) {
      bestCost = cost;
      bestLast = last;
    }
  }

  if (bestLast < 0) return [];

  const order: number[] = [];
  let mask = fullMask;
  let cursor = bestLast;
  while (cursor >= 0) {
    order.push(cursor);
    const previous = parent[mask][cursor];
    mask &= ~(1 << cursor);
    cursor = previous;
  }

  return order.reverse();
}

function heuristicShortestPathOrder(graph: OptimizationGraph) {
  const n = graph.between.length;
  let bestOrder: number[] = [];
  let bestCost = Infinity;
  const startCandidates = graph.fixedFirst == null ? Array.from({ length: n }, (_, index) => index) : [graph.fixedFirst];

  for (const start of startCandidates) {
    const order = nearestNeighborOrder(graph, start);
    const improved = improveOrderWithTwoOpt(order, graph);
    const cost = pathCost(improved, graph);
    if (cost < bestCost) {
      bestOrder = improved;
      bestCost = cost;
    }
  }

  return bestOrder;
}

function nearestNeighborOrder(graph: OptimizationGraph, start: number) {
  const n = graph.between.length;
  if (!graph.fromStart[start]) return [];

  const order = [start];
  const unvisited = new Set(Array.from({ length: n }, (_, index) => index).filter((index) => index !== start));

  while (unvisited.size) {
    const last = order[order.length - 1];
    let next = -1;
    let bestCost = Infinity;
    unvisited.forEach((candidate) => {
      if (graph.fixedLast != null && candidate === graph.fixedLast && unvisited.size > 1) return;

      const cost = graph.between[last][candidate]?.minutes ?? Infinity;
      if (cost < bestCost) {
        next = candidate;
        bestCost = cost;
      }
    });
    if (next < 0) break;
    order.push(next);
    unvisited.delete(next);
  }

  return order.length === n ? order : [];
}

function improveOrderWithTwoOpt(order: number[], graph: OptimizationGraph) {
  if (order.length < 4) return order;

  let bestOrder = order;
  let bestCost = pathCost(bestOrder, graph);
  let improved = true;
  const firstMovableIndex = graph.fixedFirst == null ? 0 : 1;
  const lastMovableIndex = graph.fixedLast == null ? bestOrder.length - 1 : bestOrder.length - 2;

  while (improved) {
    improved = false;
    for (let start = firstMovableIndex; start < lastMovableIndex; start += 1) {
      for (let end = start + 1; end <= lastMovableIndex; end += 1) {
        const candidate = [
          ...bestOrder.slice(0, start),
          ...bestOrder.slice(start, end + 1).reverse(),
          ...bestOrder.slice(end + 1)
        ];
        const cost = pathCost(candidate, graph);
        if (cost < bestCost) {
          bestOrder = candidate;
          bestCost = cost;
          improved = true;
        }
      }
    }
  }

  return bestOrder;
}

function pathCost(order: number[], graph: OptimizationGraph) {
  if (!order.length) return Infinity;
  if (graph.fixedFirst != null && order[0] !== graph.fixedFirst) return Infinity;
  if (graph.fixedLast != null && order[order.length - 1] !== graph.fixedLast) return Infinity;

  const startCost = graph.fromStart[order[0]]?.minutes ?? Infinity;
  const betweenCost = order.slice(1).reduce((sum, to, index) => {
    const from = order[index];
    return sum + (graph.between[from][to]?.minutes ?? Infinity);
  }, 0);
  const internalCost = order.reduce((sum, index) => sum + graph.internal[index], 0);
  const endCost = graph.toEnd[order[order.length - 1]]?.minutes ?? Infinity;

  return startCost + betweenCost + internalCost + endCost;
}

function routeModeMinutes(label: string, isLoading: boolean) {
  if (isLoading) return null;

  const normalized = label.replace(/\s/g, '').toLowerCase();
  const hours = firstNumber(normalized.match(/(\d+(?:\.\d+)?)(?:시간|h|hr|hour)/)?.[1]);
  const minutes = firstNumber(normalized.match(/(\d+(?:\.\d+)?)(?:분|m|min|minute)/)?.[1]);

  if (hours != null || minutes != null) {
    return Math.max(1, Math.round((hours ?? 0) * 60 + (minutes ?? 0)));
  }

  return firstNumber(normalized.match(/\d+(?:\.\d+)?/)?.[0]);
}

function firstNumber(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
