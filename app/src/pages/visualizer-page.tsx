import { useEffect, useMemo, useRef, useState } from "react";
import { NotesPad } from "../components/notes/notes-pad";
import { useNavigate, useSearchParams } from "react-router-dom";
import { RoomCanvas } from "../components/canvas/room-canvas";
import { useVisualizerStore } from "../store/visualizer-store";
import { getProject, updateProject } from "../api/client";
import { Toolbar } from "../components/controls/toolbar";
import { SaveShare } from "../components/save/save-share";
import { DownloadPreview } from "../components/save/download-preview";
import { MaterialLibrary } from "../components/materials/material-library";
import type { Scene } from "../types";
import type { AppliedMaterial } from "../store/visualizer-store";

const LAST_PROJECT_KEY = "room-visualizer:last-project";
const MATERIAL_OVERLAY_OPACITY = 0.82;

const isAppliedMaterialValue = (value: unknown): value is AppliedMaterial =>
  Boolean(value && typeof value === "object" && "materialId" in value);

const resolveSceneApplied = (
  applied: Scene["appliedMaterials"] | undefined,
  fallback: Record<string, AppliedMaterial>,
) => {
  if (!applied) return {};
  const resolved: Record<string, AppliedMaterial> = {};
  Object.entries(applied).forEach(([key, value]) => {
    if (isAppliedMaterialValue(value)) {
      resolved[key] = value;
      return;
    }
    if (typeof value === "string") {
      const match = Object.values(fallback).find(
        (material) => material.materialId === value,
      );
      if (match) resolved[key] = match;
    }
  });
  return resolved;
};

const areAppliedMaterialsEqual = (
  a: Record<string, AppliedMaterial>,
  b: Record<string, AppliedMaterial>,
) =>
  Object.keys(a).length === Object.keys(b).length &&
  Object.keys(a).every((key) => {
    const left = a[key];
    const right = b[key];
    return (
      right &&
      left.materialId === right.materialId &&
      left.assetUrl === right.assetUrl &&
      left.color === right.color &&
      left.rotation === right.rotation
    );
  });

