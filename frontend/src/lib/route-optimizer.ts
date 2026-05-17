import { routeLegKey } from '@/lib/schedule-utils';
import type { RouteLeg, RouteMode } from '@/types/schedule';
import type { Place } from '@/types/travel';

type EdgeChoice = {
  mode: RouteMode;
  minutes: number;
};

type OptimizedRoute = {
  places: Place[];
  selectedModes: (RouteMode | null)[];
  selectedReturnMode: RouteMode | null;
};

const exactOptimizationLimit = 12;

export function selectBestRouteMode(leg?: RouteLeg): EdgeChoice | null {
  if (!leg) return null;

  const transitMinutes = routeModeMinutes(leg.transit.durationLabel, leg.transit.status === 'loading');
  const walkingMinutes = routeModeMinutes(leg.walking.durationLabel, leg.walking.status === 'loading');

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
  end: Place
): OptimizedRoute | null {
  if (places.length < 1) return null;

  const graph = createOptimizationGraph(places, routeLegs, start, end);
  const order = places.length <= exactOptimizationLimit
    ? exactShortestPathOrder(graph)
    : heuristicShortestPathOrder(graph);

  if (!order.length) return null;

  const orderedPlaces = order.map((index) => places[index]);
  const lastPlace = orderedPlaces.at(-1);
  return {
    places: orderedPlaces,
    selectedModes: orderedPlaces.map((place, index) => {
      const from = index === 0 ? start : orderedPlaces[index - 1];
      return selectBestRouteMode(routeLegs[routeLegKey(from, place)])?.mode ?? null;
    }),
    selectedReturnMode: lastPlace ? selectBestRouteMode(routeLegs[routeLegKey(lastPlace, end)])?.mode ?? null : null
  };
}

function createOptimizationGraph(places: Place[], routeLegs: Record<string, RouteLeg>, start: Place, end: Place) {
  return {
    between: places.map((from) =>
      places.map((to) => {
        if (from.id === to.id) return null;
        return selectBestRouteMode(routeLegs[routeLegKey(from, to)]);
      })
    ),
    fromStart: places.map((place) => selectBestRouteMode(routeLegs[routeLegKey(start, place)])),
    toEnd: places.map((place) => selectBestRouteMode(routeLegs[routeLegKey(place, end)]))
  };
}

type OptimizationGraph = ReturnType<typeof createOptimizationGraph>;

function exactShortestPathOrder(graph: OptimizationGraph) {
  const n = graph.between.length;
  const size = 1 << n;
  const dp = Array.from({ length: size }, () => Array<number>(n).fill(Infinity));
  const parent = Array.from({ length: size }, () => Array<number>(n).fill(-1));

  for (let i = 0; i < n; i += 1) {
    dp[1 << i][i] = graph.fromStart[i]?.minutes ?? Infinity;
  }

  for (let mask = 1; mask < size; mask += 1) {
    for (let last = 0; last < n; last += 1) {
      const currentCost = dp[mask][last];
      if (!Number.isFinite(currentCost)) continue;

      for (let next = 0; next < n; next += 1) {
        if (mask & (1 << next)) continue;
        const edge = graph.between[last][next];
        if (!edge) continue;

        const nextMask = mask | (1 << next);
        const nextCost = currentCost + edge.minutes;
        if (nextCost < dp[nextMask][next]) {
          dp[nextMask][next] = nextCost;
          parent[nextMask][next] = last;
        }
      }
    }
  }

  const fullMask = size - 1;
  let bestLast = -1;
  let bestCost = Infinity;
  for (let last = 0; last < n; last += 1) {
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

  for (let start = 0; start < n; start += 1) {
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

  while (improved) {
    improved = false;
    for (let start = 1; start < bestOrder.length - 1; start += 1) {
      for (let end = start + 1; end < bestOrder.length; end += 1) {
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

  const startCost = graph.fromStart[order[0]]?.minutes ?? Infinity;
  const betweenCost = order.slice(1).reduce((sum, to, index) => {
    const from = order[index];
    return sum + (graph.between[from][to]?.minutes ?? Infinity);
  }, 0);
  const endCost = graph.toEnd[order[order.length - 1]]?.minutes ?? Infinity;

  return startCost + betweenCost + endCost;
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
