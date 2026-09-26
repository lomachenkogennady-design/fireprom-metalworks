"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Trash2,
  FileDown,
  Save,
  ArrowUpRight,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Check,
  RotateCcw,
} from "lucide-react";
import { MATERIALS, THICKNESSES, type MaterialKey } from "@/lib/materials";
import {
  computeBending,
  bendingResultsToJson,
  type BendSpec,
  type HoleSpec,
} from "@/lib/geometry";
import { buildPartDxf } from "@/lib/dxf";
import { clsx } from "@/lib/format";
import { PartPreview } from "@/components/part-preview";

const Part3D = dynamic(() => import("@/components/part-3d"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <p className="num text-xs text-steel">сборка 3D-модели…</p>
    </div>
  ),
});

interface ClientRow {
  id: number;
  name: string;
}

const PRESETS: { label: string; flanges: number[]; bends: BendSpec[] }[] = [
  { label: "Полка", flanges: [25, 60], bends: [{ angle: 90, dir: 1 }] },
  {
    label: "П-образный",
    flanges: [50, 90, 50],
    bends: [
      { angle: 90, dir: 1 },
      { angle: 90, dir: 1 },
    ],
  },
  {
    label: "Z-профиль",
    flanges: [40, 70, 40],
    bends: [
      { angle: 90, dir: 1 },
      { angle: 90, dir: -1 },
    ],
  },
  {
    label: "Короб · 4 гиба",
    flanges: [30, 70, 30, 70, 30],
    bends: [
      { angle: 90, dir: 1 },
      { angle: 90, dir: 1 },
      { angle: 90, dir: 1 },
      { angle: 90, dir: 1 },
    ],
  },
];

const num = (v: number, d = 1) =>
  v.toLocaleString("ru-RU", { maximumFractionDigits: d });

