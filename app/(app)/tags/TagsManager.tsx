"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";

type Tag = {
  id: string;
  name: string;
  color: string | null;
};

type TagsManagerProps = {
  initialTags: Tag[];
};

const sortTags = (tags: Tag[]) =>
  [...tags].sort((a, b) => a.name.localeCompare(b.name, "ja"));

export default function TagsManager({ initialTags }: TagsManagerProps) {
  const [tags, setTags] = useState<Tag[]>(() => sortTags(initialTags));
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingColor, setEditingColor] = useState("");

  const editingTag = useMemo(
    () => tags.find((tag) => tag.id === editingTagId) ?? null,
    [editingTagId, tags]
  );

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: color || null }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        tag?: Tag;
        error?: string;
      };

      if (response.status === 409) {
        throw new Error(data.error ?? "同じ名前のタグがすでに存在します。");
      }

      if (!response.ok || !data.tag) {
        throw new Error(data.error ?? "タグの作成に失敗しました。");
      }

      setTags((prev) => sortTags([...prev, data.tag as Tag]));
      setName("");
      setColor("");
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "タグの作成に失敗しました。"
      );
    } finally {
      setPending(false);
    }
  };

  const startEditing = (tag: Tag) => {
    setEditingTagId(tag.id);
    setEditingName(tag.name);
    setEditingColor(tag.color ?? "");
  };

  const cancelEditing = () => {
    setEditingTagId(null);
    setEditingName("");
    setEditingColor("");
  };

  const handleUpdate = async (tagId: string) => {
    if (pending) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/tags/${tagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingName,
          color: editingColor || null,
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        tag?: Tag;
        error?: string;
      };

      if (response.status === 409) {
        throw new Error(data.error ?? "同じ名前のタグがすでに存在します。");
      }

      if (!response.ok || !data.tag) {
        throw new Error(data.error ?? "タグの更新に失敗しました。");
      }

      setTags((prev) =>
        sortTags(prev.map((tag) => (tag.id === tagId ? data.tag! : tag)))
      );
      cancelEditing();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "タグの更新に失敗しました。"
      );
    } finally {
      setPending(false);
    }
  };

  const handleDelete = async (tagId: string) => {
    if (pending) {
      return;
    }

    const confirmed = window.confirm(
      "このタグを削除します。紐付いているメモがある場合は削除できません。"
    );
    if (!confirmed) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/tags/${tagId}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (response.status === 409) {
        throw new Error(
          data.error ?? "このタグはメモに紐付いているため削除できません。"
        );
      }

      if (!response.ok) {
        throw new Error(data.error ?? "タグの削除に失敗しました。");
      }

      setTags((prev) => prev.filter((tag) => tag.id !== tagId));
      if (editingTagId === tagId) {
        cancelEditing();
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "タグの削除に失敗しました。"
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="tags-shell">
      <div className="tags-header">
        <div>
          <div className="badge">Workspace tags</div>
          <h1>タグ管理</h1>
          <p className="tags-subtitle">
            既存タグの管理と、ページへのタグ付けに使うタグを整備します。
          </p>
        </div>
      </div>

      <form className="card tags-form" onSubmit={handleCreate}>
        <div className="tags-form__row">
          <label className="tags-label" htmlFor="tag-name">
            タグ名
          </label>
          <input
            id="tag-name"
            className="tags-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例: 企画"
            required
          />
        </div>
        <div className="tags-form__row">
          <label className="tags-label" htmlFor="tag-color">
            カラー (任意)
          </label>
          <input
            id="tag-color"
            className="tags-input"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            placeholder="#4F46E5"
          />
        </div>
        <div className="tags-form__actions">
          <button className="button" type="submit" disabled={pending}>
            タグを作成
          </button>
        </div>
        {error && (
          <p className="tags-error" role="status">
            {error}
          </p>
        )}
      </form>

      <section className="tags-list card">
        <h2 className="tags-list__title">タグ一覧</h2>
        {tags.length === 0 ? (
          <p className="tags-empty">まだタグがありません。</p>
        ) : (
          <div className="tags-table">
            {tags.map((tag) => {
              const isEditing = tag.id === editingTagId;
              return (
                <div className="tags-row" key={tag.id}>
                  <div className="tags-row__name">
                    {isEditing ? (
                      <input
                        className="tags-input"
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                      />
                    ) : (
                      <span>{tag.name}</span>
                    )}
                  </div>
                  <div className="tags-row__color">
                    {isEditing ? (
                      <input
                        className="tags-input"
                        value={editingColor}
                        onChange={(event) =>
                          setEditingColor(event.target.value)
                        }
                        placeholder="#4F46E5"
                      />
                    ) : (
                      <span className="tags-color">
                        <span
                          className="tags-color__swatch"
                          style={{
                            backgroundColor: tag.color ?? "transparent",
                            borderColor: tag.color
                              ? "transparent"
                              : "var(--color-border)",
                          }}
                        />
                        {tag.color ?? "未設定"}
                      </span>
                    )}
                  </div>
                  <div className="tags-row__actions">
                    {isEditing ? (
                      <>
                        <button
                          className="button button--ghost"
                          type="button"
                          onClick={() => handleUpdate(tag.id)}
                          disabled={pending}
                        >
                          保存
                        </button>
                        <button
                          className="button button--ghost"
                          type="button"
                          onClick={cancelEditing}
                          disabled={pending}
                        >
                          キャンセル
                        </button>
                      </>
                    ) : (
                      <button
                        className="button button--ghost"
                        type="button"
                        onClick={() => startEditing(tag)}
                        disabled={pending}
                      >
                        編集
                      </button>
                    )}
                    <button
                      className="button button--danger"
                      type="button"
                      onClick={() => handleDelete(tag.id)}
                      disabled={pending}
                    >
                      削除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {editingTag && (
          <p className="tags-hint">
            タグ名はワークスペース内で重複できません。
          </p>
        )}
      </section>
    </div>
  );
}
