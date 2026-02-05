'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { DEFAULT_PAGE_TITLE } from '@/lib/page-title';
import { type PageListItem } from '@/lib/pages';

type NotesListProps = {
  items: PageListItem[];
  showTrash?: boolean;
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

export default function NotesList({ items, showTrash = true }: NotesListProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [favoritePendingId, setFavoritePendingId] = useState<string | null>(
    null
  );

  const handleTrash = async (pageId: string) => {
    if (pendingId) {
      return;
    }
    setPendingId(pageId);
    try {
      const response = await fetch(`/api/pages/${pageId}/trash`, {
        method: 'POST'
      });
      if (!response.ok) {
        throw new Error('Trash failed');
      }
      router.refresh();
    } finally {
      setPendingId(null);
    }
  };

  const handleFavorite = async (pageId: string, isFavorite: boolean) => {
    if (favoritePendingId) {
      return;
    }
    setFavoritePendingId(pageId);
    try {
      const response = await fetch(`/api/pages/${pageId}/favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite })
      });
      if (!response.ok) {
        throw new Error('Favorite failed');
      }
      router.refresh();
    } finally {
      setFavoritePendingId(null);
    }
  };

  return (
    <div className="home-list">
      {items.map((page) => (
        <div key={page.id} className="home-list__item">
          <div className="home-list__item-row">
            <Link className="home-list__item-link" href={`/p/${page.id}`}>
              <div className="home-list__title">
                {page.title || DEFAULT_PAGE_TITLE}
              </div>
              <div className="home-list__meta">
                最終更新: {formatUpdatedAt(page.updatedAt)}
              </div>
            </Link>
            <div className="home-list__item-actions">
              <button
                className="button button--ghost"
                type="button"
                onClick={() => handleFavorite(page.id, !page.isFavorite)}
                disabled={favoritePendingId === page.id}
              >
                {page.isFavorite ? '★ お気に入り解除' : '☆ お気に入り'}
              </button>
              {showTrash && (
              <button
                className="button button--ghost"
                type="button"
                onClick={() => handleTrash(page.id)}
                disabled={pendingId === page.id}
              >
                ゴミ箱へ
              </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
