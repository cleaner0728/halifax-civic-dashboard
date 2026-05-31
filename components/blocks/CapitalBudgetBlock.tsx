"use client";

import { useState } from 'react';
import { CATEGORIES, TOTAL_4YR, TOTAL_2627, PDF_URL, type CategoryDetail } from '@/lib/capital-budget-data';

function fmtM(thousands: number) {
  const m = thousands / 1000;
  return m >= 100 ? `$${Math.round(m)}M` : `$${m.toFixed(1)}M`;
}

function fmtK(thousands: number) {
  if (thousands >= 1000) {
    const m = thousands / 1000;
    return m % 1 === 0 ? `$${m}M` : `$${m.toFixed(1)}M`;
  }
  return `$${thousands.toLocaleString()}k`;
}

// ── Project drill-down panel ─────────────────────────────────────────────────
function DetailPanel({ cat }: { cat: CategoryDetail }) {
  if (cat.detailPending) {
    return (
      <div className="px-4 py-5 text-center">
        <p className="text-sm text-foreground/40">Project detail coming soon.</p>
        <a
          href={PDF_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          View full budget PDF ↗
        </a>
      </div>
    );
  }

  // Flatten all projects from sections + flat projects list
  const sections = cat.sections ?? (cat.projects ? [{ title: '', projects: cat.projects }] : []);
  const allProjects = sections.flatMap(s => s.projects);
  const catTotal = allProjects.reduce((s, p) => s + p.amount, 0);
  const maxAmt = Math.max(...allProjects.map(p => p.amount));

  return (
    <div>
      {sections.map((section, si) => (
        <div key={si}>
          {section.title && (
            <div className="px-4 pt-3 pb-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground/35">
                {section.title}
              </p>
            </div>
          )}
          <ul>
            {section.projects
              .slice()
              .sort((a, b) => b.amount - a.amount)
              .map(project => {
                const pct = (project.amount / maxAmt) * 100;
                return (
                  <li key={project.id} className="px-4 py-2 hover:bg-foreground/3 transition-colors">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground leading-snug truncate">
                          {project.name}
                        </p>
                        {project.note && (
                          <p className="text-[10px] text-foreground/40 leading-snug">{project.note}</p>
                        )}
                      </div>
                      <span className={`text-xs font-semibold shrink-0 tabular-nums ${cat.textColor}`}>
                        {fmtK(project.amount)}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-foreground/8 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${cat.color} opacity-60`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
          </ul>
          {si < sections.length - 1 && <div className="mx-4 border-t border-border my-1" />}
        </div>
      ))}

      {/* Panel footer */}
      <div className="flex items-center justify-between px-4 py-3 mt-1 border-t border-border bg-foreground/2">
        <p className="text-[11px] text-foreground/40">
          Project amounts = 2026/27 spend · 4-yr category total: {fmtM(cat.total)}
        </p>
        <a
          href={PDF_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline shrink-0"
        >
          Full PDF ↗
        </a>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CapitalBudgetBlock() {
  const [selected, setSelected] = useState<string | null>(null);

  const toggle = (key: string) =>
    setSelected(prev => (prev === key ? null : key));

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">

      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/40">
              2026/27–2029/30 Capital Plan · HRM
            </p>
            <p className="text-2xl font-bold text-foreground mt-0.5">
              {fmtM(TOTAL_4YR)}
            </p>
            <p className="text-xs text-foreground/50 mt-0.5">
              4-year plan · 226 active projects ·{' '}
              <span className="text-foreground/35">{fmtM(TOTAL_2627)} in 2026/27 alone</span>
            </p>
          </div>
          <a
            href={PDF_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mt-1"
          >
            Full PDF ↗
          </a>
        </div>

        {/* Stacked proportional bar — widths based on 4-year totals */}
        <div className="mt-3 flex h-2.5 rounded-full overflow-hidden gap-px">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => toggle(cat.key)}
              title={`${cat.label}: ${fmtM(cat.total)} over 4 years`}
              className={`${cat.color} transition-opacity hover:opacity-80 focus-visible:outline-none ${
                selected && selected !== cat.key ? 'opacity-30' : 'opacity-100'
              }`}
              style={{ width: `${(cat.total / TOTAL_4YR) * 100}%` }}
            />
          ))}
        </div>
        {/* Legend chips */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => toggle(cat.key)}
              className={`flex items-center gap-1 text-[10px] font-medium transition-opacity ${
                selected && selected !== cat.key ? 'opacity-30' : 'opacity-100'
              } ${cat.textColor}`}
            >
              <span className={`inline-block w-2 h-2 rounded-sm ${cat.color}`} />
              {cat.label.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Category rows ── */}
      <ul className="divide-y divide-border">
        {CATEGORIES.map(cat => {
          const pct = (cat.total / TOTAL_4YR) * 100;
          const isSelected = selected === cat.key;
          return (
            <li key={cat.key}>
              {/* Row button */}
              <button
                onClick={() => toggle(cat.key)}
                className={`w-full text-left px-4 py-2.5 transition-colors ${
                  isSelected ? cat.bgSelected : 'hover:bg-foreground/3'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`inline-block w-2.5 h-2.5 rounded-sm shrink-0 ${cat.color}`} />
                    <span className="text-sm font-medium text-foreground truncate">
                      {cat.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className={`text-sm font-semibold ${cat.textColor}`}>
                        {fmtM(cat.total)}
                      </div>
                      <div className="text-[10px] text-foreground/35 leading-none">
                        {fmtM(cat.total1)} this yr
                      </div>
                    </div>
                    <svg
                      className={`w-3.5 h-3.5 text-foreground/30 transition-transform duration-200 ${
                        isSelected ? 'rotate-180' : ''
                      }`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {/* Per-row proportion bar */}
                <div className="h-1.5 rounded-full bg-foreground/8 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${cat.color} ${isSelected ? 'opacity-80' : 'opacity-50'} transition-opacity`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>

              {/* Expandable detail panel */}
              {isSelected && (
                <div className="border-t border-border bg-card animate-in slide-in-from-top-1 duration-150">
                  <DetailPanel cat={cat} />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* ── Footer ── */}
      <div className="px-4 py-2.5 border-t border-border">
        <p className="text-[11px] text-foreground/35 leading-snug">
          Base Capital Plan $1.44B + Strategic Initiatives $739M = $2.18B (4-year total).
          2026/27 year-one spend: {fmtM(TOTAL_2627)}. Figures from HRM draft budget book.
        </p>
      </div>
    </div>
  );
}
