"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  BackgroundVariant,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { StepNode, type StepNodeData } from "./StepNode";
import type { RoadmapNode } from "@/types";

const NODE_WIDTH = 224;
const NODE_HEIGHT = 90;

function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction = "LR"
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    ranksep: 80,
    nodesep: 40,
    marginx: 40,
    marginy: 40,
  });

  nodes.forEach((node) => g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach((edge) => g.setEdge(edge.source, edge.target));

  dagre.layout(g);

  return {
    nodes: nodes.map((node) => {
      const { x, y } = g.node(node.id);
      return {
        ...node,
        position: { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 },
      };
    }),
    edges,
  };
}

function buildEdges(dbNodes: RoadmapNode[]): Edge[] {
  const edges: Edge[] = [];
  for (const node of dbNodes) {
    if (node.parentId) {
      edges.push({
        id: `e-${node.parentId}-${node.id}`,
        source: node.parentId,
        target: node.id,
        type: "smoothstep",
        animated: node.status === "in_progress",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#475569" },
        style: {
          stroke:
            node.status === "completed"
              ? "#22c55e"
              : node.status === "blocked"
              ? "#ef4444"
              : node.status === "in_progress"
              ? "#3b82f6"
              : "#475569",
          strokeWidth: 2,
        },
      });
    }
  }
  return edges;
}

function buildLinearEdges(dbNodes: RoadmapNode[]): Edge[] {
  const roots = dbNodes.filter((n) => !n.parentId);
  const edges: Edge[] = [];

  if (roots.length === 0) return edges;

  const sorted = [...dbNodes].sort((a, b) => a.order - b.order);
  for (let i = 0; i < sorted.length - 1; i++) {
    const src = sorted[i];
    const tgt = sorted[i + 1];
    edges.push({
      id: `e-${src.id}-${tgt.id}`,
      source: src.id,
      target: tgt.id,
      type: "smoothstep",
      animated: tgt.status === "in_progress",
      markerEnd: { type: MarkerType.ArrowClosed, color: "#475569" },
      style: {
        stroke:
          tgt.status === "completed"
            ? "#22c55e"
            : tgt.status === "blocked"
            ? "#ef4444"
            : tgt.status === "in_progress"
            ? "#3b82f6"
            : "#475569",
        strokeWidth: 2,
      },
    });
  }
  return edges;
}

const nodeTypes = { step: StepNode, decision: StepNode, outcome: StepNode };

interface RoadmapCanvasProps {
  roadmapNodes: RoadmapNode[];
  roadmapType: string;
  selectedNodeId: string | null;
  onNodeClick: (node: RoadmapNode) => void;
  onNodeUpdate: (node: RoadmapNode) => void;
}

export function RoadmapCanvas({
  roadmapNodes,
  roadmapType,
  selectedNodeId,
  onNodeClick,
}: RoadmapCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const buildFlowNodes = useCallback(
    (dbNodes: RoadmapNode[], selectedId: string | null): Node[] => {
      return dbNodes
        .filter((n) => !n.parentId || roadmapType === "multipath")
        .map((n) => ({
          id: n.id,
          type: n.type === "decision" ? "decision" : n.type === "outcome" ? "outcome" : "step",
          position: { x: n.positionX || 0, y: n.positionY || 0 },
          data: {
            title: n.title,
            description: n.description,
            status: n.status,
            type: n.type,
            points: n.points,
            cost: n.cost,
            timeEstimate: n.timeEstimate,
            isSelected: n.id === selectedId,
            onClick: () => onNodeClick(n),
          } as StepNodeData,
          draggable: true,
        }));
    },
    [onNodeClick, roadmapType]
  );

  useEffect(() => {
    if (roadmapNodes.length === 0) return;

    const hasParentIds = roadmapNodes.some((n) => n.parentId);
    const rawEdges =
      hasParentIds || roadmapType === "multipath"
        ? buildEdges(roadmapNodes)
        : buildLinearEdges(roadmapNodes);

    const rawNodes = buildFlowNodes(roadmapNodes, selectedNodeId);

    if (rawNodes.length === 0) return;

    const { nodes: layoutNodes, edges: layoutEdges } = getLayoutedElements(
      rawNodes,
      rawEdges
    );

    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [roadmapNodes, roadmapType, selectedNodeId, buildFlowNodes, setNodes, setEdges]);

  const progressStats = useMemo(() => {
    const total = roadmapNodes.length;
    const completed = roadmapNodes.filter(
      (n) => n.status === "completed"
    ).length;
    const points = roadmapNodes.reduce(
      (sum, n) => (n.status === "completed" ? sum + n.points : sum),
      0
    );
    const totalPoints = roadmapNodes.reduce((sum, n) => sum + n.points, 0);
    return { total, completed, points, totalPoints };
  }, [roadmapNodes]);

  if (roadmapNodes.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background text-muted-foreground gap-3">
        <div className="text-5xl">🗺️</div>
        <p className="text-lg font-medium text-foreground">No steps yet</p>
        <p className="text-sm">
          Use &quot;AI Suggest&quot; on the conflict page to generate steps, or
          add them manually via the conflict page.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 relative">
      {/* Progress bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-card/90 backdrop-blur-sm border border-border rounded-xl px-4 py-2 flex items-center gap-4 shadow-lg">
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-300"
              style={{
                width:
                  progressStats.total > 0
                    ? `${(progressStats.completed / progressStats.total) * 100}%`
                    : "0%",
              }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {progressStats.completed}/{progressStats.total} steps
          </span>
        </div>
        <div className="w-px h-4 bg-border" />
        <span className="text-xs text-yellow-400 font-medium">
          ⭐ {progressStats.points}/{progressStats.totalPoints} pts
        </span>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed },
        }}
        className="bg-background"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#1e293b"
        />
        <Controls
          className="!bg-card !border-border"
          showInteractive={false}
        />
        <MiniMap
          className="!bg-card !border-border"
          nodeColor={(node) => {
            const status = (node.data as StepNodeData).status;
            if (status === "completed") return "#22c55e";
            if (status === "in_progress") return "#3b82f6";
            if (status === "blocked") return "#ef4444";
            if (status === "stuck") return "#f97316";
            return "#475569";
          }}
          maskColor="rgba(15, 23, 42, 0.7)"
        />
      </ReactFlow>
    </div>
  );
}
