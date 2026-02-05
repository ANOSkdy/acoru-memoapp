'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { DEFAULT_PAGE_TITLE } from '@/lib/page-title';

type TrashListItem = {
  id: string;
  title: string | null;
  deletedLabel: string;
  updatedLabel: string;
};

type TrashListProps = {
  items: TrashListItem[];
};

export default function TrashList({ items }: TrashListProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleRestore = async (pageId: string) => {
    if (pendingId) {
      return;
    }
    setPendingId(pageId);
    try {
      const response = await fetch(`/api/pages/${pageId}/restore`, {
        method: 'POST'
      });
      if (!response.ok) {
        throw new Error('Restore failed');
      }
      router.refresh();
    } finally {
      setPendingId(null);
    }
  };

  const handleDelete = async (pageId: string) => {
    if (pendingId) {
      return;
    }
    const confirmed = window.confirm(
      'このメモを完全に削除します。復元できません。よろしいですか？'
    );
    if (!confirmed) {
      return;
    }
    setPendingId(pageId);
    try {
      const response = await fetch(`/api/pages/${pageId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error('Delete failed');
      }
      router.refresh();
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="home-list">
      {items.map((item) => (
        <div key={item.id} className="home-list__item">
          <div className="home-list__item-row">
            <div>
              <div className="home-list__title">
                {item.title || DEFAULT_PAGE_TITLE}
              </div>
              <div className="home-list__meta">
                削除日時: {item.deletedLabel}
              </div>
              <div className="home-list__meta">
                最終更新: {item.updatedLabel}
              </div>
            </div>
            <div className="home-list__item-actions">
              <button
                className="button button--ghost"
                type="button"
                onClick={() => handleRestore(item.id)}
                disabled={pendingId === item.id}
              >
                復元
              </button>
              <button
                className="button button--danger"
                type="button"
                onClick={() => handleDelete(item.id)}
                disabled={pendingId === item.id}
              >
                完全削除
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
