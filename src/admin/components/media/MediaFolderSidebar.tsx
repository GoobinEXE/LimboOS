import React, { useState } from 'react';
import { MediaFolder } from '../../../types/media';

export type FolderFilter = 'all' | 'unfiled' | string;

interface MediaFolderSidebarProps {
  folders: MediaFolder[];
  selected: FolderFilter;
  onSelect: (filter: FolderFilter) => void;
  counts: Record<string, number>;
  unfiledCount: number;
  totalCount: number;
  activeCampaignIds: Set<string>;
  selectionMode?: boolean;
  onCreate: (name: string) => Promise<void>;
  onRename: (folder: MediaFolder, name: string) => Promise<void>;
  onDelete: (folder: MediaFolder) => Promise<void>;
}

export default function MediaFolderSidebar({
  folders,
  selected,
  onSelect,
  counts,
  unfiledCount,
  totalCount,
  activeCampaignIds,
  selectionMode = false,
  onCreate,
  onRename,
  onDelete,
}: MediaFolderSidebarProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [busy, setBusy] = useState(false);

  const campaignFolders = folders.filter(
    (f) => f.campaignId && activeCampaignIds.has(f.campaignId),
  );
  const extraFolders = folders.filter(
    (f) => !f.campaignId || !activeCampaignIds.has(f.campaignId),
  );

  const submitCreate = async () => {
    if (!newName.trim() || busy) return;
    setBusy(true);
    try {
      await onCreate(newName.trim());
      setNewName('');
      setCreating(false);
    } finally {
      setBusy(false);
    }
  };

  const submitRename = async (folder: MediaFolder) => {
    if (!renameValue.trim() || busy) return;
    setBusy(true);
    try {
      await onRename(folder, renameValue.trim());
      setRenamingId(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="w-full md:w-56 shrink-0 border border-primary/10 bg-black/20 flex flex-col max-h-[70vh] md:max-h-none">
      <div className="px-3 py-2.5 border-b border-primary/10 flex items-center justify-between gap-2">
        <p className="text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.25em]">
          Pastas
        </p>
        {!selectionMode && (
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="p-1 text-industrial-silver/40 hover:text-primary transition-colors"
            title="Nova pasta extra"
          >
            <span className="material-symbols-outlined text-base">create_new_folder</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar py-1">
        <FolderRow
          icon="grid_view"
          label="Todos"
          count={totalCount}
          active={selected === 'all'}
          onClick={() => onSelect('all')}
        />
        <FolderRow
          icon="folder_off"
          label="Sem pasta"
          count={unfiledCount}
          active={selected === 'unfiled'}
          onClick={() => onSelect('unfiled')}
        />

        {campaignFolders.length > 0 && (
          <p className="px-3 pt-3 pb-1 text-[8px] font-display font-bold text-industrial-silver/25 uppercase tracking-[0.3em]">
            Campanhas
          </p>
        )}
        {campaignFolders.map((folder) => (
          <FolderRow
            key={folder.id}
            icon="flag"
            label={folder.name}
            count={counts[folder.id] || 0}
            active={selected === folder.id}
            onClick={() => onSelect(folder.id)}
          />
        ))}

        {(extraFolders.length > 0 || creating) && (
          <p className="px-3 pt-3 pb-1 text-[8px] font-display font-bold text-industrial-silver/25 uppercase tracking-[0.3em]">
            Extras
          </p>
        )}

        {creating && (
          <div className="px-2 py-1.5 flex gap-1">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitCreate();
                if (e.key === 'Escape') setCreating(false);
              }}
              placeholder="NOME_PASTA"
              className="flex-1 min-w-0 bg-surface-container-lowest border border-primary/20 text-[9px] font-display font-bold uppercase tracking-widest text-white px-2 py-1.5 outline-none focus:border-primary/50"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void submitCreate()}
              className="px-2 bg-primary/20 text-primary hover:bg-primary hover:text-black text-[9px] font-display font-bold"
            >
              OK
            </button>
          </div>
        )}

        {extraFolders.map((folder) => (
          <div key={folder.id} className="group relative">
            {renamingId === folder.id ? (
              <div className="px-2 py-1.5 flex gap-1">
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void submitRename(folder);
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  className="flex-1 min-w-0 bg-surface-container-lowest border border-primary/20 text-[9px] font-display font-bold uppercase tracking-widest text-white px-2 py-1.5 outline-none focus:border-primary/50"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submitRename(folder)}
                  className="px-2 bg-primary/20 text-primary hover:bg-primary hover:text-black text-[9px] font-display font-bold"
                >
                  OK
                </button>
              </div>
            ) : (
              <FolderRow
                icon="folder"
                label={folder.name}
                count={counts[folder.id] || 0}
                active={selected === folder.id}
                onClick={() => onSelect(folder.id)}
                actions={
                  !selectionMode && !folder.campaignId ? (
                    <>
                      <button
                        type="button"
                        title="Renomear"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingId(folder.id);
                          setRenameValue(folder.name);
                        }}
                        className="p-0.5 text-industrial-silver/30 hover:text-primary"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button
                        type="button"
                        title="Apagar"
                        onClick={(e) => {
                          e.stopPropagation();
                          void onDelete(folder);
                        }}
                        className="p-0.5 text-industrial-silver/30 hover:text-red-400"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </>
                  ) : undefined
                }
              />
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}

function FolderRow({
  icon,
  label,
  count,
  active,
  onClick,
  actions,
}: {
  icon: string;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
        active
          ? 'bg-primary/10 text-primary border-l-2 border-l-primary'
          : 'text-industrial-silver/50 hover:bg-primary/5 hover:text-primary border-l-2 border-l-transparent'
      }`}
    >
      <span className="material-symbols-outlined text-base shrink-0">{icon}</span>
      <span className="flex-1 min-w-0 text-[9px] font-display font-bold uppercase tracking-widest truncate">
        {label}
      </span>
      <span className="text-[8px] font-display font-bold text-industrial-silver/30 tabular-nums">
        {count}
      </span>
      {actions && (
        <span
          className="hidden group-hover:flex items-center gap-0.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </span>
      )}
    </button>
  );
}
