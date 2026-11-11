"use client";

import React, { useState } from "react";
import { GalaxyNode } from "@/lib/api";
import { Radio, Eye, Layers } from "lucide-react";

interface ConversationGalaxyProps {
  nodes?: GalaxyNode[];
  dataMode?: string;
}

export function ConversationGalaxy({ nodes = [], dataMode = "live" }: ConversationGalaxyProps) {
  const [selectedNode, setSelectedNode] = useState<GalaxyNode | null>(null);

  // Fallback nodes if empty
  const activeNodes: GalaxyNode[] = nodes.length > 0 ? nodes : [
    {
      id: "src-1",
      name: "Antara News",
      volume: 42,
      sentiment_score: -0.28,
      threat_level: "waspada",
      orbit_radius: 95,
      angle: 45,
      top_topic: "Bencana",
    },
    {
      id: "src-2",
      name: "detikcom",
      volume: 68,
      sentiment_score: -0.42,
      threat_level: "kritis",
      orbit_radius: 135,
      angle: 125,
      top_topic: "Infrastruktur",
    },
    {
      id: "src-3",
      name: "CNN Indonesia",
      volume: 31,
      sentiment_score: -0.15,
      threat_level: "aman",
      orbit_radius: 110,
      angle: 215,
      top_topic: "Sosial",
    },
    {
      id: "src-4",
      name: "BMKG Resmi",
      volume: 18,
      sentiment_score: 0.10,
      threat_level: "aman",
      orbit_radius: 70,
      angle: 290,
      top_topic: "Bencana",
    },
    {
      id: "src-5",
      name: "Dishub DKI",
      volume: 24,
      sentiment_score: -0.20,
      threat_level: "waspada",
      orbit_radius: 125,
      angle: 345,
      top_topic: "Pelayanan Publik",
    },
  ];

  const centerX = 175;
  const centerY = 175;

  return (
    <div className="panel p-5 relative overflow-hidden bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
          <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
            RADAR MEDIA &amp; ORBIT SUMBER (GALAXY)
          </h3>
        </div>
        <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          360° LIVE SWEEP
        </span>
      </div>

      {/* Radar Visualizer Screen */}
      <div className="relative my-4 flex items-center justify-center select-none">
        <svg
          viewBox="0 0 350 350"
          className="w-full max-w-[340px] aspect-square overflow-visible"
        >
          <defs>
            {/* Radar Sweep Radial Gradient */}
            <linearGradient id="sweepGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.4" />
              <stop offset="70%" stopColor="currentColor" stopOpacity="0.05" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Background circular screen */}
          <circle
            cx={centerX}
            cy={centerY}
            r="160"
            className="fill-zinc-50 dark:fill-zinc-950 stroke-zinc-300 dark:stroke-zinc-800"
            strokeWidth="1.5"
          />

          {/* Concentric distance rings */}
          <circle
            cx={centerX}
            cy={centerY}
            r="125"
            className="stroke-zinc-300 dark:stroke-zinc-800/80 fill-none"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <circle
            cx={centerX}
            cy={centerY}
            r="85"
            className="stroke-zinc-300 dark:stroke-zinc-800/80 fill-none"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <circle
            cx={centerX}
            cy={centerY}
            r="45"
            className="stroke-zinc-300 dark:stroke-zinc-800/80 fill-none"
            strokeWidth="1"
          />

          {/* Axis Crosshairs */}
          <line
            x1="15"
            y1={centerY}
            x2="335"
            y2={centerY}
            className="stroke-zinc-300 dark:stroke-zinc-800/60"
            strokeWidth="1"
          />
          <line
            x1={centerX}
            y1="15"
            x2={centerX}
            y2="335"
            y2-offset="0"
            className="stroke-zinc-300 dark:stroke-zinc-800/60"
            strokeWidth="1"
          />

          {/* Central Command Beacon */}
          <circle
            cx={centerX}
            cy={centerY}
            r="6"
            className="fill-zinc-900 dark:fill-white"
          />
          <circle
            cx={centerX}
            cy={centerY}
            r="12"
            className="stroke-zinc-900 dark:stroke-white fill-none opacity-40 animate-radarblip"
          />

          {/* Rotating Sweep Beam */}
          <g className="origin-[175px_175px] animate-radarsweep text-zinc-900 dark:text-zinc-100">
            <line
              x1={centerX}
              y1={centerY}
              x2={centerX}
              y2="15"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            {/* Sweep pie slice segment */}
            <path
              d={`M ${centerX} ${centerY} L ${centerX} 15 A 160 160 0 0 1 ${centerX + 110} ${centerY - 110} Z`}
              fill="url(#sweepGradient)"
            />
          </g>

          {/* Orbiting Source Blips */}
          {activeNodes.map((node) => {
            const rad = (node.angle * Math.PI) / 180;
            const x = centerX + node.orbit_radius * Math.cos(rad);
            const y = centerY + node.orbit_radius * Math.sin(rad);

            const isSelected = selectedNode?.id === node.id;
            const isCritical = node.threat_level === "kritis";

            let blipColor = "fill-zinc-800 dark:fill-zinc-200";
            if (isCritical) {
              blipColor = "fill-red-500";
            } else if (node.threat_level === "waspada") {
              blipColor = "fill-amber-500";
            }

            return (
              <g
                key={node.id}
                className="cursor-pointer transition-transform duration-200"
                onClick={() => setSelectedNode(node)}
                onMouseEnter={() => setSelectedNode(node)}
              >
                {/* Ping blip for alert */}
                {isCritical && (
                  <circle
                    cx={x}
                    cy={y}
                    r="14"
                    className="stroke-red-500 fill-none opacity-60 animate-ping"
                  />
                )}
                {/* Target Dot */}
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 9 : 6}
                  className={`${blipColor} transition-all stroke-white dark:stroke-black stroke-2 shadow-md`}
                />
                {/* Node Label */}
                <text
                  x={x}
                  y={y + 16}
                  textAnchor="middle"
                  className={`text-[9px] font-mono font-bold tracking-tight ${
                    isSelected
                      ? "fill-zinc-900 dark:fill-white"
                      : "fill-zinc-500 dark:fill-zinc-400"
                  }`}
                >
                  {node.name}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Selected Node Drawer Overlay */}
        {selectedNode && (
          <div className="absolute bottom-2 left-2 right-2 p-3 rounded-lg bg-white/95 dark:bg-black/90 backdrop-blur border border-zinc-300 dark:border-zinc-700 shadow-xl text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="font-bold text-zinc-900 dark:text-white">
                {selectedNode.name}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  selectedNode.threat_level === "kritis"
                    ? "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30"
                    : selectedNode.threat_level === "waspada"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                    : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                {selectedNode.threat_level.toUpperCase()}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-[11px]">
              <span>Volume: {selectedNode.volume} Laporan</span>
              <span>Topik: {selectedNode.top_topic}</span>
              <span>Skor Sentimen: {selectedNode.sentiment_score}</span>
            </div>
          </div>
        )}
      </div>

      {/* Legend Footer */}
      <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Kritis
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Waspada
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-zinc-800 dark:bg-zinc-200" /> Terpantau
          </span>
        </div>
        <span>Klik atau arahkan kursor ke node sumber</span>
      </div>
    </div>
  );
}
