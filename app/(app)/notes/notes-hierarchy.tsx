'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { DEFAULT_PAGE_TITLE } from '@/lib/page-title';

const DEFAULT_FOLDER_TITLE = 'Untitled folder';

type PageNode = {
  id: string;
  title: string | null;
  kind: 'page' | 'folder';
  parentId: string | null;
  position: number | null;
  updatedAt: string | Date;
};

type FolderOption = {
  id: string | null;
  title: string;
};

const formatUpdatedAt = (value: string | Date | null) => {
  if (!value) {
    return 'Not edited yet';
  }
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

const rootKey = 'root';

export default function NotesHierarchy() {
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [listItems, setListItems] = useState<PageNode[]>([]);
  const [treeMap, setTreeMap] = useState<Record<string, PageNode[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set([rootKey]));
  const [loadingList, setLoadingList] = useState(false);
  const [loadingTree, setLoadingTree] = useState<Record<string, boolean>>({});
  const [movePendingId, setMovePendingId] = useState<string | null>(null);
  const [reorderPendingId, setReorderPendingId] = useState<string | null>(null);
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [renamePendingId, setRenamePendingId] = useState<string | null>(null);
  const [folders, setFolders] = useState<PageNode[]>([]);
  const [createPending, setCreatePending] = useState<string | null>(null);

  const folderLookup = useMemo(() => {
    const map = new Map<string, string>();
    folders.forEach((folder) => {
      if (folder.title) {
        map.set(folder.id, folder.title);
      }
    });
    return map;
  }, [folders]);

  const currentFolderLabel = selectedParentId
    ? folderLookup.get(selectedParentId) ?? DEFAULT_FOLDER_TITLE
    : 'トップ';

  const folderOptions = useMemo<FolderOption[]>(() => {
    const options: FolderOption[] = [{ id: null, title: 'トップ' }];
    folders.forEach((folder) => {
      options.push({
        id: folder.id,
        title: folder.title || DEFAULT_FOLDER_TITLE
      });
    });
    return options;
  }, [folders]);

  const loadFolderOptions = useCallback(async () => {
    try {
      const response = await fetch('/api/pages?scope=folders', {
        cache: 'no-store'
      });
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as {
        ok: boolean;
        data?: { items: PageNode[] };
      };
      if (payload.ok && payload.data) {
        setFolders(payload.data.items);
      }
    } catch {
      // ignore
    }
  }, []);

  const loadTree = useCallback(async (parentId: string | null) => {
    const key = parentId ?? rootKey;
    setLoadingTree((prev) => ({ ...prev, [key]: true }));
    try {
      const params = new URLSearchParams({ scope: 'children', kind: 'folder' });
      if (parentId) {
        params.set('parentId', parentId);
      }
      const response = await fetch(`/api/pages?${params.toString()}`, {
        cache: 'no-store'
      });
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as {
        ok: boolean;
        data?: { items: PageNode[] };
      };
      if (payload.ok && payload.data) {
        const items = payload.data.items ?? [];
        setTreeMap((prev) => ({ ...prev, [key]: items }));
      }
    } finally {
      setLoadingTree((prev) => ({ ...prev, [key]: false }));
    }
  }, []);

  const loadList = useCallback(async (parentId: string | null) => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams({ scope: 'children' });
      if (parentId) {
        params.set('parentId', parentId);
      }
      const response = await fetch(`/api/pages?${params.toString()}`, {
        cache: 'no-store'
      });
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as {
        ok: boolean;
        data?: { items: PageNode[] };
      };
      if (payload.ok && payload.data) {
        setListItems(payload.data.items);
      }
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadTree(null);
    void loadList(null);
    void loadFolderOptions();
  }, [loadFolderOptions, loadList, loadTree]);

  useEffect(() => {
    void loadList(selectedParentId);
  }, [loadList, selectedParentId]);

  const handleToggle = async (folderId: string | null) => {
    const key = folderId ?? rootKey;
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

    if (folderId && !treeMap[key]) {
      await loadTree(folderId);
    }

    if (!folderId && !treeMap[key]) {
      await loadTree(null);
    }
  };

  const handleCreate = async (kind: 'page' | 'folder') => {
    if (createPending) {
      return;
    }
    setCreatePending(kind);
    try {
      const response = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, parentId: selectedParentId })
      });
      if (!response.ok) {
        return;
      }
      await loadList(selectedParentId);
      await loadTree(selectedParentId);
      await loadFolderOptions();
    } finally {
      setCreatePending(null);
    }
  };

  const handleMove = async (pageId: string, parentId: string | null) => {
    if (movePendingId) {
      return;
    }
    setMovePendingId(pageId);
    try {
      const response = await fetch(`/api/pages/${pageId}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId })
      });
      if (!response.ok) {
        return;
      }
      await loadList(selectedParentId);
      await loadTree(selectedParentId);
      await loadFolderOptions();
    } finally {
      setMovePendingId(null);
    }
  };

  const handleReorder = async (pageId: string, direction: 'up' | 'down') => {
    if (reorderPendingId) {
      return;
    }

    const index = listItems.findIndex((item) => item.id === pageId);
    if (index === -1) {
      return;
    }

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= listItems.length) {
      return;
    }

    const nextItems = [...listItems];
    const [moved] = nextItems.splice(index, 1);
    nextItems.splice(targetIndex, 0, moved);
    setListItems(nextItems);
    setReorderPendingId(pageId);

    try {
      const response = await fetch('/api/pages/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentId: selectedParentId,
          orderedIds: nextItems.map((item) => item.id)
        })
      });
      if (!response.ok) {
        await loadList(selectedParentId);
        return;
      }
    } finally {
      setReorderPendingId(null);
    }
  };

  const handleDelete = async (pageId: string) => {
    if (deletePendingId) {
      return;
    }
    setDeletePendingId(pageId);
    try {
      const response = await fetch(`/api/pages/${pageId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        return;
      }
      await loadList(selectedParentId);
      await loadTree(selectedParentId);
      await loadFolderOptions();
    } finally {
      setDeletePendingId(null);
    }
  };

  const handleRename = async () => {
    if (!editingFolderId || renamePendingId) {
      return;
    }
    const nextTitle = editingTitle.trim();
    if (!nextTitle) {
      return;
    }
    setRenamePendingId(editingFolderId);
    try {
      const response = await fetch(`/api/pages/${editingFolderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: nextTitle })
      });
      if (!response.ok) {
        return;
      }
      setEditingFolderId(null);
      setEditingTitle('');
      await loadList(selectedParentId);
      await loadTree(selectedParentId);
      await loadFolderOptions();
    } finally {
      setRenamePendingId(null);
    }
  };

  const renderTree = (parentId: string | null, depth: number) => {
    const key = parentId ?? rootKey;
    const children = treeMap[key] ?? [];
    const isExpanded = expanded.has(key);

    if (!isExpanded) {
      return null;
    }

    return (
      <div className="notes-tree__children">
        {children.map((folder) => (
          <div key={folder.id} className="notes-tree__node">
            <div
              className={`notes-tree__item ${
                selectedParentId === folder.id ? 'notes-tree__item--active' : ''
              }`}
              style={{ paddingLeft: `${depth * 16}px` }}
            >
              <button
                className="notes-tree__toggle"
                type="button"
                onClick={() => handleToggle(folder.id)}
                aria-label={
                  expanded.has(folder.id) ? 'Collapse folder' : 'Expand folder'
                }
              >
                {expanded.has(folder.id) ? '▾' : '▸'}
              </button>
              <button
                className="notes-tree__label"
                type="button"
                onClick={() => setSelectedParentId(folder.id)}
              >
                📁 {folder.title || DEFAULT_FOLDER_TITLE}
              </button>
            </div>
            {loadingTree[folder.id] && (
              <div className="notes-tree__loading">Loading...</div>
            )}
            {renderTree(folder.id, depth + 1)}
          </div>
        ))}
        {children.length === 0 && (
          <div className="notes-tree__empty">フォルダがありません。</div>
        )}
      </div>
    );
  };

  return (
    <div className="notes-shell">
      <aside className="notes-tree">
        <div className="notes-tree__header">フォルダツリー</div>
        <div className="notes-tree__node">
          <div
            className={`notes-tree__item ${
              selectedParentId === null ? 'notes-tree__item--active' : ''
            }`}
          >
            <button
              className="notes-tree__toggle"
              type="button"
              onClick={() => handleToggle(null)}
              aria-label={expanded.has(rootKey) ? 'Collapse root' : 'Expand root'}
            >
              {expanded.has(rootKey) ? '▾' : '▸'}
            </button>
            <button
              className="notes-tree__label"
              type="button"
              onClick={() => setSelectedParentId(null)}
            >
              🗂️ トップ
            </button>
          </div>
          {loadingTree[rootKey] && (
            <div className="notes-tree__loading">Loading...</div>
          )}
          {renderTree(null, 1)}
        </div>
      </aside>
      <section className="notes-list">
        <div className="notes-list__header">
          <div>
            <div className="badge">Current folder</div>
            <h2>{currentFolderLabel}</h2>
            <p className="notes-list__subtitle">
              フォルダ内のメモとサブフォルダを表示します。
            </p>
          </div>
          <div className="notes-list__actions">
            <button
              className="button"
              type="button"
              onClick={() => handleCreate('page')}
              disabled={createPending === 'page'}
            >
              新規メモ
            </button>
            <button
              className="button button--ghost"
              type="button"
              onClick={() => handleCreate('folder')}
              disabled={createPending === 'folder'}
            >
              新規フォルダ
            </button>
          </div>
        </div>

        {loadingList ? (
          <div className="notes-list__empty">Loading...</div>
        ) : listItems.length === 0 ? (
          <div className="card notes-list__empty">
            <p>このフォルダにはメモがありません。</p>
          </div>
        ) : (
          <div className="notes-list__items">
            {listItems.map((item, index) => (
              <div key={item.id} className="notes-list__item">
                <div className="notes-list__item-main">
                  {item.kind === 'folder' ? (
                    <>
                      <button
                        className="notes-list__title notes-list__title-button"
                        type="button"
                        onClick={() => setSelectedParentId(item.id)}
                      >
                        📁 {item.title || DEFAULT_FOLDER_TITLE}
                      </button>
                      {editingFolderId === item.id && (
                        <div className="notes-list__edit">
                          <input
                            className="notes-list__input"
                            value={editingTitle}
                            onChange={(event) => setEditingTitle(event.target.value)}
                            placeholder="フォルダ名を入力"
                          />
                          <button
                            className="button button--ghost"
                            type="button"
                            onClick={handleRename}
                            disabled={renamePendingId === item.id}
                          >
                            保存
                          </button>
                          <button
                            className="button button--ghost"
                            type="button"
                            onClick={() => {
                              setEditingFolderId(null);
                              setEditingTitle('');
                            }}
                            disabled={renamePendingId === item.id}
                          >
                            キャンセル
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <Link className="notes-list__title" href={`/p/${item.id}`}>
                      📝 {item.title || DEFAULT_PAGE_TITLE}
                    </Link>
                  )}
                  <div className="notes-list__meta">
                    最終更新: {formatUpdatedAt(item.updatedAt)}
                  </div>
                </div>
                <div className="notes-list__controls">
                  <div className="notes-list__move">
                    <label>
                      <span>Move to</span>
                      <select
                        value={item.parentId ?? ''}
                        onChange={(event) => {
                          const value = event.target.value;
                          const nextParentId = value === '' ? null : value;
                          if (nextParentId === item.id) {
                            return;
                          }
                          void handleMove(item.id, nextParentId);
                        }}
                        disabled={movePendingId === item.id}
                      >
                        {folderOptions
                          .filter((option) => option.id !== item.id)
                          .map((option) => (
                            <option
                              key={option.id ?? 'root'}
                              value={option.id ?? ''}
                            >
                              {option.title}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                  <div className="notes-list__order">
                    <button
                      className="button button--ghost"
                      type="button"
                      onClick={() => handleReorder(item.id, 'up')}
                      disabled={index === 0 || reorderPendingId === item.id}
                    >
                      ↑
                    </button>
                    <button
                      className="button button--ghost"
                      type="button"
                      onClick={() => handleReorder(item.id, 'down')}
                      disabled={
                        index === listItems.length - 1 ||
                        reorderPendingId === item.id
                      }
                    >
                      ↓
                    </button>
                    {item.kind === 'folder' && (
                      <>
                        <button
                          className="button button--ghost"
                          type="button"
                          onClick={() => {
                            setEditingFolderId(item.id);
                            setEditingTitle(item.title || DEFAULT_FOLDER_TITLE);
                          }}
                          disabled={renamePendingId === item.id}
                        >
                          名前を編集
                        </button>
                        <button
                          className="button button--ghost"
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          disabled={deletePendingId === item.id}
                        >
                          削除
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
