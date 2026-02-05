'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { extractPlainText, type FlatBlock } from '@/lib/blocks';
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
  const [folders, setFolders] = useState<PageNode[]>([]);
  const [createPending, setCreatePending] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedPageTitle, setSelectedPageTitle] = useState('');
  const [selectedPageRevision, setSelectedPageRevision] = useState<number | null>(
    null
  );
  const [memoText, setMemoText] = useState('');
  const [loadingMemo, setLoadingMemo] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

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

  const memoItems = useMemo(
    () => listItems.filter((item) => item.kind === 'page'),
    [listItems]
  );

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

  useEffect(() => {
    if (memoItems.length === 0) {
      setSelectedPageId(null);
      setSelectedPageTitle('');
      setSelectedPageRevision(null);
      setMemoText('');
      setSaveError(null);
      setIsDirty(false);
      return;
    }

    const hasSelected = memoItems.some((item) => item.id === selectedPageId);
    if (!hasSelected) {
      setSelectedPageId(memoItems[0].id);
    }
  }, [memoItems, selectedPageId]);

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

  const loadMemoDetail = useCallback(async (pageId: string) => {
    setLoadingMemo(true);
    setSaveError(null);
    try {
      const [pageResponse, blocksResponse] = await Promise.all([
        fetch(`/api/pages/${pageId}`, { cache: 'no-store' }),
        fetch(`/api/pages/${pageId}/blocks`, { cache: 'no-store' })
      ]);

      if (!pageResponse.ok || !blocksResponse.ok) {
        throw new Error('メモの取得に失敗しました。');
      }

      const pagePayload = (await pageResponse.json()) as {
        ok: boolean;
        page?: { title?: string; contentRevision?: number };
      };
      const blocksPayload = (await blocksResponse.json()) as {
        ok: boolean;
        blocks?: FlatBlock[];
      };

      setSelectedPageTitle(pagePayload.page?.title ?? DEFAULT_PAGE_TITLE);
      setSelectedPageRevision(pagePayload.page?.contentRevision ?? null);
      const plainText = Array.isArray(blocksPayload.blocks)
        ? extractPlainText(blocksPayload.blocks)
        : '';
      setMemoText(plainText);
      setIsDirty(false);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'メモの取得に失敗しました。'
      );
    } finally {
      setLoadingMemo(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedPageId) {
      return;
    }
    void loadMemoDetail(selectedPageId);
  }, [loadMemoDetail, selectedPageId]);

  const handleSaveMemo = async () => {
    if (!selectedPageId || savePending || selectedPageRevision === null) {
      return;
    }

    setSavePending(true);
    setSaveError(null);

    const blocks: FlatBlock[] = memoText
      ? [
          {
            id: crypto.randomUUID(),
            pageId: selectedPageId,
            parentBlockId: null,
            type: 'paragraph',
            indent: 0,
            orderIndex: 0,
            content: { text: memoText }
          }
        ]
      : [];

    try {
      const response = await fetch(`/api/pages/${selectedPageId}/blocks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseRevision: selectedPageRevision,
          title: selectedPageTitle,
          blocks
        })
      });

      if (response.status === 409) {
        setSaveError('他の更新があります。再読み込みしてください。');
        return;
      }

      if (!response.ok) {
        throw new Error('保存に失敗しました。');
      }

      const payload = (await response.json()) as {
        contentRevision?: number;
      };
      if (typeof payload.contentRevision === 'number') {
        setSelectedPageRevision(payload.contentRevision);
      }
      setIsDirty(false);
      await loadList(selectedParentId);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : '保存に失敗しました。'
      );
    } finally {
      setSavePending(false);
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
      <section className="notes-panel">
        <div className="notes-list">
          <div className="notes-list__header">
            <div>
              <h2>{currentFolderLabel}</h2>
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
          ) : memoItems.length === 0 ? (
            <div className="card notes-list__empty">
              <p>このフォルダにはメモがありません。</p>
            </div>
          ) : (
            <div className="notes-list__items">
              {memoItems.map((item) => (
                <div
                  key={item.id}
                  className={`notes-list__item ${
                    selectedPageId === item.id ? 'notes-list__item--active' : ''
                  }`}
                >
                  <div className="notes-list__item-main">
                    <button
                      className="notes-list__title notes-list__title-button"
                      type="button"
                      onClick={() => setSelectedPageId(item.id)}
                    >
                      📝 {item.title || DEFAULT_PAGE_TITLE}
                    </button>
                    <div className="notes-list__meta">
                      最終更新: {formatUpdatedAt(item.updatedAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div
          className={`notes-detail ${
            isExpanded ? 'notes-detail--expanded' : ''
          }`}
        >
          <div className="notes-detail__header">
            <div>
              <div className="badge">Selected memo</div>
              <h3>{selectedPageTitle || 'メモを選択'}</h3>
              <p className="notes-detail__subtitle">
                下段のテキストエリアから直接編集できます。
              </p>
            </div>
            <div className="notes-detail__actions">
              <button
                className="button button--ghost"
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                disabled={!selectedPageId}
              >
                {isExpanded ? '縮小表示' : '拡大表示'}
              </button>
              <button
                className="button"
                type="button"
                onClick={handleSaveMemo}
                disabled={!selectedPageId || savePending || !isDirty}
              >
                {savePending ? '保存中...' : '保存'}
              </button>
            </div>
          </div>

          {loadingMemo ? (
            <div className="notes-detail__empty">Loading...</div>
          ) : selectedPageId ? (
            <div className="notes-detail__body">
              <textarea
                className="notes-detail__textarea"
                value={memoText}
                onChange={(event) => {
                  setMemoText(event.target.value);
                  setIsDirty(true);
                }}
                placeholder="メモの内容を入力してください。"
              />
              <div className="notes-detail__meta">
                {saveError ? (
                  <span className="notes-detail__error">{saveError}</span>
                ) : isDirty ? (
                  '未保存の変更があります。'
                ) : (
                  '変更は保存済みです。'
                )}
              </div>
            </div>
          ) : (
            <div className="notes-detail__empty">
              メモを選択すると内容が表示されます。
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
