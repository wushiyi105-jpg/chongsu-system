import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  select,
  zoom,
  zoomIdentity,
  drag,
} from 'd3';
import { graphApi } from '@client/src/api';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@client/src/components/ui/sheet';
import { Button } from '@client/src/components/ui/button';
import { Network, X, Clock, Link } from 'lucide-react';
import type { GraphData, GraphNode, GraphEdge, PillarKey, GraphNodeFragment } from '@shared/api.interface';

const PILLARS: Array<{ key: PillarKey; name: string; color: string }> = [
  { key: 'cognition', name: '认知', color: '#6d4aff' },
  { key: 'meaning', name: '意义', color: '#e8a23a' },
  { key: 'energy', name: '能量', color: '#34a853' },
  { key: 'relation', name: '关系', color: '#d94a3d' },
  { key: 'value', name: '价值', color: '#1f3a8a' },
];

const PILLAR_COLOR_MAP: Record<PillarKey, string> = {
  cognition: '#6d4aff',
  meaning: '#e8a23a',
  energy: '#34a853',
  relation: '#d94a3d',
  value: '#1f3a8a',
};

interface SimNode extends GraphNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface SimEdge {
  source: string | SimNode;
  target: string | SimNode;
  fragmentId: string;
  weight: number;
}

function makeXForce(targets: Record<string, number>, strength: number) {
  let nodes: SimNode[];
  function force(alpha: number) {
    for (const n of nodes) {
      const t = n.pillar ? targets[n.pillar] ?? 0 : 0;
      n.vx = (n.vx ?? 0) + (t - (n.x ?? 0)) * strength * alpha;
    }
  }
  force.initialize = function (_nodes: SimNode[]) {
    nodes = _nodes;
  };
  return force;
}

function makeYForce(targets: Record<string, number>, strength: number) {
  let nodes: SimNode[];
  function force(alpha: number) {
    for (const n of nodes) {
      const t = n.pillar ? targets[n.pillar] ?? 0 : 0;
      n.vy = (n.vy ?? 0) + (t - (n.y ?? 0)) * strength * alpha;
    }
  }
  force.initialize = function (_nodes: SimNode[]) {
    nodes = _nodes;
  };
  return force;
}

