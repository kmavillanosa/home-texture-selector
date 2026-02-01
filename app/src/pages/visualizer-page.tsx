import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { RoomCanvas } from "../components/canvas/room-canvas";
import { useVisualizerStore } from "../store/visualizer-store";
import { getProject } from "../api/client";
import { Toolbar } from "../components/controls/toolbar";
import { SaveShare } from "../components/save/save-share";
import { DownloadPreview } from "../components/save/download-preview";
import { MaterialLibrary } from "../components/materials/material-library";
import type { Scene } from "../types";
import type { AppliedMaterial } from "../store/visualizer-store";

const LAST_PROJECT_KEY = "room-visualizer:last-project";

export function VisualizerPage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project");
  const navigate = useNavigate();
  const setRoomImage = useVisualizerStore((s) => s.setRoomImage);
  const setDetectionResult = useVisualizerStore((s) => s.setDetectionResult);
  const detectionResult = useVisualizerStore((s) => s.detectionResult);
  const selectedRegionId = useVisualizerStore((s) => s.selectedRegionId);
  const setSelectedRegionId = useVisualizerStore((s) => s.setSelectedRegionId);
  const setSelectedMaterial = useVisualizerStore((s) => s.setSelectedMaterial);
  const setRenderedImageUrl = useVisualizerStore((s) => s.setRenderedImageUrl);
  const setAppliedMaterials = useVisualizerStore((s) => s.setAppliedMaterials);
  const appliedMaterials = useVisualizerStore((s) => s.appliedMaterials);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [isLargeSceneView, setIsLargeSceneView] = useState(false);
  const appliedMaterialsRef = useRef(appliedMaterials);
  const lastSelectedBaseRef = useRef<string | null>(null);
  const visibleDetections = useMemo(
    () =>
      detectionResult?.detections.filter((d) =>
        VISIBLE_LABELS.has(getBaseLabel(d.label))
      ) ?? [],
    [detectionResult]
  );

  useEffect(() => {
    if (projectId) {
      localStorage.setItem(LAST_PROJECT_KEY, projectId);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) return;
    const lastProjectId = localStorage.getItem(LAST_PROJECT_KEY);
    if (!lastProjectId) return;
    navigate(`/visualizer?project=${lastProjectId}`, { replace: true });
  }, [navigate, projectId]);

  useEffect(() => {
    if (!projectId) return;
    getProject(projectId)
      .then((project) => {
        const incomingScenes =
          project.scenes?.length && project.scenes.length > 0
            ? project.scenes
            : [
                {
                  id: project.id,
                  name: project.name,
                  roomImageUrl: project.roomImageUrl,
                  detectionResult: project.detectionResult,
                  appliedMaterials: project.appliedMaterials ?? {},
                },
              ];
        setScenes(incomingScenes);
        setActiveSceneId(incomingScenes[0]?.id ?? null);
      })
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    if (!detectionResult || selectedRegionId) return;
    const wall = detectionResult.detections.find(
      (d) => getBaseLabel(d.label) === "Wall"
    );
    if (wall) {
      setSelectedRegionId(wall.label);
      return;
    }
    if (visibleDetections[0]) {
      setSelectedRegionId(visibleDetections[0].label);
    }
  }, [
    detectionResult,
    selectedRegionId,
    setSelectedRegionId,
    visibleDetections,
  ]);

  useEffect(() => {
    if (!selectedRegionId) return;
    lastSelectedBaseRef.current = getBaseLabel(selectedRegionId);
  }, [selectedRegionId]);

  useEffect(() => {
    if (!activeSceneId) return;
    const scene = scenes.find((item) => item.id === activeSceneId);
    if (!scene) return;
    const baseMaterials = new Map<string, AppliedMaterial>();
    Object.entries(appliedMaterialsRef.current).forEach(([label, material]) => {
      baseMaterials.set(getBaseLabel(label), material);
    });
    const nextApplied: Record<string, AppliedMaterial> = {};
    scene.detectionResult?.detections.forEach((d) => {
      const base = getBaseLabel(d.label);
      const material = baseMaterials.get(base);
      if (material) {
        nextApplied[d.label] = material;
      }
    });
    const currentApplied = appliedMaterialsRef.current;
    const isSame =
      Object.keys(nextApplied).length === Object.keys(currentApplied).length &&
      Object.keys(nextApplied).every((key) => {
        const a = nextApplied[key];
        const b = currentApplied[key];
        return (
          b &&
          a.materialId === b.materialId &&
          a.assetUrl === b.assetUrl &&
          a.color === b.color
        );
      });
    setRoomImage(scene.roomImageUrl);
    setDetectionResult(scene.detectionResult ?? null);
    if (!isSame) {
      setAppliedMaterials(nextApplied);
    }
    const preferredBase = lastSelectedBaseRef.current;
    if (preferredBase && scene.detectionResult?.detections) {
      const match = scene.detectionResult.detections.find(
        (d) => getBaseLabel(d.label) === preferredBase
      );
      setSelectedRegionId(match?.label ?? null);
    } else {
      setSelectedRegionId(null);
    }
    setSelectedMaterial(null);
    setRenderedImageUrl(null);
  }, [
    activeSceneId,
    scenes,
    setAppliedMaterials,
    setDetectionResult,
    setRenderedImageUrl,
    setRoomImage,
    setSelectedMaterial,
    setSelectedRegionId,
  ]);

  useEffect(() => {
    appliedMaterialsRef.current = appliedMaterials;
  }, [appliedMaterials]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Studio toolbar — sticky so it stays visible when scrolling */}
      <div className="sticky top-0 z-20 flex shrink-0 items-center border-b border-slate-200/60 bg-transparent px-4 py-3 shadow-none backdrop-blur-sm dark:border-slate-800/60">
        <div className="flex w-full items-center gap-3">
          {!selectedRegionId && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Click a label on the image to choose a surface
            </span>
          )}
          <div className="ml-auto flex items-center gap-3">
            <Toolbar />
            <DownloadPreview />
            <SaveShare />
          </div>
        </div>
      </div>
      {/* Canvas + sidebars + scenes strip */}
      <div className="relative min-h-0 flex-1 overflow-hidden bg-slate-100 dark:bg-slate-950">
        <div className="flex h-full flex-col">
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <aside className="flex w-full shrink-0 flex-col border-b border-slate-200/70 bg-white/90 p-3 backdrop-blur-sm dark:border-slate-800/70 dark:bg-slate-950/70 lg:w-56 lg:border-b-0 lg:border-r">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Surfaces
              </div>
              <div className="max-h-48 min-h-0 overflow-y-auto lg:max-h-none lg:flex-1">
                {visibleDetections.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    No surfaces detected yet.
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {Array.from(
                      new Map(
                        visibleDetections.map((d) => [getBaseLabel(d.label), d])
                      ).values()
                    ).map((d) => {
                      const base = getBaseLabel(d.label);
                      const isActive =
                        selectedRegionId &&
                        getBaseLabel(selectedRegionId) === base;
                      return (
                        <button
                          key={base}
                          type="button"
                          onClick={() =>
                            setSelectedRegionId(isActive ? null : d.label)
                          }
                          className={`flex items-center justify-between rounded-md px-2.5 py-2 text-left text-xs font-medium transition-colors ${
                            isActive
                              ? "bg-emerald-600 text-white"
                              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                          }`}
                        >
                          <span className="truncate">{base}</span>
                          {isActive && (
                            <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white">
                              Editing
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </aside>
            <div className="relative min-h-0 flex-1">
              <RoomCanvas />
            </div>
            <aside className="flex w-full shrink-0 flex-col border-t border-slate-200/70 bg-white/90 dark:border-slate-800/70 dark:bg-slate-950/70 lg:w-72 lg:border-l lg:border-t-0">
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Materials
              </div>
              <div className="max-h-64 overflow-y-auto lg:max-h-none">
                <MaterialLibrary />
              </div>
            </aside>
          </div>
          <div className="border-t border-slate-200/70 bg-white/90 px-4 py-3 dark:border-slate-800/70 dark:bg-slate-950/70">
            <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <span>Scenes</span>
              <button
                type="button"
                onClick={() => setIsLargeSceneView((prev) => !prev)}
                className="rounded-full border border-slate-200 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-slate-100"
                aria-pressed={isLargeSceneView}
              >
                {isLargeSceneView ? "Small view" : "Large view"}
              </button>
            </div>
            <div className="flex items-center gap-3 overflow-x-auto pb-1">
              {scenes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No scenes available.
                </div>
              ) : (
                scenes.map((scene, index) => {
                  const isActive = scene.id === activeSceneId;
                  const cardWidth = isLargeSceneView ? "w-32 sm:w-40" : "w-20 sm:w-24";
                  const imageHeight = isLargeSceneView ? "h-20" : "h-10 sm:h-12";
                  return (
                    <button
                      key={scene.id}
                      type="button"
                      onClick={() => setActiveSceneId(scene.id)}
                      className={`group flex ${cardWidth} shrink-0 flex-col overflow-hidden rounded-2xl border text-left shadow-sm transition-all ${
                        isActive
                          ? "border-emerald-500 bg-emerald-50/70 shadow-md"
                          : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-950"
                      }`}
                    >
                      <div className={`relative ${imageHeight} w-full overflow-hidden bg-slate-100`}>
                        {scene.roomImageUrl ? (
                          <img
                            src={scene.roomImageUrl}
                            alt={scene.name}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                            No preview
                          </div>
                        )}
                        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-slate-950/25 via-transparent to-transparent" />
                        {isActive && (
                          <span className="absolute right-2 top-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                        <span className="truncate">
                          {scene.name || `Scene ${index + 1}`}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          {index + 1}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const VISIBLE_LABELS = new Set([
  "Wall",
  "Floor",
  "Ceiling",
  "Cabinet",
  "Shelf",
  "Countertop",
  "Backsplash",
]);

function getBaseLabel(label: string) {
  return label.replace(/\s+\d+$/, "");
}

function BackIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}
