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
  const roomImageUrl = useVisualizerStore((s) => s.roomImageUrl);
  const renderedImageUrl = useVisualizerStore((s) => s.renderedImageUrl);
  const selectedMaterial = useVisualizerStore((s) => s.selectedMaterial);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [isLargeSceneView, setIsLargeSceneView] = useState(false);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const fullscreenPreviewRef = useRef<HTMLDivElement | null>(null);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const [fullscreenSize, setFullscreenSize] = useState({ width: 0, height: 0 });
  const appliedMaterialsRef = useRef(appliedMaterials);
  const lastSelectedBaseRef = useRef<string | null>(null);
  const visibleDetections = useMemo(
    () =>
      detectionResult?.detections.filter((d) =>
        VISIBLE_LABELS.has(getBaseLabel(d.label))
      ) ?? [],
    [detectionResult]
  );

  const previewImageUrl = renderedImageUrl ?? roomImageUrl;
  const previewMaskUrl = selectedRegionId
    ? detectionResult?.detections.find((d) => d.label === selectedRegionId)?.maskUrl ??
      null
    : null;
  const appliedMaterial = selectedRegionId
    ? appliedMaterials[selectedRegionId] ?? null
    : null;
  const previewMaterialColor =
    (selectedMaterial?.metadata?.color as string | undefined) ??
    appliedMaterial?.color ??
    null;
  const previewMaterialTexture =
    selectedMaterial?.assetUrl ?? appliedMaterial?.assetUrl ?? null;
  const previewDetection = selectedRegionId
    ? detectionResult?.detections.find((d) => d.label === selectedRegionId) ?? null
    : null;

  const getTextureTileSize = (
    width: number,
    height: number,
    bbox?: { width: number; height: number } | null,
  ) => {
    if (!width || !height || !bbox) return "160px 160px";
    const surfaceW = (bbox.width / 100) * width;
    const surfaceH = (bbox.height / 100) * height;
    const tileW = Math.max(surfaceW / 4, 48);
    const tileH = Math.max(surfaceH / 4, 48);
    return `${tileW.toFixed(0)}px ${tileH.toFixed(0)}px`;
  };

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

  useEffect(() => {
    if (!isMaterialModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMaterialModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMaterialModalOpen]);

  useEffect(() => {
    if (!previewContainerRef.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setPreviewSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(previewContainerRef.current);
    return () => observer.disconnect();
  }, [isMaterialModalOpen]);

  useEffect(() => {
    if (!fullscreenPreviewRef.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setFullscreenSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(fullscreenPreviewRef.current);
    return () => observer.disconnect();
  }, [isPreviewFullscreen]);

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
              <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <span>Materials</span>
                <button
                  type="button"
                  onClick={() => setIsMaterialModalOpen(true)}
                  className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-slate-100"
                >
                  Open materials
                </button>
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
      {isMaterialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div
            className="absolute inset-0"
            onClick={() => setIsMaterialModalOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Materials browser"
            className="relative z-10 flex h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Materials
              </div>
              <button
                type="button"
                onClick={() => setIsMaterialModalOpen(false)}
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Close materials"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-row gap-4 overflow-hidden p-3">
              <div className="flex min-h-0 w-3/5 flex-col gap-3">
                <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <span>Preview</span>
                  <button
                    type="button"
                    onClick={() => setIsPreviewFullscreen(true)}
                    className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-slate-100"
                    disabled={!previewImageUrl}
                  >
                    Full screen
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {visibleDetections.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 px-2 py-1.5 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      No surfaces detected.
                    </div>
                  ) : (
                    Array.from(
                      new Map(
                        visibleDetections.map((d) => [getBaseLabel(d.label), d]),
                      ).values(),
                    ).map((d) => {
                      const base = getBaseLabel(d.label)
                      const isActive =
                        selectedRegionId &&
                        getBaseLabel(selectedRegionId) === base
                      return (
                        <button
                          key={base}
                          type="button"
                          onClick={() =>
                            setSelectedRegionId(isActive ? null : d.label)
                          }
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                            isActive
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                          }`}
                        >
                          {base}
                        </button>
                      )
                    })
                  )}
                </div>
                <div className="flex min-h-0 flex-1 gap-3">
                  <div
                    ref={previewContainerRef}
                    className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900"
                  >
                    {previewImageUrl ? (
                      <div className="relative h-full w-full">
                        <img
                          src={previewImageUrl}
                          alt="Room preview"
                          className="h-full w-full rounded-xl object-contain"
                        />
                        {previewMaskUrl &&
                          (previewMaterialColor || previewMaterialTexture) && (
                            <div
                              className="pointer-events-none absolute inset-0 rounded-xl"
                              style={{
                                backgroundColor: previewMaterialColor ?? undefined,
                                backgroundImage: previewMaterialTexture
                                  ? `url(${previewMaterialTexture})`
                                  : undefined,
                                backgroundSize: previewMaterialTexture
                                  ? getTextureTileSize(
                                      previewSize.width,
                                      previewSize.height,
                                      previewDetection?.bbox ?? null,
                                    )
                                  : undefined,
                                backgroundRepeat: previewMaterialTexture
                                  ? "repeat"
                                  : undefined,
                                backgroundPosition: previewMaterialTexture
                                  ? "top left"
                                  : undefined,
                                mixBlendMode: "multiply",
                                WebkitMaskImage: `url(${previewMaskUrl})`,
                                maskImage: `url(${previewMaskUrl})`,
                                WebkitMaskSize: "contain",
                                maskSize: "contain",
                                WebkitMaskRepeat: "no-repeat",
                                maskRepeat: "no-repeat",
                                WebkitMaskPosition: "center",
                                maskPosition: "center",
                              }}
                            />
                          )}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        No preview available.
                      </div>
                    )}
                  </div>
                  <div className="flex min-h-0 w-48 flex-col gap-2 overflow-y-auto rounded-2xl border border-slate-200 bg-white/80 p-2 dark:border-slate-700 dark:bg-slate-950/60">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Scenes
                    </div>
                    {scenes.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 px-2 py-2 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        No scenes
                      </div>
                    ) : (
                      scenes.map((scene, index) => {
                        const isActive = scene.id === activeSceneId
                        return (
                          <button
                            key={scene.id}
                            type="button"
                            onClick={() => setActiveSceneId(scene.id)}
                            className={`group relative flex flex-col overflow-hidden rounded-xl border text-left text-[11px] font-medium transition-all ${
                              isActive
                                ? "border-emerald-500 bg-emerald-50/70 text-emerald-800"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                            }`}
                          >
                            <div className="relative h-[180px] w-full overflow-hidden bg-slate-100">
                              {scene.roomImageUrl ? (
                                <img
                                  src={scene.roomImageUrl}
                                  alt={scene.name}
                                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                                  No preview
                                </div>
                              )}
                              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-slate-950/70 via-slate-950/20 to-transparent" />
                              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-white">
                                <span className="truncate">
                                  {scene.name || `Scene ${index + 1}`}
                                </span>
                                <span>{index + 1}</span>
                              </div>
                              {isActive && (
                                <span className="absolute right-2 top-2 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                                  Active
                                </span>
                              )}
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
              <div className="min-h-0 w-2/5 overflow-y-auto">
                <MaterialLibrary />
              </div>
            </div>
          </div>
        </div>
      )}
      {isMaterialModalOpen && isPreviewFullscreen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4">
          <div
            className="absolute inset-0"
            onClick={() => setIsPreviewFullscreen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Preview
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewFullscreen(false)}
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Close preview"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div
              ref={fullscreenPreviewRef}
              className="flex min-h-0 flex-1 items-center justify-center bg-slate-50 p-4 dark:bg-slate-900"
            >
              {previewImageUrl ? (
                <div className="relative h-full w-full">
                  <img
                    src={previewImageUrl}
                    alt="Room preview"
                    className="h-full w-full rounded-xl object-contain"
                  />
                  {previewMaskUrl && (previewMaterialColor || previewMaterialTexture) && (
                    <div
                      className="pointer-events-none absolute inset-0 rounded-xl"
                      style={{
                        backgroundColor: previewMaterialColor ?? undefined,
                        backgroundImage: previewMaterialTexture
                          ? `url(${previewMaterialTexture})`
                          : undefined,
                        backgroundSize: previewMaterialTexture
                          ? getTextureTileSize(
                              fullscreenSize.width,
                              fullscreenSize.height,
                              previewDetection?.bbox ?? null,
                            )
                          : undefined,
                        backgroundRepeat: previewMaterialTexture
                          ? "repeat"
                          : undefined,
                        backgroundPosition: previewMaterialTexture
                          ? "top left"
                          : undefined,
                        mixBlendMode: "multiply",
                        WebkitMaskImage: `url(${previewMaskUrl})`,
                        maskImage: `url(${previewMaskUrl})`,
                        WebkitMaskSize: "contain",
                        maskSize: "contain",
                        WebkitMaskRepeat: "no-repeat",
                        maskRepeat: "no-repeat",
                        WebkitMaskPosition: "center",
                        maskPosition: "center",
                      }}
                    />
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  No preview available.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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

