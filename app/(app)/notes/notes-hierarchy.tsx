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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteFolderPending, setDeleteFolderPending] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderTitle, setEditingFolderTitle] = useState('');
  const [renamePending, setRenamePending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PageNode[]>([]);
  const [searchPending, setSearchPending] = useState(false);

  const pageSize = 5;

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

  const selectedFolder = useMemo(
    () => folders.find((folder) => folder.id === selectedParentId) ?? null,
    [folders, selectedParentId]
  );

  const memoItems = useMemo(
    () =>
      listItems
        .filter((item) => item.kind === 'page')
        .slice()
        .sort((a, b) => {
          const updatedAtDiff =
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          if (updatedAtDiff !== 0) {
            return updatedAtDiff;
          }
          return b.id.localeCompare(a.id);
        }),
    [listItems]
  );

  const trimmedQuery = searchQuery.trim();
  const isSearching = trimmedQuery.length >= 2;

  const displayMemoItems = useMemo(
    () => (isSearching ? searchResults : memoItems),
    [isSearching, memoItems, searchResults]
  );

  const selectedMemo = useMemo(
    () => displayMemoItems.find((item) => item.id === selectedPageId) ?? null,
    [displayMemoItems, selectedPageId]
  );

  const totalPages = Math.max(
    1,
    Math.ceil((isSearching ? displayMemoItems.length : memoItems.length) / pageSize)
  );
  const safePage = isSearching ? 1 : Math.min(currentPage, totalPages);
  const pagedMemoItems = useMemo(() => {
    if (isSearching) {
      return displayMemoItems;
    }
    const startIndex = (safePage - 1) * pageSize;
    return memoItems.slice(startIndex, startIndex + pageSize);
  }, [displayMemoItems, isSearching, memoItems, pageSize, safePage]);

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

  const updateFolderTitleLocally = useCallback((folderId: string, title: string) => {
    setTreeMap((prev) => {
      const next: Record<string, PageNode[]> = {};
      Object.entries(prev).forEach(([key, items]) => {
        next[key] = items.map((item) =>
          item.id === folderId ? { ...item, title } : item
        );
      });
      return next;
    });
    setFolders((prev) =>
      prev.map((item) => (item.id === folderId ? { ...item, title } : item))
    );
    setListItems((prev) =>
      prev.map((item) => (item.id === folderId ? { ...item, title } : item))
    );
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
    setCurrentPage(1);
  }, [selectedParentId]);

  useEffect(() => {
    if (isSearching) {
      setCurrentPage(1);
    }
  }, [isSearching]);

  useEffect(() => {
    if (currentPage !== safePage) {
      setCurrentPage(safePage);
    }
  }, [currentPage, safePage]);

  useEffect(() => {
    if (displayMemoItems.length === 0) {
      setSelectedPageId(null);
      setSelectedPageTitle('');
      setSelectedPageRevision(null);
      setMemoText('');
      setSaveError(null);
      setIsDirty(false);
      setIsModalOpen(false);
      return;
    }

    const hasSelected = displayMemoItems.some((item) => item.id === selectedPageId);
    if (!hasSelected) {
      setSelectedPageId(null);
      setSelectedPageTitle('');
      setSelectedPageRevision(null);
      setMemoText('');
      setSaveError(null);
      setIsDirty(false);
      setIsModalOpen(false);
    }
  }, [displayMemoItems, selectedPageId]);

  useEffect(() => {
    if (!isSearching) {
      setSearchResults([]);
      setSearchPending(false);
      return;
    }

    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      setSearchPending(true);
      try {
        const params = new URLSearchParams({ q: trimmedQuery, limit: '50' });
        const response = await fetch(`/api/search?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal
        });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as {
          ok: boolean;
          data?: {
            items: Array<{
              id: string;
              title: string | null;
              updatedAt: string | Date;
            }>;
          };
        };
        if (payload.ok && payload.data) {
          const items = payload.data.items.map((item) => ({
            id: item.id,
            title: item.title,
            kind: 'page' as const,
            parentId: null,
            position: null,
            updatedAt: item.updatedAt
          }));
          setSearchResults(items);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
      } finally {
        setSearchPending(false);
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [isSearching, trimmedQuery]);

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

  const handleDeleteMemo = async () => {
    if (!selectedPageId || deletePending) {
      return;
    }
    const shouldDelete = window.confirm('このメモを削除しますか？');
    if (!shouldDelete) {
      return;
    }

    setDeletePending(true);
    setSaveError(null);
    try {
      const response = await fetch(`/api/pages/${selectedPageId}/trash`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('削除に失敗しました。');
      }

      setSelectedPageId(null);
      setSelectedPageTitle('');
      setSelectedPageRevision(null);
      setMemoText('');
      setIsDirty(false);
      await loadList(selectedParentId);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : '削除に失敗しました。'
      );
    } finally {
      setDeletePending(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (!selectedFolder || deleteFolderPending) {
      return;
    }
    const shouldDelete = window.confirm(
      `「${selectedFolder.title || DEFAULT_FOLDER_TITLE}」を削除しますか？`
    );
    if (!shouldDelete) {
      return;
    }

    setDeleteFolderPending(true);
    try {
      const response = await fetch(`/api/pages/${selectedFolder.id}/trash`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('フォルダ削除に失敗しました。');
      }

      const nextParentId = selectedFolder.parentId ?? null;
      setSelectedParentId(nextParentId);
      setSelectedPageId(null);
      setSelectedPageTitle('');
      setSelectedPageRevision(null);
      setMemoText('');
      setIsDirty(false);
      await loadTree(nextParentId);
      await loadList(nextParentId);
      await loadFolderOptions();
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : 'フォルダ削除に失敗しました。'
      );
    } finally {
      setDeleteFolderPending(false);
    }
  };

  const handleStartRename = (folder: PageNode) => {
    setEditingFolderId(folder.id);
    setEditingFolderTitle(folder.title || DEFAULT_FOLDER_TITLE);
  };

  const handleRenameCommit = async () => {
    if (!editingFolderId || renamePending) {
      return;
    }
    const trimmedTitle = editingFolderTitle.trim();
    if (!trimmedTitle) {
      setEditingFolderId(null);
      return;
    }
    setRenamePending(true);
    try {
      const response = await fetch(`/api/pages/${editingFolderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmedTitle })
      });
      if (!response.ok) {
        return;
      }
      updateFolderTitleLocally(editingFolderId, trimmedTitle);
    } finally {
      setRenamePending(false);
      setEditingFolderId(null);
    }
  };

  const handleRenameCancel = () => {
    setEditingFolderId(null);
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
              style={{ paddingInlineStart: `calc(${depth} * var(--space-4))` }}
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
                onDoubleClick={() => handleStartRename(folder)}
              >
                {editingFolderId === folder.id ? (
                  <input
                    className="notes-tree__input"
                    value={editingFolderTitle}
                    onChange={(event) => setEditingFolderTitle(event.target.value)}
                    onBlur={handleRenameCommit}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void handleRenameCommit();
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        handleRenameCancel();
                      }
                    }}
                    aria-label="フォルダ名を編集"
                    autoFocus
                  />
                ) : (
                  <>📁 {folder.title || DEFAULT_FOLDER_TITLE}</>
                )}
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
              <div className="notes-list__edit">
                <span className="notes-list__search-label">検索</span>
                <input
                  className="notes-list__input"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="メモを検索（2文字以上）"
                  aria-label="メモ検索"
                />
                {searchQuery ? (
                  <button
                    className="button button--ghost"
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="検索条件をクリア"
                  >
                    検索クリア
                  </button>
                ) : null}
                {isSearching ? (
                  <span className="notes-list__empty">
                    {searchPending
                      ? '検索中...'
                      : `${displayMemoItems.length}件の結果`}
                  </span>
                ) : (
                  <span className="notes-list__empty">
                    フォルダ内のメモを表示中
                  </span>
                )}
              </div>
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
              {selectedFolder ? (
                <button
                  className="button button--plain"
                  type="button"
                  onClick={handleDeleteFolder}
                  disabled={deleteFolderPending}
                  aria-label={
                    deleteFolderPending ? 'フォルダ削除中' : 'フォルダを削除'
                  }
                >
                  フォルダ削除
                </button>
              ) : null}
            </div>
          </div>

          {displayMemoItems.length === 0 && !loadingList && !searchPending ? (
            <div className="notes-list__empty-message">
              {isSearching
                ? '検索結果が見つかりませんでした。'
                : 'このフォルダにはメモがありません。'}
            </div>
          ) : null}
          {loadingList || searchPending || displayMemoItems.length > 0 ? (
            <>
              <div
                className={`notes-list__items ${
                  loadingList || searchPending ? 'notes-list__items--loading' : ''
                }`}
              >
                {(loadingList || searchPending ? [] : pagedMemoItems).map((item) => (
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
                        {item.title || DEFAULT_PAGE_TITLE}
                      </button>
                    </div>
                  </div>
                ))}
                {Array.from(
                  {
                    length: Math.max(
                      0,
                      pageSize -
                        (loadingList || searchPending ? 0 : pagedMemoItems.length)
                    )
                  },
                  (_, index) => (
                    <div
                      key={`placeholder-${index}`}
                      className="notes-list__item notes-list__item--placeholder"
                      aria-hidden="true"
                    />
                  )
                )}
              </div>
              {!isSearching ? (
                <div className="notes-list__pager" aria-label="メモ一覧ページャ">
                  <button
                    className="button button--ghost"
                    type="button"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={loadingList || safePage === 1}
                  >
                    前へ
                  </button>
                  <span className="notes-list__pager-status">
                    {loadingList ? '読み込み中' : `${safePage} / ${totalPages}`}
                  </span>
                  <button
                    className="button button--ghost"
                    type="button"
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={loadingList || safePage === totalPages}
                  >
                    次へ
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
        <div className="notes-detail">
          <div className="notes-detail__header">
            <div className="notes-detail__actions">
              <button
                className="button button--plain"
                type="button"
                onClick={() => setIsModalOpen((prev) => !prev)}
                disabled={!selectedPageId}
                aria-label={
                  isModalOpen ? '拡大編集を閉じる' : '拡大編集を開く'
                }
              >
                {isModalOpen ? '通常表示' : '拡大表示'}
              </button>
              <button
                className="button button--plain"
                type="button"
                onClick={handleSaveMemo}
                disabled={!selectedPageId || savePending || !isDirty}
                aria-label={savePending ? '保存中' : '保存'}
              >
                {savePending ? '保存中…' : '保存'}
              </button>
              <button
                className="button button--plain"
                type="button"
                onClick={handleDeleteMemo}
                disabled={!selectedPageId || deletePending}
                aria-label={deletePending ? '削除中' : '削除'}
              >
                {deletePending ? '削除中…' : '削除'}
              </button>
            </div>
          </div>

          {loadingMemo ? (
            <div className="notes-detail__empty">Loading...</div>
          ) : selectedPageId ? (
            <div className="notes-detail__body">
              <div className="notes-detail__field">
                <input
                  className="notes-detail__title-input"
                  value={selectedPageTitle}
                  onChange={(event) => {
                    setSelectedPageTitle(event.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="メモのタイトルを入力してください。"
                  aria-label="メモタイトル"
                />
              </div>
              <div className="notes-detail__textarea-wrapper">
                <textarea
                  className="notes-detail__textarea"
                  value={memoText}
                  onChange={(event) => {
                    setMemoText(event.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="メモの内容を入力してください。"
                  aria-label="メモの内容"
                />
                {selectedMemo ? (
                  <span className="notes-detail__updated-at">
                    最終更新: {formatUpdatedAt(selectedMemo.updatedAt)}
                  </span>
                ) : null}
              </div>
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
        {isModalOpen && selectedPageId ? (
          <div
            className="notes-modal"
            role="dialog"
            aria-modal="true"
            aria-label="メモ拡大編集"
            onClick={() => setIsModalOpen(false)}
          >
            <div
              className="notes-modal__panel"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="notes-modal__header">
                <span className="notes-modal__title">拡大編集</span>
                <button
                  className="button button--plain"
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  aria-label="拡大編集を閉じる"
                >
                  閉じる
                </button>
              </div>
              <div className="notes-modal__body">
                <div className="notes-detail__field">
                  <input
                    className="notes-detail__title-input"
                    value={selectedPageTitle}
                    onChange={(event) => {
                      setSelectedPageTitle(event.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="メモのタイトルを入力してください。"
                    aria-label="メモタイトル"
                  />
                </div>
                <div className="notes-modal__textarea-wrapper">
                  <textarea
                    className="notes-modal__textarea"
                    value={memoText}
                    onChange={(event) => {
                      setMemoText(event.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="メモの内容を入力してください。"
                    aria-label="メモの内容"
                  />
                  {selectedMemo ? (
                    <span className="notes-detail__updated-at">
                      最終更新: {formatUpdatedAt(selectedMemo.updatedAt)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
