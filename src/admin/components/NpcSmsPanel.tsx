import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NpcContact, NpcDialogue, NpcSmsTurn } from '../../types/npcSms';
import { useNpcSmsCatalog } from '../../hooks/useNpcSmsCatalog';
import { npcSmsCatalogService } from '../../services/NpcSmsCatalogService';
import { useToast } from './ToastProvider';
import { useModal } from './ConfirmModal';

type TabId = 'contacts' | 'dialogues';

const fieldClass =
  'w-full bg-black/50 border border-white/10 text-[11px] font-bold uppercase px-3 py-2.5 text-white outline-none focus:border-secondary rounded-sm';
const labelClass = 'text-[9px] font-black uppercase tracking-widest text-ash-500 mb-1.5 block';

function emptyContact(): NpcContact {
  return {
    id: '',
    name: '',
    number: '',
    campaignIds: 'global',
    enabled: true,
    source: 'custom',
  };
}

function emptyDialogue(npcId = ''): NpcDialogue {
  return {
    id: '',
    npcId,
    title: '',
    messages: [{ speaker: 'npc', text: '' }],
    enabled: true,
    source: 'custom',
  };
}

export default function NpcSmsPanel({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const { showConfirm, showAlert, modal } = useModal();
  const { contacts, dialogues, isRemote, hasRemoteContacts, hasRemoteDialogues, getContact } =
    useNpcSmsCatalog();

  const [tab, setTab] = useState<TabId>('contacts');
  const [search, setSearch] = useState('');
  const [npcFilter, setNpcFilter] = useState<string>('all');
  const [importing, setImporting] = useState(false);

  const [contactEditor, setContactEditor] = useState<NpcContact | null>(null);
  const [dialogueEditor, setDialogueEditor] = useState<NpcDialogue | null>(null);
  const [isEdit, setIsEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const filteredContacts = useMemo(() => {
    const q = search.toLowerCase();
    return contacts.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.number.toLowerCase().includes(q),
    );
  }, [contacts, search]);

  const filteredDialogues = useMemo(() => {
    const q = search.toLowerCase();
    return dialogues.filter((d) => {
      const matchesNpc = npcFilter === 'all' || d.npcId === npcFilter;
      const matchesSearch =
        !q ||
        d.title.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        d.npcId.toLowerCase().includes(q);
      return matchesNpc && matchesSearch;
    });
  }, [dialogues, search, npcFilter]);

  const requireRemoteContacts = async () => {
    if (hasRemoteContacts) return true;
    await showAlert(t('npcSms.needImportTitle'), t('npcSms.needImportBody'));
    return false;
  };

  const requireRemoteDialogues = async () => {
    if (hasRemoteDialogues) return true;
    await showAlert(t('npcSms.needImportTitle'), t('npcSms.needImportBody'));
    return false;
  };

  const handleImport = async () => {
    const ok = await showConfirm(
      t('npcSms.importTitle'),
      t('npcSms.importBody'),
      t('npcSms.importAction'),
    );
    if (!ok) return;
    setImporting(true);
    try {
      const r = await npcSmsCatalogService.importSuggestions();
      toast.success(
        t('npcSms.importOk', {
          contacts: r.contactsImported,
          dialogues: r.dialoguesImported,
          skipped: r.contactsSkipped + r.dialoguesSkipped,
        }),
      );
    } catch (err) {
      console.error(err);
      toast.error(t('npcSms.importFail'));
    } finally {
      setImporting(false);
    }
  };

  const openCreateContact = () => {
    setIsEdit(false);
    setContactEditor(emptyContact());
    setAvatarFile(null);
  };

  const openEditContact = (c: NpcContact) => {
    setIsEdit(true);
    setContactEditor({ ...c });
    setAvatarFile(null);
  };

  const openCreateDialogue = () => {
    const defaultNpc = contacts[0]?.id || '';
    setIsEdit(false);
    setDialogueEditor(emptyDialogue(defaultNpc));
  };

  const openEditDialogue = (d: NpcDialogue) => {
    setIsEdit(true);
    setDialogueEditor({
      ...d,
      messages: d.messages.map((m) => ({ ...m })),
    });
  };

  const saveContact = async () => {
    if (!contactEditor) return;
    const id = contactEditor.id.trim().toUpperCase().replace(/\s+/g, '_');
    if (!id || !contactEditor.name.trim()) {
      toast.error(t('npcSms.validationContact'));
      return;
    }
    setSaving(true);
    setUploadProgress(avatarFile ? 0 : null);
    try {
      let avatarUrl = contactEditor.avatarUrl;
      if (avatarFile) {
        avatarUrl = await npcSmsCatalogService.uploadAvatar(id, avatarFile, (p) =>
          setUploadProgress(p),
        );
      }
      const payload = {
        ...contactEditor,
        id,
        name: contactEditor.name.trim(),
        number: contactEditor.number.trim(),
        avatarUrl,
        source: isEdit ? contactEditor.source : ('custom' as const),
      };
      if (isEdit) {
        const { id: _id, source: _s, ...patch } = payload;
        await npcSmsCatalogService.updateContact(id, patch);
      } else {
        await npcSmsCatalogService.createContact(payload);
      }
      toast.success(t('npcSms.saveOk'));
      setContactEditor(null);
    } catch (err) {
      console.error(err);
      toast.error(t('npcSms.saveFail'));
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  };

  const saveDialogue = async () => {
    if (!dialogueEditor) return;
    const id = dialogueEditor.id.trim().toLowerCase().replace(/\s+/g, '_');
    if (!id || !dialogueEditor.title.trim() || !dialogueEditor.npcId) {
      toast.error(t('npcSms.validationDialogue'));
      return;
    }
    const messages = dialogueEditor.messages.filter((m) => m.text.trim());
    if (messages.length === 0) {
      toast.error(t('npcSms.validationTurns'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...dialogueEditor,
        id,
        title: dialogueEditor.title.trim(),
        messages,
        source: isEdit ? dialogueEditor.source : ('custom' as const),
      };
      if (isEdit) {
        const { id: _id, source: _s, ...patch } = payload;
        await npcSmsCatalogService.updateDialogue(id, patch);
      } else {
        await npcSmsCatalogService.createDialogue(payload);
      }
      toast.success(t('npcSms.saveOk'));
      setDialogueEditor(null);
    } catch (err) {
      console.error(err);
      toast.error(t('npcSms.saveFail'));
    } finally {
      setSaving(false);
    }
  };

  const toggleContact = async (c: NpcContact) => {
    if (!(await requireRemoteContacts())) return;
    try {
      await npcSmsCatalogService.updateContact(c.id, { enabled: !c.enabled });
      toast.success(c.enabled ? t('npcSms.disabledOk') : t('npcSms.enabledOk'));
    } catch {
      toast.error(t('npcSms.saveFail'));
    }
  };

  const toggleDialogue = async (d: NpcDialogue) => {
    if (!(await requireRemoteDialogues())) return;
    try {
      await npcSmsCatalogService.updateDialogue(d.id, { enabled: !d.enabled });
      toast.success(d.enabled ? t('npcSms.disabledOk') : t('npcSms.enabledOk'));
    } catch {
      toast.error(t('npcSms.saveFail'));
    }
  };

  const deleteContact = async (c: NpcContact) => {
    if (!(await requireRemoteContacts())) return;
    const ok = await showConfirm(
      t('npcSms.deleteContactTitle'),
      t('npcSms.deleteContactBody', { name: c.name }),
      t('npcSms.deleteAction'),
    );
    if (!ok) return;
    try {
      await npcSmsCatalogService.removeContact(c.id);
      toast.success(t('npcSms.deleteOk'));
    } catch {
      toast.error(t('npcSms.deleteFail'));
    }
  };

  const deleteDialogue = async (d: NpcDialogue) => {
    if (!(await requireRemoteDialogues())) return;
    const ok = await showConfirm(
      t('npcSms.deleteDialogueTitle'),
      t('npcSms.deleteDialogueBody', { title: d.title }),
      t('npcSms.deleteAction'),
    );
    if (!ok) return;
    try {
      await npcSmsCatalogService.removeDialogue(d.id);
      toast.success(t('npcSms.deleteOk'));
    } catch {
      toast.error(t('npcSms.deleteFail'));
    }
  };

  const updateTurn = (index: number, patch: Partial<NpcSmsTurn>) => {
    setDialogueEditor((d) => {
      if (!d) return d;
      const messages = d.messages.map((m, i) => (i === index ? { ...m, ...patch } : m));
      return { ...d, messages };
    });
  };

  const addTurn = () => {
    setDialogueEditor((d) => {
      if (!d) return d;
      const last = d.messages[d.messages.length - 1];
      const nextSpeaker = last?.speaker === 'npc' ? 'player' : 'npc';
      return { ...d, messages: [...d.messages, { speaker: nextSpeaker, text: '' }] };
    });
  };

  const removeTurn = (index: number) => {
    setDialogueEditor((d) => {
      if (!d || d.messages.length <= 1) return d;
      return { ...d, messages: d.messages.filter((_, i) => i !== index) };
    });
  };

  const moveTurn = (index: number, dir: -1 | 1) => {
    setDialogueEditor((d) => {
      if (!d) return d;
      const j = index + dir;
      if (j < 0 || j >= d.messages.length) return d;
      const messages = [...d.messages];
      [messages[index], messages[j]] = [messages[j], messages[index]];
      return { ...d, messages };
    });
  };

  return (
    <section className="space-y-8 font-chakra">
      {modal}
      {!embedded && (
        <div className="flex items-center gap-4">
          <div className="w-2 h-8 bg-secondary rounded-full animate-pulse shadow-[0_0_10px_rgba(198,198,198,0.4)]" />
          <h2 className="font-black uppercase tracking-widest text-lg text-white">{t('npcSms.title')}</h2>
        </div>
      )}

      <div className="bg-surface-container-low border border-primary/10 rounded-sm flex flex-col h-[580px] shadow-2xl overflow-hidden relative">
        <div className="p-6 border-b border-primary/10 bg-black/40 flex flex-col gap-4 relative z-10">
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <div className="flex gap-2">
              {(['contacts', 'dialogues'] as TabId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`text-[9px] font-black uppercase tracking-widest px-4 py-2 border rounded-sm ${
                    tab === id
                      ? 'border-secondary text-secondary bg-secondary/10'
                      : 'border-white/10 text-ash-500'
                  }`}
                >
                  {id === 'contacts' ? t('npcSms.tabContacts') : t('npcSms.tabDialogues')}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black text-ash-600 uppercase tracking-widest">
                {tab === 'contacts' ? filteredContacts.length : filteredDialogues.length}{' '}
                {tab === 'contacts' ? t('npcSms.countContacts') : t('npcSms.countDialogues')}
                {!isRemote && (
                  <span className="ml-2 text-amber-500/80">· {t('npcSms.localHint')}</span>
                )}
              </span>
              <button
                type="button"
                disabled={importing}
                onClick={handleImport}
                className="text-[9px] font-black uppercase tracking-widest px-3 py-2 border border-secondary/40 text-secondary hover:bg-secondary/10 rounded-sm disabled:opacity-40"
              >
                {importing ? '…' : t('npcSms.import')}
              </button>
              <button
                type="button"
                onClick={tab === 'contacts' ? openCreateContact : openCreateDialogue}
                className="text-[9px] font-black uppercase tracking-widest px-3 py-2 bg-primary text-black rounded-sm"
              >
                {tab === 'contacts' ? t('npcSms.createContact') : t('npcSms.createDialogue')}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-ash-700 text-sm">
                search
              </span>
              <input
                type="text"
                placeholder={t('npcSms.filter')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-black/40 border-2 border-white/5 text-[11px] font-black uppercase px-12 py-3 text-white outline-none focus:border-secondary rounded-sm"
              />
            </div>
            {tab === 'dialogues' && (
              <select
                className={`${fieldClass} max-w-[200px]`}
                value={npcFilter}
                onChange={(e) => setNpcFilter(e.target.value)}
              >
                <option value="all">{t('npcSms.allNpcs')}</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-black/20 custom-scrollbar relative z-10 space-y-3">
          {tab === 'contacts' &&
            filteredContacts.map((c) => (
              <div
                key={c.id}
                className={`bg-black border-2 p-4 rounded-xl flex items-center gap-4 ${
                  c.enabled === false ? 'border-white/5 opacity-50' : 'border-seam'
                }`}
              >
                <div className="w-12 h-12 rounded-lg border border-secondary/20 overflow-hidden bg-black shrink-0 flex items-center justify-center">
                  {c.avatarUrl ? (
                    <img src={c.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-ash-600">person</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-black text-white uppercase tracking-wider">{c.name}</h4>
                    <span className="text-[8px] font-mono text-ash-600">{c.id}</span>
                    {c.source === 'suggestion' && (
                      <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 border rounded-sm text-amber-400/80 border-amber-400/30">
                        {t('npcSms.badgeSuggestion')}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-ash-400 font-mono mt-1">{c.number}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={!hasRemoteContacts}
                    onClick={() => openEditContact(c)}
                    className="text-[8px] font-black uppercase tracking-widest px-3 py-2 border border-white/10 text-ash-400 hover:text-white rounded-sm disabled:opacity-30"
                  >
                    {t('npcSms.edit')}
                  </button>
                  <button
                    type="button"
                    disabled={!hasRemoteContacts}
                    onClick={() => toggleContact(c)}
                    className="text-[8px] font-black uppercase tracking-widest px-3 py-2 border border-white/10 text-ash-400 rounded-sm disabled:opacity-30"
                  >
                    {c.enabled === false ? t('npcSms.enable') : t('npcSms.disable')}
                  </button>
                  <button
                    type="button"
                    disabled={!hasRemoteContacts}
                    onClick={() => deleteContact(c)}
                    className="text-[8px] font-black uppercase tracking-widest px-3 py-2 border border-red-900/40 text-red-400/70 rounded-sm disabled:opacity-30"
                  >
                    {t('npcSms.delete')}
                  </button>
                </div>
              </div>
            ))}

          {tab === 'dialogues' &&
            filteredDialogues.map((d) => {
              const contact = getContact(d.npcId);
              return (
                <div
                  key={d.id}
                  className={`bg-black border-2 p-4 rounded-xl ${
                    d.enabled === false ? 'border-white/5 opacity-50' : 'border-seam'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="text-sm font-black text-white uppercase tracking-wider">
                          {d.title}
                        </h4>
                        <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 border rounded-sm text-primary border-primary/30">
                          {contact?.name || d.npcId}
                        </span>
                        <span className="text-[8px] font-mono text-ash-600">{d.messages.length} SMS</span>
                      </div>
                      <p className="text-[9px] text-ash-500 line-clamp-2 italic">
                        &ldquo;{d.messages[0]?.text || ''}&rdquo;
                      </p>
                      <p className="text-[8px] font-mono text-ash-700 mt-1">{d.id}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={!hasRemoteDialogues}
                        onClick={() => openEditDialogue(d)}
                        className="text-[8px] font-black uppercase tracking-widest px-3 py-2 border border-white/10 text-ash-400 hover:text-white rounded-sm disabled:opacity-30"
                      >
                        {t('npcSms.edit')}
                      </button>
                      <button
                        type="button"
                        disabled={!hasRemoteDialogues}
                        onClick={() => toggleDialogue(d)}
                        className="text-[8px] font-black uppercase tracking-widest px-3 py-2 border border-white/10 text-ash-400 rounded-sm disabled:opacity-30"
                      >
                        {d.enabled === false ? t('npcSms.enable') : t('npcSms.disable')}
                      </button>
                      <button
                        type="button"
                        disabled={!hasRemoteDialogues}
                        onClick={() => deleteDialogue(d)}
                        className="text-[8px] font-black uppercase tracking-widest px-3 py-2 border border-red-900/40 text-red-400/70 rounded-sm disabled:opacity-30"
                      >
                        {t('npcSms.delete')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

          {((tab === 'contacts' && filteredContacts.length === 0) ||
            (tab === 'dialogues' && filteredDialogues.length === 0)) && (
            <div className="p-20 text-center opacity-20 flex flex-col items-center">
              <span className="material-symbols-outlined text-6xl mb-4">sms</span>
              <p className="text-[10px] font-black uppercase tracking-[0.4em]">{t('npcSms.empty')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Contact editor */}
      {contactEditor && (
        <div
          className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setContactEditor(null);
          }}
        >
          <div className="bg-seam border-2 border-white/10 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-black/40">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">
                {isEdit ? t('npcSms.editContact') : t('npcSms.createContact')}
              </h3>
              <button type="button" onClick={() => !saving && setContactEditor(null)} className="material-symbols-outlined text-ash-500">
                close
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-4">
                <div className="shrink-0 space-y-2">
                  <div className="w-16 h-16 rounded-lg border border-secondary/30 overflow-hidden bg-black flex items-center justify-center">
                    {avatarFile || contactEditor.avatarUrl ? (
                      <img
                        src={avatarFile ? URL.createObjectURL(avatarFile) : contactEditor.avatarUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="material-symbols-outlined text-ash-600">person</span>
                    )}
                  </div>
                  <label className="block cursor-pointer text-[8px] font-black uppercase tracking-widest text-secondary border border-secondary/30 px-2 py-1.5 text-center rounded-sm">
                    {t('npcSms.avatar')}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  {uploadProgress != null && (
                    <p className="text-[8px] text-ash-500 font-mono">{Math.round(uploadProgress)}%</p>
                  )}
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <label className={labelClass}>ID</label>
                    <input
                      className={fieldClass}
                      disabled={isEdit}
                      value={contactEditor.id}
                      placeholder="NIL_ECHO"
                      onChange={(e) => setContactEditor({ ...contactEditor, id: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t('npcSms.name')}</label>
                    <input
                      className={fieldClass}
                      value={contactEditor.name}
                      onChange={(e) => setContactEditor({ ...contactEditor, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t('npcSms.number')}</label>
                    <input
                      className={fieldClass}
                      value={contactEditor.number}
                      placeholder="(11) 92003-0100"
                      onChange={(e) => setContactEditor({ ...contactEditor, number: e.target.value })}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-ash-400">
                    <input
                      type="checkbox"
                      checked={contactEditor.enabled}
                      onChange={(e) =>
                        setContactEditor({ ...contactEditor, enabled: e.target.checked })
                      }
                    />
                    {t('npcSms.active')}
                  </label>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-white/10 flex gap-3 bg-black/40">
              <button
                type="button"
                disabled={saving}
                onClick={() => setContactEditor(null)}
                className="flex-1 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-ash-500 bg-[#333] rounded-sm"
              >
                {t('npcSms.cancel')}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={saveContact}
                className="flex-1 px-4 py-3 text-[10px] font-black uppercase tracking-widest bg-primary text-black rounded-sm disabled:opacity-40"
              >
                {saving ? '…' : t('npcSms.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialogue editor */}
      {dialogueEditor && (
        <div
          className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setDialogueEditor(null);
          }}
        >
          <div className="bg-seam border-2 border-white/10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-black/40 shrink-0">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">
                {isEdit ? t('npcSms.editDialogue') : t('npcSms.createDialogue')}
              </h3>
              <button type="button" onClick={() => !saving && setDialogueEditor(null)} className="material-symbols-outlined text-ash-500">
                close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>ID</label>
                  <input
                    className={fieldClass}
                    disabled={isEdit}
                    value={dialogueEditor.id}
                    placeholder="nil_echo_conv_6"
                    onChange={(e) => setDialogueEditor({ ...dialogueEditor, id: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass}>NPC</label>
                  <select
                    className={fieldClass}
                    value={dialogueEditor.npcId}
                    onChange={(e) =>
                      setDialogueEditor({ ...dialogueEditor, npcId: e.target.value })
                    }
                  >
                    <option value="">{t('npcSms.selectNpc')}</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>{t('npcSms.dialogueTitle')}</label>
                  <input
                    className={fieldClass}
                    value={dialogueEditor.title}
                    onChange={(e) =>
                      setDialogueEditor({ ...dialogueEditor, title: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className={labelClass + ' mb-0'}>{t('npcSms.turns')}</label>
                  <button
                    type="button"
                    onClick={addTurn}
                    className="text-[8px] font-black uppercase tracking-widest text-secondary border border-secondary/30 px-2 py-1 rounded-sm"
                  >
                    + {t('npcSms.addTurn')}
                  </button>
                </div>
                {dialogueEditor.messages.map((m, i) => (
                  <div key={i} className="bg-black/40 border border-white/5 p-3 rounded-sm space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        className={`${fieldClass} max-w-[120px]`}
                        value={m.speaker}
                        onChange={(e) =>
                          updateTurn(i, {
                            speaker: e.target.value as NpcSmsTurn['speaker'],
                          })
                        }
                      >
                        <option value="npc">NPC</option>
                        <option value="player">PLAYER</option>
                      </select>
                      <button type="button" onClick={() => moveTurn(i, -1)} className="text-ash-600 hover:text-white material-symbols-outlined text-sm">
                        arrow_upward
                      </button>
                      <button type="button" onClick={() => moveTurn(i, 1)} className="text-ash-600 hover:text-white material-symbols-outlined text-sm">
                        arrow_downward
                      </button>
                      <button type="button" onClick={() => removeTurn(i)} className="text-red-500/60 hover:text-red-400 material-symbols-outlined text-sm ml-auto">
                        delete
                      </button>
                    </div>
                    <textarea
                      className={`${fieldClass} min-h-[64px] normal-case`}
                      value={m.text}
                      onChange={(e) => updateTurn(i, { text: e.target.value })}
                    />
                  </div>
                ))}
              </div>

              <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-ash-400">
                <input
                  type="checkbox"
                  checked={dialogueEditor.enabled}
                  onChange={(e) =>
                    setDialogueEditor({ ...dialogueEditor, enabled: e.target.checked })
                  }
                />
                {t('npcSms.active')}
              </label>
            </div>
            <div className="px-6 py-4 border-t border-white/10 flex gap-3 bg-black/40 shrink-0">
              <button
                type="button"
                disabled={saving}
                onClick={() => setDialogueEditor(null)}
                className="flex-1 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-ash-500 bg-[#333] rounded-sm"
              >
                {t('npcSms.cancel')}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={saveDialogue}
                className="flex-1 px-4 py-3 text-[10px] font-black uppercase tracking-widest bg-primary text-black rounded-sm disabled:opacity-40"
              >
                {saving ? '…' : t('npcSms.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