export function BendingCalculator() {
  const sp = useSearchParams();

  const [name, setName] = useState("Деталь без названия");
  const [material, setMaterial] = useState<MaterialKey>("steel");
  const [thickness, setThickness] = useState(2);
  const [width, setWidth] = useState(200);
  const [flanges, setFlanges] = useState<number[]>([50, 90, 50]);
  const [bends, setBends] = useState<BendSpec[]>([
    { angle: 90, dir: 1 },
    { angle: 90, dir: 1 },
  ]);
  const [view, setView] = useState<"profile" | "flat" | "3d">("profile");
  const [holes, setHoles] = useState<HoleSpec[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientId, setClientId] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [loadNote, setLoadNote] = useState<string | null>(null);

  // ---------- предзаполнение из query (интеграция КП → гибка / история) ----------
  useEffect(() => {
    const t = sp.get("thickness");
    const m = sp.get("material");
    const w = sp.get("width");
    const nb = sp.get("bends");
    const nm = sp.get("name");
    if (nm) setName(nm);
    if (m && (MATERIALS as Record<string, unknown>)[m]) setMaterial(m as MaterialKey);
    if (t) setThickness(Number(t) || 2);
    if (w) setWidth(Number(w) || 200);
    if (nb) {
      const count = Math.min(Math.max(Number(nb) || 0, 0), 12);
      if (count > 0) {
        setBends(Array.from({ length: count }, () => ({ angle: 90 as const, dir: 1 as const })));
        setFlanges(Array.from({ length: count + 1 }, () => 50));
      }
    }

    const loadId = sp.get("load");
    if (loadId) {
      fetch(`/api/calculations/${loadId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((row) => {
          if (!row) return;
          const payload = row.payload as {
            flanges?: number[];
            bends?: BendSpec[];
            holes?: HoleSpec[];
          };
          setName(row.name);
          setMaterial(row.material as MaterialKey);
          setThickness(row.thickness);
          setWidth(row.width);
          if (payload?.flanges?.length) setFlanges(payload.flanges);
          if (payload?.bends?.length) setBends(payload.bends);
          if (Array.isArray(payload?.holes)) setHoles(payload.holes);
          if (row.clientId) setClientId(row.clientId);
          setLoadNote(`Загружен расчёт №${row.id} — можно править и сохранить копию`);
        })
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((rows) => setClients(Array.isArray(rows) ? rows : []))
      .catch(() => undefined);
  }, []);

  const result = useMemo(
    () => computeBending({ material, thickness, width, flanges, bends }),
    [material, thickness, width, flanges, bends]
  );

  const mat = MATERIALS[material];

  function setBendCount(count: number) {
    const c = Math.min(Math.max(count, 1), 12);
    setBends((prev) =>
      Array.from({ length: c }, (_, i) => prev[i] ?? { angle: 90, dir: 1 })
    );
    setFlanges((prev) => Array.from({ length: c + 1 }, (_, i) => prev[i] ?? 50));
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    setFlanges([...p.flanges]);
    setBends(p.bends.map((b) => ({ ...b })));
  }

  function updateFlange(i: number, v: number) {
    setFlanges((prev) => prev.map((f, j) => (j === i ? Math.max(v, 0) : f)));
    setSaveState("idle");
  }

  function updateBend(i: number, patch: Partial<BendSpec>) {
    setBends((prev) => prev.map((b, j) => (j === i ? { ...b, ...patch } : b)));
    setSaveState("idle");
  }

  function removeBend(i: number) {
    if (bends.length <= 1) return;
    setBends((prev) => prev.filter((_, j) => j !== i));
    setFlanges((prev) => {
      const next = [...prev];
      next.splice(i, 2, (prev[i] ?? 0) + (prev[i + 1] ?? 0));
      return next;
    });
  }

  async function save() {
    setSaveState("saving");
    try {
      const res = await fetch("/api/calculations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          material,
          thickness,
          width,
          clientId,
          payload: { flanges, bends, holes },
          results: bendingResultsToJson(result),
        }),
      });
      if (!res.ok) throw new Error();
      setSaveState("saved");
    } catch {
      setSaveState("idle");
      alert("Не удалось сохранить расчёт");
    }
  }

  function downloadDxf() {
    const dxf = buildPartDxf({
      partName: name,
      flatLength: result.flatLength,
      width,
      thickness,
      materialLabel: mat.label,
      bendLines: result.bends.map((b) => ({
        x: Math.round(b.position * 100) / 100,
        angle: b.angle,
        dir: b.dir,
      })),
      holes,
    });
    const blob = new Blob([dxf], { type: "application/dxf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/[^\wа-яёА-ЯЁ-]+/gi, "_")}_развертка.dxf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const kpHref = `/kp?prefill=1&name=${encodeURIComponent(name)}&material=${material}&thickness=${thickness}&len=${Math.round(result.flatLength)}&wid=${Math.round(width)}&bends=${bends.length}`;

  const stats = [
    { label: "Длина развёртки", value: `${num(result.flatLength)} мм`, big: true },
    { label: "K-фактор", value: num(result.kFactor, 3) },
    { label: "Радиус внутр.", value: `${num(result.radius)} мм` },
    { label: "Матрица V", value: `${num(result.vDie, 0)} мм` },
    { label: "Мин. полка", value: `${num(result.minFlange)} мм` },
    { label: "Масса заготовки", value: `${num(result.weight, 2)} кг` },
    { label: "Усилие", value: `${num(result.tonnagePerM)} тс/м` },
    { label: "Усилие итого", value: `${num(result.tonnageTotal)} тс` },
  ];

  return (
    <div className="space-y-6">
      {/* заголовок */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="micro">Модуль · технологу</p>
          <h1 className="mt-2 font-display text-2xl font-600 sm:text-3xl">
            Гибка <span className="text-accent">/</span> развёртка
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-outline" onClick={downloadDxf}>
            <FileDown size={13} /> DXF · CUT+BEND
          </button>
          <Link href={kpHref} className="btn btn-outline">
            <ArrowUpRight size={13} /> В коммерческое
          </Link>
          <button
            className="btn btn-primary"
            onClick={save}
            disabled={saveState === "saving"}
          >
            {saveState === "saved" ? <Check size={13} /> : <Save size={13} />}
            {saveState === "saved" ? "Сохранено" : "Сохранить"}
          </button>
        </div>
      </div>

      {loadNote && (
        <div className="panel border-amber/40 px-4 py-3 text-xs text-amber">
          {loadNote}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[400px_1fr]">
        {/* ---------- входные данные ---------- */}
        <div className="space-y-4">
          <div className="panel panel-pad space-y-4">
            <div>
              <label className="micro mb-2 block">Название детали</label>
              <input
                className="field"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaveState("idle");
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="micro mb-2 block">Материал</label>
                <select
                  className="field"
                  value={material}
                  onChange={(e) => setMaterial(e.target.value as MaterialKey)}
                >
                  {Object.values(MATERIALS).map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="micro mb-2 block">Толщина, мм</label>
                <select
                  className="field"
                  value={thickness}
                  onChange={(e) => setThickness(Number(e.target.value))}
                >
                  {THICKNESSES.map((t) => (
                    <option key={t} value={t}>
                      {num(t)} мм
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="micro mb-2 block">
                Ширина по оси гибки, мм
              </label>
              <input
                type="number"
                className="field"
                value={width}
                min={1}
                onChange={(e) => setWidth(Math.max(Number(e.target.value) || 1, 1))}
              />
            </div>

            <div>
              <label className="micro mb-2 block">Пресеты</label>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    className="chip transition-colors hover:border-accent/60 hover:text-white"
                    onClick={() => applyPreset(p)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* гибы и полки */}
          <div className="panel panel-pad">
            <div className="flex items-center justify-between">
              <p className="micro">Гибы и полки</p>
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-ghost px-2! py-1!"
                  onClick={() => setBendCount(bends.length - 1)}
                  disabled={bends.length <= 1}
                  title="Убрать гиб"
                >
                  <RotateCcw size={12} />
                </button>
                <span className="num text-xs text-steel">{bends.length}</span>
                <button
                  className="btn btn-ghost px-2! py-1!"
                  onClick={() => setBendCount(bends.length + 1)}
                  disabled={bends.length >= 12}
                  title="Добавить гиб"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {flanges.map((f, i) => (
                <div key={`f${i}`}>
                  <div className="flex items-center gap-2">
                    <span className="micro w-14 shrink-0">Полка {i + 1}</span>
                    <input
                      type="number"
                      className="field py-1.5!"
                      value={f}
                      min={0}
                      onChange={(e) => updateFlange(i, Number(e.target.value) || 0)}
                    />
                    <span className="micro w-8">мм</span>
                  </div>
                  {i < bends.length && (
                    <div className="mt-2 flex items-center gap-2 border-l border-accent/40 pl-3">
                      <span className="micro w-14 shrink-0 text-amber">
                        Гиб {i + 1}
                      </span>
                      <input
                        type="number"
                        className="field py-1.5!"
                        value={bends[i].angle}
                        min={5}
                        max={175}
                        onChange={(e) =>
                          updateBend(i, {
                            angle: Math.min(Math.max(Number(e.target.value) || 90, 5), 175),
                          })
                        }
                      />
                      <button
                      className={clsx(
                        "btn btn-ghost shrink-0 px-2! py-1.5!",
                        bends[i].dir > 0 ? "text-accent" : "text-amber"
                      )}
                        title="Направление гиба"
                        onClick={() => updateBend(i, { dir: bends[i].dir > 0 ? -1 : 1 })}
                      >
                        {bends[i].dir > 0 ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                      </button>
                      <button
                        className="btn btn-ghost shrink-0 px-2! py-1.5! hover:text-bad!"
                        title="Удалить гиб"
                        onClick={() => removeBend(i)}
                        disabled={bends.length <= 1}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* отверстия на развёртке */}
          <div className="panel panel-pad">
            <div className="flex items-center justify-between">
              <p className="micro">Отверстия · слой HOLES</p>
              <button
                className="btn btn-ghost px-2! py-1!"
                onClick={() =>
                  setHoles((p) => [
                    ...p,
                    {
                      x: Math.round(result.flatLength / 2),
                      y: Math.round(width / 2),
                      d: 10,
                    },
                  ])
                }
                title="Добавить отверстие"
              >
                <Plus size={12} />
              </button>
            </div>
            {holes.length === 0 && (
              <p className="mt-3 text-[11px] text-steel">
                Координаты — от левого нижнего угла развёртки. Отображаются на
                виде «Развёртка» и выгружаются в DXF.
              </p>
            )}
            <div className="mt-3 space-y-2">
              {holes.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="micro w-5">X</span>
                  <input
                    type="number"
                    className="field py-1.5!"
                    value={h.x}
                    min={0}
                    max={Math.round(result.flatLength)}
                    onChange={(e) =>
                      setHoles((p) =>
                        p.map((o, j) =>
                          j === i ? { ...o, x: Number(e.target.value) || 0 } : o
                        )
                      )
                    }
                  />
                  <span className="micro w-5">Y</span>
                  <input
                    type="number"
                    className="field py-1.5!"
                    value={h.y}
                    min={0}
                    max={Math.round(width)}
                    onChange={(e) =>
                      setHoles((p) =>
                        p.map((o, j) =>
                          j === i ? { ...o, y: Number(e.target.value) || 0 } : o
                        )
                      )
                    }
                  />
                  <span className="micro w-5">Ø</span>
                  <input
                    type="number"
                    className="field py-1.5!"
                    value={h.d}
                    min={Math.max(thickness, 1)}
                    onChange={(e) =>
                      setHoles((p) =>
                        p.map((o, j) =>
                          j === i
                            ? { ...o, d: Math.max(Number(e.target.value) || 1, 0.5) }
                            : o
                        )
                      )
                    }
                  />
                  <button
                    className="btn btn-ghost shrink-0 px-2! py-1.5! hover:text-bad!"
                    onClick={() => setHoles((p) => p.filter((_, j) => j !== i))}
                    title="Удалить"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            {holes.some((h) => h.d < thickness) && (
              <p className="mt-3 flex items-start gap-2 text-[11px] text-warn">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                Диаметр меньше толщины — лазерная резка таких отверстий нестабильна
              </p>
            )}
          </div>

          {/* клиент для сохранения */}
          <div className="panel panel-pad">
            <label className="micro mb-2 block">Клиент (для истории)</label>
            <select
              className="field"
              value={clientId ?? ""}
              onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— без клиента —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ---------- результат ---------- */}
        <div className="space-y-4">
          <div className="panel corner relative h-[320px] overflow-hidden sm:h-[400px]">
            <div className="absolute left-4 top-4 z-10 flex gap-1">
              {(
                [
                  { key: "profile", label: "Вид сбоку" },
                  { key: "flat", label: "Развёртка" },
                  { key: "3d", label: "3D" },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setView(t.key)}
                  className={clsx(
                    "chip transition-colors",
                    view === t.key
                      ? "border-accent/70! text-accent!"
                      : "hover:text-white"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="absolute right-4 top-4 z-10 text-right">
              <p className="micro">{mat.short} · s={num(thickness)}</p>
              <p className="micro mt-1">пружинение: {result.springback}</p>
            </div>
            <div className="absolute inset-0 p-6 pt-14">
              {view === "3d" ? (
                <Part3D
                  flanges={flanges}
                  bends={bends}
                  width={width}
                  thickness={thickness}
                  radius={result.radius}
                  material={material}
                />
              ) : (
                <PartPreview
                  flanges={flanges}
                  bends={result.bends}
                  flatLength={result.flatLength}
                  width={width}
                  thickness={thickness}
                  view={view}
                  holes={holes}
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className={clsx("panel panel-pad", s.big && "col-span-2")}
              >
                <p className="micro">{s.label}</p>
                <p
                  className={clsx(
                    "num mt-2 text-white",
                    s.big ? "text-2xl text-accent sm:text-3xl" : "text-lg"
                  )}
                >
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          {result.warnings.length > 0 && (
            <div className="panel border-bad/50 p-4">
              {result.warnings.map((w, i) => (
                <p key={i} className="flex items-start gap-2 text-xs leading-relaxed text-bad">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  {w}
                </p>
              ))}
            </div>
          )}

          <div className="panel panel-pad overflow-x-auto">
            <p className="micro mb-3">Параметры гибов · BA / BD</p>
            <table className="tbl min-w-[520px]">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Угол</th>
                  <th>Напр.</th>
                  <th>BA, мм</th>
                  <th>BD, мм</th>
                  <th>Осевая, мм</th>
                  <th>Позиция, мм</th>
                </tr>
              </thead>
              <tbody>
                {result.bends.map((b, i) => (
                  <tr key={i}>
                    <td className="num">B{i + 1}</td>
                    <td className="num">{num(b.angle, 0)}°</td>
                    <td>{b.dir > 0 ? "↑" : "↓"}</td>
                    <td className="num">{num(b.ba, 2)}</td>
                    <td className="num">{num(b.bd, 2)}</td>
                    <td className="num">{num(b.ossb, 2)}</td>
                    <td className="num text-amber">{num(b.position, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] leading-relaxed text-steel">
              Развёртка = Σ прямых полок + Σ BA(θ). K = {num(result.kFactor, 3)} при R/T ={" "}
              {num(result.radius / thickness, 2)}. DXF содержит слои CUT, BEND
              (пунктир, с углом и направлением) и TEXT.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
