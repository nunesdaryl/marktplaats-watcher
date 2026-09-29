import { useMemo, useState } from "react";
import Icon from "../../components/Icon.jsx";

/** Download the rows as CSV (Excel/Numbers friendly: UTF-8 with BOM). */
function downloadCsv(name, columns, rows) {
  const cell = (v) => {
    const s = v === undefined || v === null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => cell(c.label)).join(","),
    ...rows.map((r) => columns.map((c) => cell(c.csv ? c.csv(r) : c.sort ? c.sort(r) : r[c.key])).join(","))];
  const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `${name}.csv` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * A searchable, sortable list for the owner dashboard. Rows open the next level on click (or Enter).
 * columns: [{ key, label, render?(row), sort?(row), csv?(row), mono?, align? }]
 */
export default function Table({ name, columns, rows, onOpen, searchKeys = [], empty = "Nothing here yet.", initialSort, chips }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState(initialSort ?? null);   // { key, dir: 1 | -1 }
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows ?? [];
    if (needle) out = out.filter((r) => searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(needle)));
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      const val = (r) => (col?.sort ? col.sort(r) : r[sort.key]) ?? "";
      out = [...out].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
    }
    return out;
  }, [rows, q, sort, columns, searchKeys]);

  if (rows === undefined) return <p className="hint" role="status">Loading…</p>;
  return (
    <div className="dt">
      <div className="dt-tools">
        {searchKeys.length > 0 && (
          <label className="dt-search">
            <Icon name="search" size={15} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label={`Search ${name}`} />
          </label>
        )}
        {chips}
        <span className="dt-count">{shown.length}{shown.length !== rows.length ? ` of ${rows.length}` : ""}</span>
        <button className="button small-button" onClick={() => downloadCsv(name, columns, shown)} disabled={!shown.length}
                title="Download these rows as CSV">CSV</button>
      </div>
      {shown.length === 0 ? <p className="hint dt-empty">{q ? `Nothing matches "${q}".` : empty}</p> : (
        <div className="dt-scroll">
          <table>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={c.align === "right" ? "right" : ""}
                      aria-sort={sort?.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
                    <button onClick={() => setSort(sort?.key === c.key ? { key: c.key, dir: -sort.dir } : { key: c.key, dir: -1 })}>
                      {c.label}{sort?.key === c.key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
                    </button>
                  </th>
                ))}
                {onOpen && <th aria-label="Open" />}
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={r._id ?? i} className={onOpen ? "openable" : ""} tabIndex={onOpen ? 0 : undefined}
                    onClick={onOpen ? () => onOpen(r) : undefined}
                    onKeyDown={onOpen ? (e) => { if (e.key === "Enter") onOpen(r); } : undefined}>
                  {columns.map((c) => (
                    <td key={c.key} className={`${c.mono ? "mono-cell" : ""} ${c.align === "right" ? "right" : ""}`}>
                      {c.render ? c.render(r) : r[c.key] ?? "–"}
                    </td>
                  ))}
                  {onOpen && <td className="chev"><Icon name="chevron" size={14} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
