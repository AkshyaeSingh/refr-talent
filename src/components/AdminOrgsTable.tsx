"use client";

import { useState } from "react";

export type AdminOrg = {
  id: string;
  name: string;
  website: string | null;
  orgType: string | null;
  hidden: boolean;
  createdAt: string;
  _count: { candidates: number; users: number; savedSearches: number; connectors: number };
  users: { email: string; name: string }[];
};

const ORG_TYPES = [
  { value: "", label: "—" },
  { value: "fellowship", label: "fellowship" },
  { value: "hiring", label: "hiring" },
  { value: "both", label: "both" },
];

function fmt(d: string) {
  return new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminOrgsTable({ initialOrgs }: { initialOrgs: AdminOrg[] }) {
  const [orgs, setOrgs] = useState(initialOrgs);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/admin/orgs");
    if (res.ok) setOrgs((await res.json()).orgs ?? []);
  }

  async function remove(org: AdminOrg) {
    const typed = window.prompt(
      `Type the org name "${org.name}" to permanently delete it and everything in it — candidates, ` +
        `connections, connectors, saved searches. This cannot be undone.`
    );
    if (typed !== org.name) return;
    setBusyId(org.id);
    setError(null);
    const res = await fetch(`/api/admin/orgs/${org.id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return setError(d.error ?? "Couldn't delete that org.");
    }
    setOrgs((prev) => prev.filter((o) => o.id !== org.id));
  }

  return (
    <div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-neutral-400">
            <tr>
              <th className="py-2 pr-4">Org</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Admin</th>
              <th className="py-2 pr-4 text-right">Pool</th>
              <th className="py-2 pr-4 text-right">Searches</th>
              <th className="py-2 pr-4 text-right">Sources</th>
              <th className="py-2 pr-4">Joined</th>
              <th className="py-2 pr-4" />
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <OrgRow
                key={o.id}
                org={o}
                editing={editingId === o.id}
                busy={busyId === o.id}
                onToggleEdit={() => setEditingId(editingId === o.id ? null : o.id)}
                onDelete={() => remove(o)}
                onSaved={(updated) => {
                  setOrgs((prev) => prev.map((x) => (x.id === o.id ? { ...x, ...updated } : x)));
                  setEditingId(null);
                  refresh();
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrgRow({
  org,
  editing,
  busy,
  onToggleEdit,
  onDelete,
  onSaved,
}: {
  org: AdminOrg;
  editing: boolean;
  busy: boolean;
  onToggleEdit: () => void;
  onDelete: () => void;
  onSaved: (updated: Partial<AdminOrg>) => void;
}) {
  return (
    <>
      <tr className="border-t border-neutral-100">
        <td className="py-2 pr-4 font-medium">
          {org.name}
          {org.website && (
            <a href={org.website} target="_blank" rel="noreferrer" className="ml-1.5 text-xs text-purple-600 underline">
              site
            </a>
          )}
          {org.hidden && (
            <span className="ml-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
              Hidden
            </span>
          )}
        </td>
        <td className="py-2 pr-4 text-neutral-500">{org.orgType ?? "—"}</td>
        <td className="py-2 pr-4 text-neutral-500">{org.users[0]?.email ?? "—"}</td>
        <td className="py-2 pr-4 text-right">{org._count.candidates}</td>
        <td className="py-2 pr-4 text-right">{org._count.savedSearches}</td>
        <td className="py-2 pr-4 text-right">{org._count.connectors}</td>
        <td className="py-2 pr-4 text-neutral-500">{fmt(org.createdAt)}</td>
        <td className="py-2 pr-4">
          <div className="flex justify-end gap-2">
            <button className="btn-ghost text-xs" onClick={onToggleEdit}>{editing ? "Cancel" : "Edit"}</button>
            <button className="btn-ghost text-xs text-red-600" disabled={busy} onClick={onDelete}>
              {busy ? "Deleting…" : "Delete"}
            </button>
          </div>
        </td>
      </tr>
      {editing && (
        <tr className="border-t border-neutral-100 bg-neutral-50">
          <td colSpan={8} className="px-2 py-3">
            <EditForm org={org} onSaved={onSaved} />
          </td>
        </tr>
      )}
    </>
  );
}

function EditForm({ org, onSaved }: { org: AdminOrg; onSaved: (updated: Partial<AdminOrg>) => void }) {
  const [name, setName] = useState(org.name);
  const [website, setWebsite] = useState(org.website ?? "");
  const [orgType, setOrgType] = useState(org.orgType ?? "");
  const [hidden, setHidden] = useState(org.hidden);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/orgs/${org.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim() || undefined,
        website: website.trim() || null,
        orgType: orgType || null,
        hidden,
      }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return setError(d.error ?? "Couldn't save.");
    onSaved({ name: d.org.name, website: d.org.website, orgType: d.org.orgType, hidden: d.org.hidden });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
        Name
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
        Website
        <input className="input" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
        Type
        <select className="input" value={orgType} onChange={(e) => setOrgType(e.target.value)}>
          {ORG_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5 pb-2 text-xs font-medium text-neutral-600">
        <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
        Hidden from network
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button className="btn-primary text-xs" disabled={busy} onClick={save}>
        {busy ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
