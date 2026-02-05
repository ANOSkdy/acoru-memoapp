"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  type BlockType,
  type FlatBlock,
  blockTypes,
} from "@/lib/blocks";

type PageEditorProps = {
  pageId: string;
  initialTitle: string;
  initialBlocks: FlatBlock[];
  initialRevision: number;
  initialIsFavorite: boolean;
  initialTags: { id: string; name: string; color: string | null }[];
  initialTagIds: string[];
};

type SaveStatus = "Saved" | "Saving" | "Error";

const editorBlockTypes = blockTypes.filter(
  (type) => type !== "image"
) as BlockType[];

const blockTypeLabels: Record<BlockType, string> = {
  paragraph: "Paragraph",
  heading: "Heading",
  bulleted_list: "Bulleted list",
  numbered_list: "Numbered list",
  todo: "To-do",
  toggle: "Toggle",
  quote: "Quote",
  divider: "Divider",
  callout: "Callout",
  image: "Image",
};

const createBlock = (pageId: string, type: BlockType): FlatBlock => {
  const id = crypto.randomUUID();
  switch (type) {
    case "heading":
      return {
        id,
        pageId,
        parentBlockId: null,
        type,
        indent: 0,
        orderIndex: 0,
        content: { level: 1, text: "" },
      };
    case "todo":
      return {
        id,
        pageId,
        parentBlockId: null,
        type,
        indent: 0,
        orderIndex: 0,
        content: { text: "", checked: false },
      };
    case "divider":
      return {
        id,
        pageId,
        parentBlockId: null,
        type,
        indent: 0,
        orderIndex: 0,
        content: {},
      };
    case "callout":
      return {
        id,
        pageId,
        parentBlockId: null,
        type,
        indent: 0,
        orderIndex: 0,
        content: { text: "", emoji: "💡" },
      };
    case "image":
      return {
        id,
        pageId,
        parentBlockId: null,
        type,
        indent: 0,
        orderIndex: 0,
        content: { url: "" },
      };
    default:
      return {
        id,
        pageId,
        parentBlockId: null,
        type,
        indent: 0,
        orderIndex: 0,
        content: { text: "" },
      };
  }
};

const getBlockText = (block: FlatBlock) =>
  "text" in block.content ? block.content.text : "";