const getBaseMaterials = (applied: Record<string, AppliedMaterial>) => {
  const baseMaterials = new Map<string, AppliedMaterial>();
  Object.entries(applied).forEach(([label, material]) => {
    baseMaterials.set(getBaseLabel(label), material);
  });
  return baseMaterials;
};

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
  const applyToAllScenes = useVisualizerStore((s) => s.applyToAllScenes);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const fullscreenPreviewRef = useRef<HTMLDivElement | null>(null);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const [fullscreenSize, setFullscreenSize] = useState({ width: 0, height: 0 });
  const [previewImageNatural, setPreviewImageNatural] = useState({
    width: 0,
    height: 0,
  });
  const [hoveredModalLabel, setHoveredModalLabel] = useState<string | null>(null);
  const [isModalNotesOpen, setIsModalNotesOpen] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<"materials" | "notes">(
    "materials",
  );
  const appliedMaterialsRef = useRef(appliedMaterials);
  const lastSelectedBaseRef = useRef<string | null>(null);
  const lastNotesKeyRef = useRef<string>("");
  const notesDraft = useVisualizerStore((s) => s.notesDraft);
  const setNotesDraft = useVisualizerStore((s) => s.setNotesDraft);
  const lastSceneIdRef = useRef<string | null>(null);
  const scenesFallbackRef = useRef<Scene[]>([]);
  const visibleDetections = useMemo(
    () =>
      detectionResult?.detections.filter((d) =>
        VISIBLE_LABELS.has(getBaseLabel(d.label))
      ) ?? [],
    [detectionResult]
  );

  const selectedBase = selectedRegionId ? getBaseLabel(selectedRegionId) : null;
  const selectedBaseDetections = selectedBase
    ? visibleDetections.filter((d) => getBaseLabel(d.label) === selectedBase)
    : [];
  const previewAppliedDetections = useMemo(
    () =>
      (!renderedImageUrl || isMaterialModalOpen || isPreviewFullscreen)
        ? visibleDetections
            .map((d) => {
              const applied = appliedMaterials[d.label];
              if (!applied || !d.maskUrl) return null;
              return { detection: d, applied, maskUrl: d.maskUrl };
            })
            .filter(
              (
                item,
              ): item is {
                detection: (typeof visibleDetections)[number];
                applied: AppliedMaterial;
                maskUrl: string;
              } => Boolean(item),
            )
        : [],
    [
      appliedMaterials,
      renderedImageUrl,
      visibleDetections,
      isMaterialModalOpen,
      isPreviewFullscreen,
    ],
  );
  const scenesForUi = scenes.length > 0 ? scenes : scenesFallbackRef.current;
  const activeScene = useMemo(
    () => scenesForUi.find((scene) => scene.id === activeSceneId) ?? null,
    [activeSceneId, scenesForUi],
  );
  const previewImageUrl = renderedImageUrl ?? roomImageUrl;
  const modalPreviewImageUrl =
    activeScene?.roomImageUrl ?? roomImageUrl ?? previewImageUrl;
  const activeSceneIndex = useMemo(
    () => scenesForUi.findIndex((scene) => scene.id === activeSceneId),
    [activeSceneId, scenesForUi],
  );
  const goPrevScene = () => {
    if (scenesForUi.length === 0) return;
    const currentIndex = activeSceneIndex < 0 ? 0 : activeSceneIndex;
    const nextIndex =
      (currentIndex - 1 + scenesForUi.length) % scenesForUi.length;
    setActiveSceneId(scenesForUi[nextIndex]?.id ?? null);
  };
  const goNextScene = () => {
    if (scenesForUi.length === 0) return;
    const currentIndex = activeSceneIndex < 0 ? 0 : activeSceneIndex;
    const nextIndex = (currentIndex + 1) % scenesForUi.length;
    setActiveSceneId(scenesForUi[nextIndex]?.id ?? null);
  };
  const sceneNotesKey = useMemo(() => getSceneNotesKey(scenes), [scenes]);
  const normalizeNotesHtml = (raw: string) => {
    if (!raw) return "";
    const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(raw);
    if (looksLikeHtml) return raw;
    return raw
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br />");
  };

  const getContainRect = (
    containerW: number,
    containerH: number,
    imageW: number,
    imageH: number,
  ) => {
    if (!containerW || !containerH || !imageW || !imageH) {
      return { x: 0, y: 0, width: containerW, height: containerH };
    }
    const scale = Math.min(containerW / imageW, containerH / imageH);
    const width = imageW * scale;
    const height = imageH * scale;
    const x = (containerW - width) / 2;
    const y = (containerH - height) / 2;
    return { x, y, width, height };
  };

  const previewContain = useMemo(
    () =>
      getContainRect(
        previewSize.width,
        previewSize.height,
        previewImageNatural.width,
        previewImageNatural.height,
      ),
    [previewSize, previewImageNatural],
  );

  const fullscreenContain = useMemo(
    () =>
      getContainRect(
        fullscreenSize.width,
        fullscreenSize.height,
        previewImageNatural.width,
        previewImageNatural.height,
      ),
    [fullscreenSize, previewImageNatural],
  );

  const getPolygonPoints = (polygon?: { x: number; y: number }[]) =>
    polygon?.map((point) => `${point.x},${point.y}`).join(" ") ?? "";

  const hoveredDetection = hoveredModalLabel
    ? selectedBaseDetections.find((d) => d.label === hoveredModalLabel) ?? null
    : null;

  useEffect(() => {
    if (!hoveredModalLabel) return;
    const stillVisible = selectedBaseDetections.some(
      (d) => d.label === hoveredModalLabel,
    );
    if (!stillVisible) setHoveredModalLabel(null);
  }, [hoveredModalLabel, selectedBaseDetections]);

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
        lastNotesKeyRef.current = getSceneNotesKey(incomingScenes);
      })
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    if (!projectId || scenes.length === 0) return;
    if (sceneNotesKey === lastNotesKeyRef.current) return;
    const timeout = window.setTimeout(() => {
      updateProject(projectId, { scenes }).catch(() => {});
      lastNotesKeyRef.current = sceneNotesKey;
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [projectId, sceneNotesKey, scenes]);

  const handleSceneNotesChange = (nextNotes: string) => {
    if (!activeSceneId) return;
    setScenes((prev) =>
      prev.map((scene) =>
        scene.id === activeSceneId ? { ...scene, notes: nextNotes } : scene,
      ),
    );
  };

  useEffect(() => {
    if (!activeSceneId || lastSceneIdRef.current === activeSceneId) return;
    lastSceneIdRef.current = activeSceneId;
    setNotesDraft(normalizeNotesHtml(activeScene?.notes ?? ""));
  }, [activeScene?.notes, activeSceneId]);

  useEffect(() => {
    if (!activeSceneId) return;
    if ((activeScene?.notes ?? "") === notesDraft) return;
    const timeout = window.setTimeout(() => {
      handleSceneNotesChange(notesDraft);
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [activeScene?.notes, activeSceneId, notesDraft]);

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
    const scene = scenesForUi.find((item) => item.id === activeSceneId);
    if (!scene) return;
    const sceneApplied = resolveSceneApplied(
      scene.appliedMaterials,
      appliedMaterialsRef.current,
    );
    const baseMaterials = new Map<string, AppliedMaterial>();
    Object.entries(sceneApplied).forEach(([label, material]) => {
      baseMaterials.set(getBaseLabel(label), material);
    });
    const nextApplied: Record<string, AppliedMaterial> = {};
    scene.detectionResult?.detections.forEach((d) => {
      const base = getBaseLabel(d.label);
      const material = sceneApplied[d.label] ?? baseMaterials.get(base);
      if (material) {
        nextApplied[d.label] = material;
      }
    });
    const currentApplied = appliedMaterialsRef.current;
    const isSame = areAppliedMaterialsEqual(nextApplied, currentApplied);
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
    scenesForUi,
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
    if (scenes.length > 0) {
      scenesFallbackRef.current = scenes;
    }
  }, [scenes]);

  useEffect(() => {
    if (scenes.length === 0 && scenesFallbackRef.current.length > 0) {
      setScenes(scenesFallbackRef.current);
    }
  }, [scenes]);

  useEffect(() => {
    if (!activeSceneId) return;
    setScenes((prev) => {
      if (prev.length === 0) return prev;
      const baseMaterials = getBaseMaterials(appliedMaterials);
      const buildAppliedForScene = (scene: Scene) => {
        const nextApplied: Record<string, AppliedMaterial> = {};
        scene.detectionResult?.detections.forEach((d) => {
          const material = baseMaterials.get(getBaseLabel(d.label));
          if (material) nextApplied[d.label] = material;
        });
        return nextApplied;
      };
      if (applyToAllScenes) {
        let changed = false;
        const next = prev.map((scene) => {
          const current = resolveSceneApplied(
            scene.appliedMaterials,
            appliedMaterials,
          );
          const nextApplied = buildAppliedForScene(scene);
          if (!areAppliedMaterialsEqual(current, nextApplied)) {
            changed = true;
            return { ...scene, appliedMaterials: nextApplied };
          }
          return scene;
        });
        return changed ? next : prev;
      }
      const sceneIndex = prev.findIndex((scene) => scene.id === activeSceneId);
      if (sceneIndex < 0) return prev;
      const current = resolveSceneApplied(
        prev[sceneIndex].appliedMaterials,
        appliedMaterials,
      );
      if (areAppliedMaterialsEqual(current, appliedMaterials)) {
        return prev;
      }
      const next = [...prev];
      next[sceneIndex] = {
        ...next[sceneIndex],
        appliedMaterials: appliedMaterials,
      };
      return next;
    });
  }, [activeSceneId, appliedMaterials, applyToAllScenes]);

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
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:flex-nowrap">
            <aside className="flex w-full shrink-0 flex-col border-b border-slate-200/70 bg-white/90 dark:border-slate-800/70 dark:bg-slate-950/70 lg:w-44 lg:shrink-0 lg:border-b-0 lg:border-r">
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Scenes
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
                {scenesForUi.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 px-2 py-2 text-[10px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    No scenes
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {scenesForUi.map((scene, index) => {
                      const isActive = scene.id === activeSceneId;
                      const imageHeight = "h-20";
                      return (
                        <button
                          key={scene.id}
                          type="button"
                          onClick={() => setActiveSceneId(scene.id)}
                          className={`group flex w-full flex-col overflow-hidden rounded-xl border text-left shadow-sm transition-all ${
                            isActive
                              ? "border-emerald-500/80 bg-emerald-50/80 shadow-md"
                              : "border-slate-200/80 bg-white/80 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-950/70"
                          }`}
                        >
                          <div
                            className={`relative ${imageHeight} w-full overflow-hidden bg-slate-100/80 dark:bg-slate-900/60`}
                          >
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
                            {isActive && (
                              <span className="absolute right-2 top-2 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2 px-2 py-1 text-[10px] font-medium text-slate-700 dark:text-slate-200">
                            <span className="truncate">
                              {scene.name || `Scene ${index + 1}`}
                            </span>
                            <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                              {index + 1}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </aside>
            <aside className="flex w-full shrink-0 flex-col border-b border-slate-200/70 bg-white/90 p-3 backdrop-blur-sm dark:border-slate-800/70 dark:bg-slate-950/70 lg:w-56 lg:shrink-0 lg:border-b-0 lg:border-r">
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
            <div className="relative min-h-0 flex-1 lg:min-w-0">
              <RoomCanvas onDoubleClick={() => setIsPreviewFullscreen(true)} />
            </div>
            <aside className="flex w-full shrink-0 border-t border-slate-200/70 bg-white/90 dark:border-slate-800/70 dark:bg-slate-950/70 lg:w-80 lg:shrink-0 lg:border-l lg:border-t-0">
              <div className="flex min-h-0 w-full">
                <div className="flex w-10 shrink-0 flex-col border-r border-slate-200/70 bg-slate-50/80 dark:border-slate-800/70 dark:bg-slate-900/60">
                  <button
                    type="button"
                    onClick={() => setActiveSidebarTab("materials")}
                    className={`flex h-24 items-center justify-center text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                      activeSidebarTab === "materials"
                        ? "bg-white text-emerald-600 shadow-sm dark:bg-slate-950"
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                    style={{ writingMode: "vertical-rl" }}
                    aria-pressed={activeSidebarTab === "materials"}
                  >
                    Materials
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSidebarTab("notes")}
                    className={`flex h-24 items-center justify-center text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                      activeSidebarTab === "notes"
                        ? "bg-white text-emerald-600 shadow-sm dark:bg-slate-950"
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                    style={{ writingMode: "vertical-rl" }}
                    aria-pressed={activeSidebarTab === "notes"}
                  >
                    Notes
                  </button>
                </div>
                <div className="flex min-h-0 flex-1 flex-col">
                  {activeSidebarTab === "materials" ? (
                    <>
                      <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <span>Materials</span>
                        <button
                          type="button"
                          onClick={() => setIsMaterialModalOpen(true)}
                          className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-slate-100"
                        >
                          Browse
                        </button>
                      </div>
                      <div className="max-h-64 overflow-y-auto lg:max-h-none">
                        <MaterialLibrary />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <span>Notes</span>
                      </div>
                      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3">
                        <NotesPad
                          value={notesDraft}
                          onChange={setNotesDraft}
                          disabled={!activeScene}
                          ariaLabel="Scene notes"
                          className="min-h-[220px] flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900"
                          style={{
                            backgroundImage:
                              "linear-gradient(to bottom, rgba(148, 163, 184, 0.35) 1px, transparent 1px)",
                            backgroundSize: "100% 20px",
                          }}
                        />
                        {!activeScene && (
                          <span className="mt-2 text-[10px] text-slate-400">
                            Select a scene to add notes.
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </aside>
          </div>
          <div className="py-2" />
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
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsModalNotesOpen((prev) => !prev)}
                      className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-slate-100"
                      aria-pressed={isModalNotesOpen}
                    >
                      {isModalNotesOpen ? "Hide notes" : "Show notes"}
                    </button>
                  </div>
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
                      const segmentLabels = visibleDetections
                        .filter((item) => getBaseLabel(item.label) === base)
                        .map((item) => item.label)
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
                          aria-label={`${base} (${segmentLabels.join(", ")})`}
                        >
                          {base}
                        </button>
                      )
                    })
                  )}
                </div>
                {selectedRegionId && (
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    {(() => {
                      const base = getBaseLabel(selectedRegionId)
                      const segments = visibleDetections.filter(
                        (d) => getBaseLabel(d.label) === base,
                      )
                      if (segments.length === 0) return null
                      return (
                        <>
                          <span>Segments:</span>
                          {segments.map((segment) => {
                            const isActive = segment.label === selectedRegionId
                            return (
                              <button
                                key={segment.label}
                                type="button"
                                onClick={() => setSelectedRegionId(segment.label)}
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                                  isActive
                                    ? "bg-emerald-600 text-white"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                }`}
                              >
                                {segment.label}
                              </button>
                            )
                          })}
                        </>
                      )
                    })()}
                  </div>
                )}
                <div className="flex min-h-0 flex-1 gap-3">
                  <div
                    ref={previewContainerRef}
                    className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900"
                  >
                    {modalPreviewImageUrl ? (
                      <div
                        className="relative h-full w-full"
                        onDoubleClick={() => setIsPreviewFullscreen(true)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            setIsPreviewFullscreen(true);
                          }
                        }}
                      >
                        <img
                          src={modalPreviewImageUrl}
                          alt="Room preview"
                          className="h-full w-full rounded-xl object-contain"
                          onLoad={(event) => {
                            const img = event.currentTarget;
                            setPreviewImageNatural({
                              width: img.naturalWidth,
                              height: img.naturalHeight,
                            });
                          }}
                        />
                        {previewAppliedDetections.map(
                          ({ detection, applied, maskUrl }) => (
                            <div
                              key={`${detection.label}-${maskUrl}`}
                              className="pointer-events-none absolute inset-0 rounded-xl"
                              style={{
                                backgroundColor: applied.color ?? undefined,
                                backgroundSize: applied.assetUrl
                                  ? getTextureTileSize(
                                      previewSize.width,
                                      previewSize.height,
                                      detection.bbox ?? null,
                                    )
                                  : undefined,
                                backgroundRepeat: undefined,
                                backgroundPosition: undefined,
                                opacity: MATERIAL_OVERLAY_OPACITY,
                                mixBlendMode: "multiply",
                                WebkitMaskImage: `url(${maskUrl})`,
                                maskImage: `url(${maskUrl})`,
                                WebkitMaskSize: "contain",
                                maskSize: "contain",
                                WebkitMaskRepeat: "no-repeat",
                                maskRepeat: "no-repeat",
                                WebkitMaskPosition: "center",
                                maskPosition: "center",
                              }}
                            >
                              {applied.assetUrl && (
                                <div
                                  className="absolute inset-0"
                                  style={{
                                    backgroundImage: `url(${applied.assetUrl})`,
                                    backgroundSize: getTextureTileSize(
                                      previewSize.width,
                                      previewSize.height,
                                      detection.bbox ?? null,
                                    ),
                                    backgroundRepeat: "repeat",
                                    backgroundPosition: "top left",
                                    transform: `rotate(${applied.rotation ?? 0}deg)`,
                                    transformOrigin: "center",
                                  }}
                                />
                              )}
                            </div>
                          ),
                        )}
                        {selectedBaseDetections.length > 0 && (
                          <div className="absolute inset-0">
                            {hoveredDetection?.maskUrl && (
                              <div
                                className="pointer-events-none absolute inset-0 rounded-xl"
                                style={{
                                  backgroundColor: "rgba(34, 197, 94, 0.2)",
                                  WebkitMaskImage: `url(${hoveredDetection.maskUrl})`,
                                  maskImage: `url(${hoveredDetection.maskUrl})`,
                                  WebkitMaskSize: "contain",
                                  maskSize: "contain",
                                  WebkitMaskRepeat: "no-repeat",
                                  maskRepeat: "no-repeat",
                                  WebkitMaskPosition: "center",
                                  maskPosition: "center",
                                }}
                              />
                            )}
                            {hoveredDetection?.polygon &&
                              hoveredDetection.polygon.length >= 3 && (
                              <svg
                                className="pointer-events-none absolute"
                                style={{
                                  left: previewContain.x,
                                  top: previewContain.y,
                                  width: previewContain.width,
                                  height: previewContain.height,
                                }}
                                viewBox="0 0 100 100"
                                preserveAspectRatio="none"
                              >
                                <polygon
                                  points={getPolygonPoints(hoveredDetection.polygon)}
                                  fill="rgba(34, 197, 94, 0.12)"
                                  stroke="rgba(34, 197, 94, 0.9)"
                                  strokeWidth="2"
                                  strokeDasharray="6 4"
                                />
                              </svg>
                            )}
                            {selectedBaseDetections.map((d) => {
                              const centerX =
                                previewContain.x +
                                ((d.bbox.x + d.bbox.width / 2) / 100) *
                                  previewContain.width;
                              const centerY =
                                previewContain.y +
                                ((d.bbox.y + d.bbox.height / 2) / 100) *
                                  previewContain.height;
                              return (
                                <button
                                  key={d.label}
                                  type="button"
                                  onClick={() => setSelectedRegionId(d.label)}
                                  onMouseEnter={() => setHoveredModalLabel(d.label)}
                                  onMouseLeave={() =>
                                    setHoveredModalLabel((prev) =>
                                      prev === d.label ? null : prev,
                                    )
                                  }
                                  className="absolute rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm transition-colors hover:bg-slate-900/90"
                                  style={{
                                    left: centerX,
                                    top: centerY,
                                    transform: "translate(-50%, -50%)",
                                  }}
                                >
                                  {d.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        No preview available.
                      </div>
                    )}
                  </div>
                  {isModalNotesOpen && (
                    <div className="hidden min-h-0 w-52 flex-col gap-2 rounded-2xl border border-slate-200 bg-white/80 p-3 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200 md:flex">
                      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <span>Notes</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          Notepad
                        </span>
                      </div>
                      <NotesPad
                        value={notesDraft}
                        onChange={setNotesDraft}
                        disabled={!activeScene}
                        ariaLabel="Scene notes"
                        className="min-h-[220px] flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900"
                        style={{
                          backgroundImage:
                            "linear-gradient(to bottom, rgba(148, 163, 184, 0.35) 1px, transparent 1px)",
                          backgroundSize: "100% 20px",
                        }}
                      />
                      {!activeScene && (
                        <span className="text-[10px] text-slate-400">
                          Select a scene to add notes.
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex min-h-0 w-48 flex-col gap-2 overflow-y-auto rounded-2xl border border-slate-200 bg-white/80 p-2 dark:border-slate-700 dark:bg-slate-950/60">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Scenes
                    </div>
                    {scenesForUi.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 px-2 py-2 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        No scenes
                      </div>
                    ) : (
                      scenesForUi.map((scene, index) => {
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
      {isPreviewFullscreen && (
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
            <div className="relative min-h-0 flex-1">
              {scenesForUi.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goPrevScene}
                    className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-700 shadow-md transition-colors hover:bg-white dark:bg-slate-900/90 dark:text-slate-200"
                    aria-label="Previous scene"
                  >
                    <ArrowLeftIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={goNextScene}
                    className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-700 shadow-md transition-colors hover:bg-white dark:bg-slate-900/90 dark:text-slate-200"
                    aria-label="Next scene"
                  >
                    <ArrowRightIcon className="h-4 w-4" />
                  </button>
                </>
              )}
              <div
                ref={fullscreenPreviewRef}
                className="flex min-h-0 h-full items-center justify-center bg-slate-50 p-4 dark:bg-slate-900"
              >
                {modalPreviewImageUrl ? (
                  <div className="relative h-full w-full">
                  <img
                    src={modalPreviewImageUrl}
                    alt="Room preview"
                    className="h-full w-full rounded-xl object-contain"
                    onLoad={(event) => {
                      const img = event.currentTarget;
                      setPreviewImageNatural({
                        width: img.naturalWidth,
                        height: img.naturalHeight,
                      });
                    }}
                  />
                  {previewAppliedDetections.map(
                    ({ detection, applied, maskUrl }) => (
                      <div
                        key={`${detection.label}-${maskUrl}`}
                        className="pointer-events-none absolute inset-0 rounded-xl"
                        style={{
                          backgroundColor: applied.color ?? undefined,
                          backgroundSize: applied.assetUrl
                            ? getTextureTileSize(
                                fullscreenSize.width,
                                fullscreenSize.height,
                                detection.bbox ?? null,
                              )
                            : undefined,
                          backgroundRepeat: undefined,
                          backgroundPosition: undefined,
                          opacity: MATERIAL_OVERLAY_OPACITY,
                          mixBlendMode: "multiply",
                          WebkitMaskImage: `url(${maskUrl})`,
                          maskImage: `url(${maskUrl})`,
                          WebkitMaskSize: "contain",
                          maskSize: "contain",
                          WebkitMaskRepeat: "no-repeat",
                          maskRepeat: "no-repeat",
                          WebkitMaskPosition: "center",
                          maskPosition: "center",
                        }}
                      >
                        {applied.assetUrl && (
                          <div
                            className="absolute inset-0"
                            style={{
                              backgroundImage: `url(${applied.assetUrl})`,
                              backgroundSize: getTextureTileSize(
                                fullscreenSize.width,
                                fullscreenSize.height,
                                detection.bbox ?? null,
                              ),
                              backgroundRepeat: "repeat",
                              backgroundPosition: "top left",
                              transform: `rotate(${applied.rotation ?? 0}deg)`,
                              transformOrigin: "center",
                            }}
                          />
                        )}
                      </div>
                    ),
                  )}
                  {selectedBaseDetections.length > 0 && (
                    <div className="absolute inset-0">
                      {hoveredDetection?.maskUrl && (
                        <div
                          className="pointer-events-none absolute inset-0 rounded-xl"
                          style={{
                            backgroundColor: "rgba(34, 197, 94, 0.2)",
                            WebkitMaskImage: `url(${hoveredDetection.maskUrl})`,
                            maskImage: `url(${hoveredDetection.maskUrl})`,
                            WebkitMaskSize: "contain",
                            maskSize: "contain",
                            WebkitMaskRepeat: "no-repeat",
                            maskRepeat: "no-repeat",
                            WebkitMaskPosition: "center",
                            maskPosition: "center",
                          }}
                        />
                      )}
                      {hoveredDetection?.polygon &&
                        hoveredDetection.polygon.length >= 3 && (
                        <svg
                          className="pointer-events-none absolute"
                          style={{
                            left: fullscreenContain.x,
                            top: fullscreenContain.y,
                            width: fullscreenContain.width,
                            height: fullscreenContain.height,
                          }}
                          viewBox="0 0 100 100"
                          preserveAspectRatio="none"
                        >
                          <polygon
                            points={getPolygonPoints(hoveredDetection.polygon)}
                            fill="rgba(34, 197, 94, 0.12)"
                            stroke="rgba(34, 197, 94, 0.9)"
                            strokeWidth="2"
                            strokeDasharray="6 4"
                          />
                        </svg>
                      )}
                      {selectedBaseDetections.map((d) => {
                        const centerX =
                          fullscreenContain.x +
                          ((d.bbox.x + d.bbox.width / 2) / 100) *
                            fullscreenContain.width;
                        const centerY =
                          fullscreenContain.y +
                          ((d.bbox.y + d.bbox.height / 2) / 100) *
                            fullscreenContain.height;
                        return (
                          <button
                            key={d.label}
                            type="button"
                            onClick={() => setSelectedRegionId(d.label)}
                            onMouseEnter={() => setHoveredModalLabel(d.label)}
                            onMouseLeave={() =>
                              setHoveredModalLabel((prev) =>
                                prev === d.label ? null : prev,
                              )
                            }
                            className="absolute rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm transition-colors hover:bg-slate-900/90"
                            style={{
                              left: centerX,
                              top: centerY,
                              transform: "translate(-50%, -50%)",
                            }}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
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
        </div>
      )}
    </div>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 6l6 6-6 6" />
    </svg>
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

function getSceneNotesKey(scenes: Scene[]) {
  return scenes
    .map((scene) => `${scene.id}:${scene.notes ?? ""}`)
    .join("|");
}

