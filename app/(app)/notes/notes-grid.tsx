'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from 'react';
import { useRouter } from 'next/navigation';

import { extractPlainText, type FlatBlock } from '@/lib/blocks';
import { DEFAULT_PAGE_TITLE } from '@/lib/page-title';

export type MemoRow = {
  id: string;
  title: string | null;
  updatedAt: string | Date;
};

type NotesGridProps = {
  /** Server-rendered list: the grid needs no client fetch for the first paint. */
  initialItems: MemoRow[];
};

type SortKey = 'title' | 'updatedAt';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 10;

const formatUpdatedAt = (value: string | Date | null) => {
  if (!value) {
    return '未編集';
  }
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
};

const getFocusableElements = (container: HTMLElement | null) => {
  if (!container) {
    return [] as HTMLElement[];
  }
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex='-1'])"
    )
  );
};

export default function NotesGrid({ initialItems }: NotesGridProps) {
  const router = useRouter();
  const [memos, setMemos] = useState<MemoRow[]>(initialItems);
  const [isRefreshing, startRefresh] = useTransition();
  const [listError, setListError] = useState<string | null>(null);
  const [createPending, setCreatePending] = useState(false);
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MemoRow[]>([]);
  const [searchPending, setSearchPending] = useState(false);

  const [openPageId, setOpenPageId] = useState<string | null>(null);
  const [openTitle, setOpenTitle] = useState('');
  const [openText, setOpenText] = useState('');
  const [openRevision, setOpenRevision] = useState<number | null>(null);
  const [openUpdatedAt, setOpenUpdatedAt] = useState<string | Date | null>(null);
  const [loadingMemo, setLoadingMemo] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const trimmedQuery = searchQuery.trim();
  const isSearching = trimmedQuery.length >= 2;

  /* The list is server-rendered; a refresh re-runs the server query instead of
     walking the paginated API from the client. */
  useEffect(() => {
    setMemos(initialItems);
  }, [initialItems]);

  const refreshMemos = useCallback(() => {
    setListError(null);
    startRefresh(() => {
      router.refresh();
    });
  }, [router]);

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
          setSearchResults(
            payload.data.items.map((item) => ({
              id: item.id,
              title: item.title,
              updatedAt: item.updatedAt
            }))
          );
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

  const rows = useMemo(() => {
    const source = isSearching ? searchResults : memos;
    const sorted = source.slice().sort((a, b) => {
      if (sortKey === 'title') {
        const left = (a.title || DEFAULT_PAGE_TITLE).toLowerCase();
        const right = (b.title || DEFAULT_PAGE_TITLE).toLowerCase();
        const diff = left.localeCompare(right, 'ja');
        return sortDirection === 'asc' ? diff : -diff;
      }
      const diff =
        new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      if (diff !== 0) {
        return sortDirection === 'asc' ? diff : -diff;
      }
      return sortDirection === 'asc'
        ? a.id.localeCompare(b.id)
        : b.id.localeCompare(a.id);
    });
    return sorted;
  }, [isSearching, memos, searchResults, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedRows = useMemo(
    () => rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [rows, safePage]
  );

  useEffect(() => {
    if (currentPage !== safePage) {
      setCurrentPage(safePage);
    }
  }, [currentPage, safePage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [isSearching, trimmedQuery, sortKey, sortDirection]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'title' ? 'asc' : 'desc');
  };

  const ariaSort = (key: SortKey) => {
    if (key !== sortKey) {
      return 'none' as const;
    }
    return sortDirection === 'asc' ? ('ascending' as const) : ('descending' as const);
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
        page?: {
          title?: string;
          contentRevision?: number;
          updatedAt?: string | Date;
        };
      };
      const blocksPayload = (await blocksResponse.json()) as {
        ok: boolean;
        blocks?: FlatBlock[];
      };

      setOpenTitle(pagePayload.page?.title ?? DEFAULT_PAGE_TITLE);
      setOpenRevision(pagePayload.page?.contentRevision ?? null);
      setOpenUpdatedAt(pagePayload.page?.updatedAt ?? null);
      setOpenText(
        Array.isArray(blocksPayload.blocks)
          ? extractPlainText(blocksPayload.blocks)
          : ''
      );
      setIsDirty(false);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'メモの取得に失敗しました。'
      );
    } finally {
      setLoadingMemo(false);
    }
  }, []);

  const openMemo = (pageId: string) => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    setOpenPageId(pageId);
    setOpenTitle('');
    setOpenText('');
    setOpenRevision(null);
    setOpenUpdatedAt(null);
    setIsDirty(false);
    setSaveError(null);
    void loadMemoDetail(pageId);
  };

  const closeMemo = useCallback(() => {
    if (isDirty) {
      const discard = window.confirm(
        '保存されていない変更があります。閉じてよろしいですか？'
      );
      if (!discard) {
        return;
      }
    }
    setOpenPageId(null);
    setIsDirty(false);
    setSaveError(null);
  }, [isDirty]);

  useEffect(() => {
    if (!openPageId) {
      const restoreTarget = previousFocus.current;
      if (restoreTarget && document.contains(restoreTarget)) {
        restoreTarget.focus();
      }
      return;
    }

    document.body.classList.add('drawer-open');

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMemo();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (active === first || !dialogRef.current?.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('drawer-open');
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeMemo, openPageId]);

  useEffect(() => {
    if (openPageId && !loadingMemo) {
      titleInputRef.current?.focus();
    }
  }, [loadingMemo, openPageId]);

  const handleCreate = async () => {
    if (createPending) {
      return;
    }
    setCreatePending(true);
    setListError(null);
    try {
      const response = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'page', parentId: null })
      });
      if (!response.ok) {
        throw new Error('メモの作成に失敗しました。');
      }
      const payload = (await response.json()) as {
        ok: boolean;
        data?: { page: MemoRow };
      };
      const created = payload.data?.page;
      if (created) {
        setMemos((prev) => [created, ...prev]);
        setSearchQuery('');
        openMemo(created.id);
      } else {
        refreshMemos();
      }
    } catch (error) {
      setListError(
        error instanceof Error ? error.message : 'メモの作成に失敗しました。'
      );
    } finally {
      setCreatePending(false);
    }
  };

  const handleSave = async () => {
    if (!openPageId || savePending || openRevision === null) {
      return;
    }

    setSavePending(true);
    setSaveError(null);

    const blocks: FlatBlock[] = openText
      ? [
          {
            id: crypto.randomUUID(),
            pageId: openPageId,
            parentBlockId: null,
            type: 'paragraph',
            indent: 0,
            orderIndex: 0,
            content: { text: openText }
          }
        ]
      : [];

    try {
      const response = await fetch(`/api/pages/${openPageId}/blocks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseRevision: openRevision,
          title: openTitle,
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
        updatedAt?: string | Date;
      };
      if (typeof payload.contentRevision === 'number') {
        setOpenRevision(payload.contentRevision);
      }
      if (payload.updatedAt) {
        setOpenUpdatedAt(payload.updatedAt);
      }
      setIsDirty(false);

      const savedId = openPageId;
      const savedTitle = openTitle;
      const savedUpdatedAt = payload.updatedAt ?? new Date().toISOString();
      setMemos((prev) =>
        prev.map((item) =>
          item.id === savedId
            ? { ...item, title: savedTitle, updatedAt: savedUpdatedAt }
            : item
        )
      );
      setSearchResults((prev) =>
        prev.map((item) =>
          item.id === savedId
            ? { ...item, title: savedTitle, updatedAt: savedUpdatedAt }
            : item
        )
      );
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : '保存に失敗しました。'
      );
    } finally {
      setSavePending(false);
    }
  };

  const handleDelete = async (row: MemoRow) => {
    if (deletePendingId) {
      return;
    }
    const shouldDelete = window.confirm(
      `「${row.title || DEFAULT_PAGE_TITLE}」をゴミ箱へ移動しますか？`
    );
    if (!shouldDelete) {
      return;
    }

    setDeletePendingId(row.id);
    setListError(null);
    try {
      const response = await fetch(`/api/pages/${row.id}/trash`, {
        method: 'POST'
      });
      if (!response.ok) {
        throw new Error('削除に失敗しました。');
      }
      setMemos((prev) => prev.filter((item) => item.id !== row.id));
      setSearchResults((prev) => prev.filter((item) => item.id !== row.id));
      if (openPageId === row.id) {
        setOpenPageId(null);
        setIsDirty(false);
      }
    } catch (error) {
      setListError(
        error instanceof Error ? error.message : '削除に失敗しました。'
      );
    } finally {
      setDeletePendingId(null);
    }
  };

  /* Only a pending search empties the grid; a refresh keeps the current rows
     visible so the list never flashes. */
  const isBusy = searchPending;
  const statusText = searchPending
    ? '検索中…'
    : isRefreshing
      ? '更新中…'
      : isSearching
        ? `${rows.length}件の検索結果`
        : `${rows.length}件のメモ`;

  return (
    <div className="notes-grid-page">
      <div className="notes-toolbar">
        <div className="notes-toolbar__search">
          <label className="sr-only" htmlFor="memo-search">
            メモ検索
          </label>
          <input
            className="notes-toolbar__input"
            id="memo-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="メモを検索（2文字以上）"
          />
          {searchQuery ? (
            <button
              className="button button--ghost"
              type="button"
              onClick={() => setSearchQuery('')}
            >
              検索クリア
            </button>
          ) : null}
        </div>
        <div className="notes-toolbar__actions">
          <button
            className="button"
            type="button"
            onClick={handleCreate}
            disabled={createPending}
          >
            {createPending ? '作成中…' : '新規メモ'}
          </button>
          <button
            className="button button--ghost"
            type="button"
            onClick={refreshMemos}
            disabled={isRefreshing}
          >
            再読み込み
          </button>
        </div>
      </div>

      <div className="notes-status" role="status" aria-live="polite">
        {statusText}
      </div>

      {listError ? (
        <p className="notes-alert" role="alert">
          {listError}
        </p>
      ) : null}

      <div className="data-grid-wrap">
        <table className="data-grid">
          <caption className="sr-only">メモ一覧</caption>
          <thead>
            <tr>
              <th scope="col" aria-sort={ariaSort('title')}>
                <button
                  className="data-grid__sort"
                  type="button"
                  onClick={() => handleSort('title')}
                >
                  タイトル
                  <span className="data-grid__sort-mark" aria-hidden="true">
                    {sortKey === 'title'
                      ? sortDirection === 'asc'
                        ? '▲'
                        : '▼'
                      : '↕'}
                  </span>
                </button>
              </th>
              <th
                scope="col"
                className="data-grid__col--meta"
                aria-sort={ariaSort('updatedAt')}
              >
                <button
                  className="data-grid__sort"
                  type="button"
                  onClick={() => handleSort('updatedAt')}
                >
                  最終更新
                  <span className="data-grid__sort-mark" aria-hidden="true">
                    {sortKey === 'updatedAt'
                      ? sortDirection === 'asc'
                        ? '▲'
                        : '▼'
                      : '↕'}
                  </span>
                </button>
              </th>
              <th scope="col" className="data-grid__col--actions">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {isBusy ? (
              <tr>
                <td className="data-grid__message" colSpan={3}>
                  読み込み中…
                </td>
              </tr>
            ) : pagedRows.length === 0 ? (
              <tr>
                <td className="data-grid__message" colSpan={3}>
                  {isSearching
                    ? '検索結果が見つかりませんでした。'
                    : 'メモがありません。「新規メモ」から作成してください。'}
                </td>
              </tr>
            ) : (
              pagedRows.map((row) => (
                <tr
                  key={row.id}
                  className={`data-grid__row ${
                    openPageId === row.id ? 'data-grid__row--open' : ''
                  }`}
                  onClick={() => openMemo(row.id)}
                >
                  <td>
                    <button
                      className="data-grid__title"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openMemo(row.id);
                      }}
                    >
                      {row.title || DEFAULT_PAGE_TITLE}
                    </button>
                  </td>
                  <td className="data-grid__col--meta">
                    {formatUpdatedAt(row.updatedAt)}
                  </td>
                  <td className="data-grid__col--actions">
                    <button
                      className="button button--plain button--small"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDelete(row);
                      }}
                      disabled={deletePendingId === row.id}
                    >
                      {deletePendingId === row.id ? '削除中…' : '削除'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="notes-pager">
        <button
          className="button button--ghost button--small"
          type="button"
          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          disabled={isBusy || safePage === 1}
        >
          前へ
        </button>
        <span className="notes-pager__status">
          {safePage} / {totalPages}
        </span>
        <button
          className="button button--ghost button--small"
          type="button"
          onClick={() =>
            setCurrentPage((prev) => Math.min(totalPages, prev + 1))
          }
          disabled={isBusy || safePage === totalPages}
        >
          次へ
        </button>
      </div>

      {openPageId ? (
        <div
          className="notes-modal"
          role="presentation"
          onMouseDown={() => closeMemo()}
        >
          <div
            className="notes-modal__panel"
            role="dialog"
            aria-modal="true"
            aria-label="メモ編集"
            ref={dialogRef}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="notes-modal__header">
              <span className="notes-modal__title">メモ編集</span>
              <div className="notes-modal__actions">
                <button
                  className="button button--ghost button--small"
                  type="button"
                  onClick={() => void loadMemoDetail(openPageId)}
                  disabled={loadingMemo}
                >
                  再読み込み
                </button>
                <button
                  className="button button--small"
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={loadingMemo || savePending || !isDirty}
                >
                  {savePending ? '保存中…' : '保存'}
                </button>
                <button
                  className="button button--plain button--small"
                  type="button"
                  onClick={() => closeMemo()}
                >
                  閉じる
                </button>
              </div>
            </div>

            <div className="notes-modal__body">
              {loadingMemo ? (
                <p className="notes-modal__placeholder">読み込み中…</p>
              ) : (
                <>
                  <div className="notes-modal__field">
                    <label className="sr-only" htmlFor="memo-title">
                      メモタイトル
                    </label>
                    <input
                      className="notes-modal__title-input"
                      id="memo-title"
                      ref={titleInputRef}
                      value={openTitle}
                      onChange={(event) => {
                        setOpenTitle(event.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="メモのタイトルを入力してください。"
                    />
                  </div>
                  <div className="notes-modal__textarea-wrapper">
                    <label className="sr-only" htmlFor="memo-body">
                      メモの内容
                    </label>
                    <textarea
                      className="notes-modal__textarea"
                      id="memo-body"
                      value={openText}
                      onChange={(event) => {
                        setOpenText(event.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="メモの内容を入力してください。"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="notes-modal__footer">
              <span
                className={`notes-modal__status ${
                  saveError ? 'notes-modal__status--error' : ''
                }`}
                role="status"
                aria-live="polite"
              >
                {saveError
                  ? saveError
                  : isDirty
                    ? '未保存の変更があります。'
                    : '変更は保存済みです。'}
              </span>
              <span className="notes-modal__updated">
                最終更新: {formatUpdatedAt(openUpdatedAt)}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