export default function PageEditor({
  pageId,
  initialTitle,
  initialBlocks,
  initialRevision,
  initialIsFavorite,
  initialTags,
  initialTagIds,
}: PageEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [blocks, setBlocks] = useState<FlatBlock[]>(initialBlocks);
  const [baseRevision, setBaseRevision] = useState(initialRevision);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("Saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflictState, setConflictState] = useState<{
    active: boolean;
    dismissed: boolean;
    serverRevision?: number;
  }>({ active: false, dismissed: false });
  const [autosavePaused, setAutosavePaused] = useState(false);
  const [trashPending, setTrashPending] = useState(false);
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [favoritePending, setFavoritePending] = useState(false);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] =
    useState<string[]>(initialTagIds);
  const [tagsPending, setTagsPending] = useState(false);
  const [tagsError, setTagsError] = useState<string | null>(null);

  const router = useRouter();
  const isSavingRef = useRef(false);
  const skipAutosaveRef = useRef(true);
  const skipNextAutosaveRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);

  const saveNow = useCallback(async () => {
    if (isSavingRef.current) {
      return;
    }

    isSavingRef.current = true;
    setSaveStatus("Saving");
    setSaveError(null);

    const payload = {
      baseRevision,
      title: title.trim(),
      blocks: blocks.map((block, index) => ({
        ...block,
        orderIndex: index,
        pageId,
      })),
    };

    try {
      const response = await fetch(`/api/pages/${pageId}/blocks`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 409) {
        const data = (await response.json()) as { serverRevision?: number };
        setConflictState({
          active: true,
          dismissed: false,
          serverRevision: data.serverRevision,
        });
        setAutosavePaused(true);
        setSaveStatus("Error");
        return;
      }

      if (!response.ok) {
        throw new Error("保存に失敗しました。");
      }

      const data = (await response.json()) as {
        contentRevision: number;
      };

      if (typeof data.contentRevision === "number") {
        setBaseRevision(data.contentRevision);
      }

      setSaveStatus("Saved");
      setAutosavePaused(false);
    } catch (error) {
      setSaveStatus("Error");
      setSaveError(
        error instanceof Error ? error.message : "保存に失敗しました。"
      );
      setAutosavePaused(true);
    } finally {
      isSavingRef.current = false;
    }
  }, [baseRevision, blocks, pageId, title]);

  const reloadFromServer = useCallback(async () => {
    try {
      const [pageResponse, blocksResponse] = await Promise.all([
        fetch(`/api/pages/${pageId}`),
        fetch(`/api/pages/${pageId}/blocks`),
      ]);

      if (!pageResponse.ok || !blocksResponse.ok) {
        throw new Error("最新データの取得に失敗しました。");
      }

      const pageData = (await pageResponse.json()) as {
        page?: { title: string; contentRevision: number; isFavorite?: boolean };
      };
      const blocksData = (await blocksResponse.json()) as {
        blocks?: FlatBlock[];
      };

      if (pageData.page) {
        setTitle(pageData.page.title ?? "");
        if (typeof pageData.page.contentRevision === "number") {
          setBaseRevision(pageData.page.contentRevision);
        }
        if (typeof pageData.page.isFavorite === "boolean") {
          setIsFavorite(pageData.page.isFavorite);
        }
      }

      if (Array.isArray(blocksData.blocks)) {
        setBlocks(blocksData.blocks);
      }

      setConflictState({ active: false, dismissed: false });
      setAutosavePaused(false);
      setSaveStatus("Saved");
      setSaveError(null);
      setFavoriteError(null);
      skipNextAutosaveRef.current = true;
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "再読み込みに失敗しました。"
      );
    }
  }, [pageId]);

  const handleMoveToTrash = useCallback(async () => {
    if (trashPending) {
      return;
    }
    const confirmed = window.confirm(
      "このメモをゴミ箱へ移動します。後で復元できます。"
    );
    if (!confirmed) {
      return;
    }
    setTrashPending(true);
    try {
      const response = await fetch(`/api/pages/${pageId}/trash`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("ゴミ箱への移動に失敗しました。");
      }
      router.push("/notes");
      router.refresh();
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "ゴミ箱への移動に失敗しました。"
      );
    } finally {
      setTrashPending(false);
    }
  }, [pageId, router, trashPending]);

  const handleToggleFavorite = useCallback(async () => {
    if (favoritePending) {
      return;
    }
    setFavoritePending(true);
    setFavoriteError(null);
    try {
      const response = await fetch(`/api/pages/${pageId}/favorite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !isFavorite }),
      });
      if (!response.ok) {
        throw new Error("お気に入りの更新に失敗しました。");
      }
      setIsFavorite((prev) => !prev);
      router.refresh();
    } catch (error) {
      setFavoriteError(
        error instanceof Error
          ? error.message
          : "お気に入りの更新に失敗しました。"
      );
    } finally {
      setFavoritePending(false);
    }
  }, [favoritePending, isFavorite, pageId, router]);

  const handleTagToggle = useCallback(
    async (tagId: string) => {
      if (tagsPending) {
        return;
      }

      const previous = selectedTagIds;
      const next = selectedTagIds.includes(tagId)
        ? selectedTagIds.filter((id) => id !== tagId)
        : [...selectedTagIds, tagId];

      setSelectedTagIds(next);
      setTagsPending(true);
      setTagsError(null);

      try {
        const response = await fetch(`/api/pages/${pageId}/tags`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagIds: next }),
        });

        if (!response.ok) {
          throw new Error("タグの更新に失敗しました。");
        }
      } catch (error) {
        setSelectedTagIds(previous);
        setTagsError(
          error instanceof Error ? error.message : "タグの更新に失敗しました。"
        );
      } finally {
        setTagsPending(false);
      }
    },
    [pageId, selectedTagIds, tagsPending]
  );

  useEffect(() => {
    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false;
      return;
    }

    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }

    if (autosavePaused) {
      return;
    }

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      void saveNow();
    }, 800);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [autosavePaused, blocks, saveNow, title]);

  const updateBlock = (index: number, nextBlock: FlatBlock) => {
    setBlocks((prev) =>
      prev.map((block, currentIndex) =>
        currentIndex === index ? nextBlock : block
      )
    );
  };

  const removeBlock = (index: number) => {
    setBlocks((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleTypeChange = (index: number, type: BlockType) => {
    updateBlock(index, createBlock(pageId, type));
  };

  const handleTextChange = (index: number, text: string) => {
    const block = blocks[index];
    if (!block) {
      return;
    }

    switch (block.type) {
      case "heading":
        updateBlock(index, {
          ...block,
          content: { ...block.content, text },
        });
        return;
      case "todo":
        updateBlock(index, {
          ...block,
          content: { ...block.content, text },
        });
        return;
      case "callout":
        updateBlock(index, {
          ...block,
          content: { ...block.content, text },
        });
        return;
      case "paragraph":
      case "bulleted_list":
      case "numbered_list":
      case "toggle":
      case "quote":
        updateBlock(index, {
          ...block,
          content: { ...block.content, text },
        });
        return;
      default:
        return;
    }
  };

  const handleHeadingLevel = (index: number, level: 1 | 2 | 3) => {
    const block = blocks[index];
    if (!block || block.type !== "heading") {
      return;
    }

    updateBlock(index, {
      ...block,
      content: { ...block.content, level },
    });
  };

  const handleTodoChecked = (index: number, checked: boolean) => {
    const block = blocks[index];
    if (!block || block.type !== "todo") {
      return;
    }

    updateBlock(index, {
      ...block,
      content: { ...block.content, checked },
    });
  };

  const handleCalloutEmoji = (index: number, emoji: string) => {
    const block = blocks[index];
    if (!block || block.type !== "callout") {
      return;
    }

    updateBlock(index, {
      ...block,
      content: { ...block.content, emoji },
    });
  };

  const statusLabel =
    saveStatus === "Saving"
      ? "Saving…"
      : saveStatus === "Error"
        ? "保存に失敗しました。"
        : null;

  return (
    <div className="editor-shell">
      <div className="editor-header">
        <input
          className="editor-title-input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="タイトルを入力"
          aria-label="ページタイトル"
        />
        <div className="editor-status-row">
          {statusLabel && (
            <div className="editor-status">
              <strong>{statusLabel}</strong>
            </div>
          )}
          <div className="editor-actions">
            <button
              className="button button--ghost"
              type="button"
              onClick={handleToggleFavorite}
              disabled={favoritePending}
            >
              {isFavorite ? "★ お気に入り解除" : "☆ お気に入り"}
            </button>
            <button
              className="button button--ghost"
              type="button"
              onClick={handleMoveToTrash}
              disabled={trashPending}
            >
              ゴミ箱へ移動
            </button>
          </div>
        </div>
        <div className="editor-tags-row">
          <details className="editor-tags">
            <summary>Tags</summary>
            <div className="editor-tags__panel">
              {initialTags.length === 0 ? (
                <p className="editor-tags__empty">
                  まだタグがありません。<a href="/tags">/tags</a> で作成します。
                </p>
              ) : (
                <div className="editor-tags__list">
                  {initialTags.map((tag) => {
                    const isChecked = selectedTagIds.includes(tag.id);
                    return (
                      <label className="editor-tags__item" key={tag.id}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleTagToggle(tag.id)}
                          disabled={tagsPending}
                        />
                        <span
                          className="editor-tags__swatch"
                          style={{
                            backgroundColor: tag.color ?? "transparent",
                            borderColor: tag.color
                              ? "transparent"
                              : "var(--color-border)",
                          }}
                        />
                        <span>{tag.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="editor-tags__hint">
                タグの作成は <a href="/tags">/tags</a> から行えます。
              </p>
              {tagsError && (
                <p className="editor-tags__error" role="status">
                  {tagsError}
                </p>
              )}
            </div>
          </details>
          {selectedTagIds.length > 0 && (
            <div className="editor-tags__active">
              {initialTags
                .filter((tag) => selectedTagIds.includes(tag.id))
                .map((tag) => (
                  <span className="editor-tags__badge" key={tag.id}>
                    {tag.name}
                  </span>
                ))}
            </div>
          )}
        </div>
        {favoriteError && (
          <p className="editor-favorite-error" role="status">
            {favoriteError}
          </p>
        )}
      </div>

      {conflictState.active && (
        <div className="editor-banner editor-banner--warning">
          <div>
            保存競合が発生しました。別端末で更新されている可能性があります。
          </div>
          <div className="editor-banner__actions">
            <button className="button" type="button" onClick={reloadFromServer}>
              Reload
            </button>
            <button
              className="button button--ghost"
              type="button"
              onClick={() => {
                setConflictState((prev) => ({
                  ...prev,
                  active: false,
                  dismissed: true,
                }));
                setAutosavePaused(true);
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {!conflictState.active && conflictState.dismissed && (
        <div className="editor-banner editor-banner--muted">
          <div>競合のため自動保存を停止しています。</div>
          <div className="editor-banner__actions">
            <button className="button" type="button" onClick={reloadFromServer}>
              Reload
            </button>
            <button
              className="button button--ghost"
              type="button"
              onClick={() => {
                setAutosavePaused(false);
                void saveNow();
              }}
            >
              Retry Save
            </button>
          </div>
        </div>
      )}

      {saveError && !conflictState.active && !conflictState.dismissed && (
        <div className="editor-banner editor-banner--danger">
          <div>{saveError}</div>
          <div className="editor-banner__actions">
            <button
              className="button"
              type="button"
              onClick={() => {
                setAutosavePaused(false);
                void saveNow();
              }}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <div className="block-list">
        {blocks.map((block, index) => (
          <div className="block-card" key={block.id}>
            <div className="block-row">
              <label className="block-label" htmlFor={`block-type-${block.id}`}>
                Type
              </label>
              <select
                id={`block-type-${block.id}`}
                className="block-select"
                value={block.type}
                onChange={(event) =>
                  handleTypeChange(index, event.target.value as BlockType)
                }
              >
                {editorBlockTypes.map((type) => (
                  <option key={type} value={type}>
                    {blockTypeLabels[type]}
                  </option>
                ))}
              </select>
              <button
                className="button button--ghost"
                type="button"
                onClick={() => removeBlock(index)}
              >
                Delete
              </button>
            </div>

            {block.type === "heading" && (
              <div className="block-row">
                <label className="block-label">Level</label>
                <select
                  className="block-select"
                  value={block.content.level}
                  onChange={(event) =>
                    handleHeadingLevel(
                      index,
                      Number(event.target.value) === 1
                        ? 1
                        : Number(event.target.value) === 2
                          ? 2
                          : 3
                    )
                  }
                >
                  <option value={1}>H1</option>
                  <option value={2}>H2</option>
                  <option value={3}>H3</option>
                </select>
              </div>
            )}

            {block.type === "todo" && (
              <label className="block-row block-row--inline">
                <input
                  type="checkbox"
                  checked={block.content.checked}
                  onChange={(event) =>
                    handleTodoChecked(index, event.target.checked)
                  }
                />
                <span>完了</span>
              </label>
            )}

            {block.type === "callout" && (
              <div className="block-row">
                <label className="block-label" htmlFor={`callout-${block.id}`}>
                  Emoji
                </label>
                <input
                  id={`callout-${block.id}`}
                  className="block-input block-input--small"
                  value={block.content.emoji ?? ""}
                  onChange={(event) =>
                    handleCalloutEmoji(index, event.target.value)
                  }
                />
              </div>
            )}

            {block.type === "divider" ? (
              <div className="block-divider" aria-hidden="true" />
            ) : block.type === "image" ? (
              <div className="block-image">
                {block.content.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={block.content.url} alt={block.content.alt ?? ""} />
                ) : (
                  <span className="block-muted">Image URL is empty.</span>
                )}
              </div>
            ) : (
              <textarea
                className="block-textarea"
                value={getBlockText(block)}
                onChange={(event) => handleTextChange(index, event.target.value)}
                placeholder="テキストを入力"
                rows={block.type === "quote" ? 3 : 2}
              />
            )}
          </div>
        ))}
      </div>

      <button
        className="button editor-add"
        type="button"
        onClick={() =>
          setBlocks((prev) => [...prev, createBlock(pageId, "paragraph")])
        }
      >
        + Add block
      </button>
    </div>
  );
}
