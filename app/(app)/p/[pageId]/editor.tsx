'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

import {
  blockTypeOptions,
  type BlockInput,
  type BlockType
} from '@/lib/blocks';

type EditorProps = {
  pageId: string;
  initialTitle: string;
  initialBlocks: BlockInput[];
  initialRevision: number;
};

type EditorBlock = BlockInput & {
  clientId: string;
};

const createClientId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const toEditorBlock = (block: BlockInput): EditorBlock => ({
  ...block,
  clientId: createClientId()
});

const createEmptyBlock = (type: BlockType = 'paragraph'): EditorBlock => {
  if (type === 'divider') {
    return { type: 'divider', clientId: createClientId() };
  }

  if (type === 'todo') {
    return {
      type: 'todo',
      text: '',
      checked: false,
      clientId: createClientId()
    };
  }

  return { type, text: '', clientId: createClientId() };
};

export default function Editor({
  pageId,
  initialTitle,
  initialBlocks,
  initialRevision
}: EditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [blocks, setBlocks] = useState<EditorBlock[]>(() => {
    if (initialBlocks.length > 0) {
      return initialBlocks.map(toEditorBlock);
    }
    return [createEmptyBlock()];
  });
  const [baseRevision, setBaseRevision] = useState(initialRevision);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflictRevision, setConflictRevision] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const inFlightRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  const statusLabel = useMemo(() => {
    if (status === 'saving') return 'Saving…';
    if (status === 'saved') return 'Saved';
    if (status === 'error') return 'Needs attention';
    return 'All changes saved';
  }, [status]);

  const handleSave = useCallback(async () => {
    if (!isDirty || inFlightRef.current || conflictRevision !== null) {
      return;
    }

    inFlightRef.current = true;
    setStatus('saving');
    setErrorMessage(null);

    try {
      const payload = {
        baseRevision,
        title,
        blocks: blocks.map(({ clientId, ...rest }) => rest)
      };

      const response = await fetch(`/api/pages/${pageId}/blocks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 409) {
        setConflictRevision(data.serverRevision ?? baseRevision);
        setStatus('error');
        setErrorMessage('This page was updated elsewhere.');
        return;
      }

      if (!response.ok) {
        setStatus('error');
        setErrorMessage(data.error ?? 'Save failed.');
        return;
      }

      setBaseRevision(data.contentRevision ?? baseRevision + 1);
      setStatus('saved');
      setIsDirty(false);
      setErrorMessage(null);
      window.setTimeout(() => setStatus('idle'), 1200);
    } catch (error) {
      setStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to save changes.'
      );
    } finally {
      inFlightRef.current = false;
    }
  }, [baseRevision, blocks, conflictRevision, isDirty, pageId, title]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      void handleSave();
    }, 800);
  }, [handleSave]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    setIsDirty(true);
    scheduleSave();
  };

  const handleBlockChange = (clientId: string, update: Partial<EditorBlock>) => {
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.clientId !== clientId) {
          return block;
        }

        if (block.type === 'divider') {
          return { type: 'divider', clientId: block.clientId };
        }

        const nextText =
          typeof update.text === 'string' ? update.text : block.text ?? '';

        if (block.type === 'todo') {
          return {
            type: 'todo',
            text: nextText,
            checked:
              typeof update.checked === 'boolean'
                ? update.checked
                : block.checked ?? false,
            clientId: block.clientId
          };
        }

        return {
          type: block.type,
          text: nextText,
          clientId: block.clientId
        };
      })
    );
    setIsDirty(true);
    scheduleSave();
  };

  const handleTypeChange = (clientId: string, nextType: BlockType) => {
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.clientId !== clientId) return block;

        if (nextType === 'divider') {
          return { type: 'divider', clientId: block.clientId };
        }

        if (nextType === 'todo') {
          return {
            type: 'todo',
            text: 'text' in block ? block.text : '',
            checked: 'checked' in block ? block.checked : false,
            clientId: block.clientId
          };
        }

        return {
          type: nextType,
          text: 'text' in block ? block.text : '',
          clientId: block.clientId
        };
      })
    );
    setIsDirty(true);
    scheduleSave();
  };

  const addBlock = () => {
    setBlocks((prev) => [...prev, createEmptyBlock()]);
    setIsDirty(true);
    scheduleSave();
  };

  const removeBlock = (clientId: string) => {
    setBlocks((prev) => {
      const next = prev.filter((block) => block.clientId !== clientId);
      return next.length > 0 ? next : [createEmptyBlock()];
    });
    setIsDirty(true);
    scheduleSave();
  };

  const reloadFromServer = useCallback(async () => {
    setStatus('saving');
    setErrorMessage(null);

    try {
      const [pageResponse, blocksResponse] = await Promise.all([
        fetch(`/api/pages/${pageId}`),
        fetch(`/api/pages/${pageId}/blocks`)
      ]);

      if (!pageResponse.ok || !blocksResponse.ok) {
        throw new Error('Unable to reload the page.');
      }

      const pageData = await pageResponse.json();
      const blocksData = await blocksResponse.json();

      setTitle(pageData.page?.title ?? title);
      const nextBlocks = (blocksData.blocks ?? []).map((block: BlockInput) =>
        toEditorBlock(block)
      );

      setBlocks(nextBlocks.length > 0 ? nextBlocks : [createEmptyBlock()]);
      setBaseRevision(
        blocksData.contentRevision ??
          pageData.page?.contentRevision ??
          baseRevision
      );
      setIsDirty(false);
      setConflictRevision(null);
      setStatus('saved');
      window.setTimeout(() => setStatus('idle'), 1200);
    } catch (error) {
      setStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Reload failed.'
      );
    }
  }, [baseRevision, pageId, title]);

  return (
    <div className="editor">
      <div className="editor__header">
        <input
          className="editor__title"
          value={title}
          onChange={(event) => handleTitleChange(event.target.value)}
          placeholder="Untitled"
        />
        <div className="editor__status">{statusLabel}</div>
      </div>

      {conflictRevision !== null && (
        <div className="editor__banner editor__banner--conflict">
          <div>
            A newer version exists (revision {conflictRevision}). Reload to sync
            before editing again.
          </div>
          <div className="editor__banner-actions">
            <button className="button" type="button" onClick={reloadFromServer}>
              Reload
            </button>
            <button
              className="button button--ghost"
              type="button"
              onClick={() => setConflictRevision(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {errorMessage && conflictRevision === null && (
        <div className="editor__banner editor__banner--error">
          <div>{errorMessage}</div>
          <div className="editor__banner-actions">
            <button className="button" type="button" onClick={handleSave}>
              Retry save
            </button>
          </div>
        </div>
      )}

      <div className="editor__blocks">
        {blocks.map((block) => (
          <div key={block.clientId} className="editor__block">
            <select
              className="editor__select"
              value={block.type}
              onChange={(event) =>
                handleTypeChange(
                  block.clientId,
                  event.target.value as BlockType
                )
              }
            >
              {blockTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {block.type === 'divider' ? (
              <div className="editor__divider">Divider</div>
            ) : (
              <textarea
                className="editor__input"
                value={'text' in block ? block.text : ''}
                placeholder="Write something…"
                rows={1}
                onChange={(event) =>
                  handleBlockChange(block.clientId, { text: event.target.value })
                }
              />
            )}

            {block.type === 'todo' && (
              <label className="editor__checkbox">
                <input
                  type="checkbox"
                  checked={block.checked ?? false}
                  onChange={(event) =>
                    handleBlockChange(block.clientId, {
                      checked: event.target.checked
                    })
                  }
                />
                Done
              </label>
            )}

            <button
              className="button button--ghost"
              type="button"
              onClick={() => removeBlock(block.clientId)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <button className="button" type="button" onClick={addBlock}>
        + Add block
      </button>
    </div>
  );
}