function getFragmentDisplay(frag: GraphNodeFragment): string {
  if (frag.title && frag.title.trim()) return frag.title.trim();
  const content = (frag.content || '').trim();
  if (!content) return '无标题';
  return content.length > 28 ? content.slice(0, 28) + '…' : content;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${m}-${day} ${hh}:${mm}`;
  } catch {
    return '';
  }
}

const GraphPage = () => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePillars, setActivePillars] = useState<Set<PillarKey>>(
    new Set(['cognition', 'meaning', 'energy', 'relation', 'value']),
  );
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const filteredData = useMemo(() => {
    if (!graphData) return { nodes: [], edges: [] };
    const visibleNodes = graphData.nodes.filter(
      (n) => n.pillar && activePillars.has(n.pillar),
    );
    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    const visibleEdges = graphData.edges.filter(
      (e) => visibleIds.has(e.source) && visibleIds.has(e.target),
    );
    return { nodes: visibleNodes, edges: visibleEdges };
  }, [graphData, activePillars]);

  const relatedFragments = useMemo<GraphNodeFragment[]>(() => {
    if (!selectedNode) return [];
    return selectedNode.fragments ?? [];
  }, [selectedNode]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await graphApi.getGraph();
        if (!cancelled) setGraphData(data);
      } catch (err) {
        logger.error('加载图谱失败', err);
        if (!cancelled) setError('加载失败，请稍后重试');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const togglePillar = useCallback((key: PillarKey) => {
    setActivePillars((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    if (filteredData.nodes.length === 0) return;

    const svg = select(svgRef.current);
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    svg.selectAll('*').remove();

    const nodes: SimNode[] = filteredData.nodes.map((n) => ({ ...n }));
    const edges: SimEdge[] = filteredData.edges.map((e) => ({ ...e }));

    const activePillarKeys = [...activePillars];
    const pillarCount = activePillarKeys.length;
    const clusterRadius = Math.min(width, height) * 0.3;

    const pillarCentersX: Record<string, number> = {};
    const pillarCentersY: Record<string, number> = {};
    activePillarKeys.forEach((key, i) => {
      if (pillarCount <= 1) {
        pillarCentersX[key] = width / 2;
        pillarCentersY[key] = height / 2;
      } else {
        const angle = (i / pillarCount) * Math.PI * 2 - Math.PI / 2;
        pillarCentersX[key] = width / 2 + Math.cos(angle) * clusterRadius;
        pillarCentersY[key] = height / 2 + Math.sin(angle) * clusterRadius;
      }
    });

    svg
      .append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', '#f2f2f0');

    const g = svg.append('g').attr('class', 'zoom-layer');

    const maxWeight = edges.length > 0 ? Math.max(...edges.map((e) => e.weight)) : 1;
    const maxFragmentCount = nodes.length > 0
      ? Math.max(...nodes.map((n) => n.fragmentCount))
      : 1;

    const link = g
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke', '#c9c7c2')
      .attr('stroke-opacity', (d: SimEdge) => 0.2 + 0.35 * (d.weight / Math.max(1, maxWeight)))
      .attr('stroke-width', (d: SimEdge) => 0.6 + 0.7 * (d.weight / Math.max(1, maxWeight)));

    const node = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'grab')
      .style('opacity', 0);

    node
      .append('circle')
      .attr('class', 'core')
      .attr('r', (d: SimNode) => Math.max(4, Math.sqrt(d.size) * 1.3))
      .attr('fill', (d: SimNode) => d.color)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5);

    node
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', (d: SimNode) => -Math.max(4, Math.sqrt(d.size) * 1.3) - 5)
      .attr('font-size', (d: SimNode) => (d.fragmentCount >= 5 ? '11px' : '10px'))
      .attr('font-weight', (d: SimNode) => (d.fragmentCount >= 5 ? 600 : 500))
      .attr('fill', '#0a0a0a')
      .attr('pointer-events', 'none')
      .text((d: SimNode) => d.name);

    node
      .transition()
      .duration(600)
      .delay((_d: SimNode, i: number) => i * 15)
      .ease((t: number) => 1 - Math.pow(1 - t, 3))
      .style('opacity', 1);

    const simulation = forceSimulation(nodes)
      .force(
        'link',
        forceLink(edges)
          .id((d: SimNode) => d.id)
          .distance((d: SimEdge) => {
            const w = d.weight || 1;
            return 80 - Math.min(40, w * 6);
          })
          .strength((d: SimEdge) => {
            const w = d.weight || 1;
            return 0.15 + Math.min(0.4, w * 0.06);
          }),
      )
      .force('charge', forceManyBody().strength((d: SimNode) => -120 - d.size * 1.5))
      .force('center', forceCenter(width / 2, height / 2).strength(0.03))
      .force(
        'collision',
        forceCollide().radius(
          (d: SimNode) => Math.max(10, Math.sqrt(d.size) * 1.5 + 4),
        ),
      )
      .force('pillarX', makeXForce(pillarCentersX, 0.25) as any)
      .force('pillarY', makeYForce(pillarCentersY, 0.25) as any)
      .on('tick', () => {
    link
      .attr('x1', (d: { source: SimNode; target: SimNode }) => d.source.x ?? 0)
      .attr('y1', (d: { source: SimNode; target: SimNode }) => d.source.y ?? 0)
      .attr('x2', (d: { source: SimNode; target: SimNode }) => d.target.x ?? 0)
      .attr('y2', (d: { source: SimNode; target: SimNode }) => d.target.y ?? 0);

    node.attr('transform', (d: SimNode) => `translate(${d.x ?? 0},${d.y ?? 0})`);
      });

    const dragBehavior = drag()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    node.call(dragBehavior);

    node.on('click', (_event, d) => {
      setSelectedNode(d as GraphNode);
      setSheetOpen(true);
    });

    const zoomBehavior = zoom()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });

    svg.call(zoomBehavior);

    const initialTransform = zoomIdentity.translate(0, 0).scale(1);
    svg.call(zoomBehavior.transform, initialTransform);

    return () => {
      simulation.stop();
    };
  }, [filteredData, activePillars]);

  return (
    <div className="flex flex-col h-[calc(100vh-60px)] bg-canvas">
      <div className="px-4 pt-3 pb-3 bg-canvas/90 backdrop-blur-sm border-b border-border">
        <h1 className="text-[15px] font-semibold text-text-primary tracking-tight mb-2">
          知识图谱
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          {PILLARS.map((pillar) => {
            const active = activePillars.has(pillar.key);
            return (
              <button
                key={pillar.key}
                onClick={() => togglePillar(pillar.key)}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-colors"
                style={{
                  backgroundColor: active
                    ? `${pillar.color}1a`
                    : 'var(--surface-muted)',
                  color: active ? pillar.color : 'var(--text-tertiary)',
                  border: `1px solid ${active ? `${pillar.color}33` : 'var(--border)'}`,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: pillar.color }}
                />
                <span>{pillar.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-xs text-text-tertiary">加载中...</div>
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 z-10 text-center">
            <Network className="size-6 text-text-tertiary mb-2" />
            <div className="text-sm font-medium text-text-primary">加载失败</div>
            <div className="text-xs text-text-tertiary mt-1">{error}</div>
          </div>
        )}

        {!loading && !error && filteredData.nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 z-10 text-center">
            <Network className="size-6 text-text-tertiary mb-2" />
            <div className="text-sm font-medium text-text-primary">还没有数据</div>
            <div className="text-xs text-text-tertiary mt-1">先去记录一些碎片吧</div>
          </div>
        )}

        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ display: loading || error ? 'none' : 'block' }}
        />
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl h-[70vh] p-0">
          {selectedNode && (
            <div className="flex flex-col h-full">
              <SheetHeader className="px-4 pt-4 pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: selectedNode.color }}
                  />
                  <SheetTitle className="text-base font-semibold text-text-primary">
                    {selectedNode.name}
                  </SheetTitle>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-text-tertiary">
                  <span>
                    {selectedNode.pillar
                      ? PILLARS.find((p) => p.key === selectedNode.pillar)?.name
                      : '未分类'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Link size={10} />
                    <span className="num-tnum">{selectedNode.fragmentCount} 条关联</span>
                  </span>
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-4 py-3">
                <h3 className="text-xs font-medium text-text-secondary mb-2">
                  关联碎片 (<span className="num-tnum">{relatedFragments.length}</span>)
                </h3>
                {relatedFragments.length === 0 ? (
                  <p className="text-xs text-text-tertiary">暂无关联碎片</p>
                ) : (
                  <div className="space-y-2">
                    {relatedFragments.map((frag) => (
                      <div
                        key={frag.id}
                        className="p-3 rounded-xl bg-surface border border-border"
                      >
                        <p className="text-[13px] text-text-primary leading-snug line-clamp-2">
                          {getFragmentDisplay(frag)}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-text-tertiary">
                          <Clock size={10} />
                          <span>{formatDate(frag.createdAt)}</span>
                          <span className="uppercase px-1.5 py-0.5 bg-surface-muted rounded text-[10px] tracking-wide">
                            {frag.type}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-border">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setSheetOpen(false)}
                >
                  <X className="size-3.5 mr-1.5" />
                  关闭
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default GraphPage;
