"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { type FlatBlock } from "@/lib/blocks";

type PageEditorProps = {
  pageId: string;
  initialTitle: string;
  initialBlocks: FlatBlock[];
  initialRevision: number;
};


const getBlockText = (block: FlatBlock) =>
  "text" in block.content ? block.content.text : "";

const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export default function PageEditor({
  pageId,
  initialTitle,
  initialBlocks,
  initialRevision,
}: PageEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [blocks, setBlocks] = useState<FlatBlock[]>(initialBlocks);
  const [baseRevision, setBaseRevision] = useState(initialRevision);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [conflictState, setConflictState] = useState<{
    active: boolean;
    dismissed: boolean;
    serverRevision?: number;
  }>({ active: false, dismissed: false });
  const [trashPending, setTrashPending] = useState(false);

  const router = useRouter();
  const isSavingRef = useRef(false);

  const saveNow = useCallback(async () => {
    if (isSavingRef.current) {
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
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

    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "保存に失敗しました。"
      );
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
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
        page?: { title: string; contentRevision: number };
      };
      const blocksData = (await blocksResponse.json()) as {
        blocks?: FlatBlock[];
      };

      if (pageData.page) {
        setTitle(pageData.page.title ?? "");
        if (typeof pageData.page.contentRevision === "number") {
          setBaseRevision(pageData.page.contentRevision);
        }
      }

      if (Array.isArray(blocksData.blocks)) {
        setBlocks(blocksData.blocks);
      }

      setConflictState({ active: false, dismissed: false });
      setSaveError(null);
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
      router.push("/");
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

  const updateBlock = (index: number, nextBlock: FlatBlock) => {
    setBlocks((prev) =>
      prev.map((block, currentIndex) =>
        currentIndex === index ? nextBlock : block
      )
    );
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

  const handleImageUrlChange = (index: number, url: string) => {
    const block = blocks[index];
    if (!block || block.type !== "image") {
      return;
    }

    updateBlock(index, {
      ...block,
      content: { ...block.content, url },
    });
  };

  const handleImageAltChange = (index: number, alt: string) => {
    const block = blocks[index];
    if (!block || block.type !== "image") {
      return;
    }

    updateBlock(index, {
      ...block,
      content: { ...block.content, alt },
    });
  };

  const handleImageFileChange = (index: number, file: File | null) => {
    if (!file) {
      return;
    }

    if (!ACCEPTED_IMAGE_MIME_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_MIME_TYPES)[number])) {
      setSaveError("PNG/JPEG/WebP/GIF 形式の画像のみ添付できます。");
      return;
    }

    if (file.size > IMAGE_MAX_BYTES) {
      setSaveError("画像サイズは2MB以下にしてください。");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const value = reader.result;
      if (typeof value !== "string") {
        setSaveError("画像の読み込みに失敗しました。");
        return;
      }

      handleImageUrlChange(index, value);
      setSaveError(null);
    };
    reader.onerror = () => {
      setSaveError("画像の読み込みに失敗しました。");
    };

    reader.readAsDataURL(file);
  };

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
          <div className="editor-actions">
            <button
              className="button editor-save"
              type="button"
              onClick={() => void saveNow()}
              disabled={isSaving}
            >
              <span aria-hidden="true">💾</span>
              <span className="sr-only">保存</span>
            </button>
            <button
              className="button button--ghost"
              type="button"
              onClick={handleMoveToTrash}
              disabled={trashPending}
            >
              <span aria-hidden="true">🗑️</span>
              <span className="sr-only">ゴミ箱へ移動</span>
            </button>
          </div>
        </div>
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
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {!conflictState.active && conflictState.dismissed && (
        <div className="editor-banner editor-banner--muted">
          <div>競合のため保存を停止しています。</div>
          <div className="editor-banner__actions">
            <button className="button" type="button" onClick={reloadFromServer}>
              Reload
            </button>
            <button
              className="button button--ghost"
              type="button"
              onClick={() => {
                void saveNow();
              }}
            >
              保存を再試行
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
                void saveNow();
              }}
            >
              保存を再試行
            </button>
          </div>
        </div>
      )}

      <div className="block-list">
        {blocks.map((block, index) => (
          <div className="block-card" key={block.id}>
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
                <div className="block-row block-row--stacked">
                  <label className="block-label" htmlFor={`image-url-${block.id}`}>
                    画像 URL / Data URL
                  </label>
                  <input
                    id={`image-url-${block.id}`}
                    className="block-input"
                    value={block.content.url}
                    onChange={(event) =>
                      handleImageUrlChange(index, event.target.value)
                    }
                    placeholder="https://example.com/image.png"
                  />
                </div>
                <div className="block-row block-row--stacked">
                  <label className="block-label" htmlFor={`image-alt-${block.id}`}>
                    代替テキスト
                  </label>
                  <input
                    id={`image-alt-${block.id}`}
                    className="block-input"
                    value={block.content.alt ?? ""}
                    onChange={(event) =>
                      handleImageAltChange(index, event.target.value)
                    }
                    placeholder="画像の説明（任意）"
                  />
                </div>
                <div className="block-row block-row--stacked">
                  <label className="block-label" htmlFor={`image-file-${block.id}`}>
                    画像を添付（2MB まで）
                  </label>
                  <input
                    id={`image-file-${block.id}`}
                    className="block-file-input"
                    type="file"
                    accept={ACCEPTED_IMAGE_MIME_TYPES.join(",")}
                    onChange={(event) =>
                      handleImageFileChange(index, event.target.files?.[0] ?? null)
                    }
                  />
                </div>

                {block.content.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={block.content.url} alt={block.content.alt ?? ""} />
                ) : (
                  <span className="block-muted">画像URLまたは添付ファイルを指定してください。</span>
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
    </div>
  );
}
