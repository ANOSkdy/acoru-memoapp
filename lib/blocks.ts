import { z } from 'zod';

export const blockTypes = [
  'paragraph',
  'heading1',
  'heading2',
  'heading3',
  'bulleted',
  'numbered',
  'todo',
  'toggle',
  'quote',
  'divider',
  'callout'
] as const;

export type BlockType = (typeof blockTypes)[number];

const textSchema = z.string().trim().max(2000).default('');

const textBlockTypes = blockTypes.filter(
  (type) => !['todo', 'divider'].includes(type)
) as Exclude<BlockType, 'todo' | 'divider'>[];

const textBlockSchema = z.object({
  type: z.enum(textBlockTypes),
  text: textSchema
});

const todoBlockSchema = z.object({
  type: z.literal('todo'),
  text: textSchema,
  checked: z.boolean().optional()
});

const dividerBlockSchema = z.object({
  type: z.literal('divider')
});

export const blockSchema = z.discriminatedUnion('type', [
  textBlockSchema,
  todoBlockSchema,
  dividerBlockSchema
]);

export type BlockInput = z.infer<typeof blockSchema>;

export const blocksSchema = z.array(blockSchema).max(200);

export type NormalizedBlock = {
  type: BlockType;
  content: {
    text?: string;
    checked?: boolean;
  };
};

export const blockTypeOptions = blockTypes.map((type) => ({
  value: type,
  label: type
    .replace(/([a-z])([0-9])/i, '$1 $2')
    .replace(/(^|_)([a-z])/g, (_, space, letter) =>
      `${space ? ' ' : ''}${letter.toUpperCase()}`
    )
}));

export const normalizeBlocks = (blocks: BlockInput[]): NormalizedBlock[] =>
  blocks.map((block) => {
    if (block.type === 'divider') {
      return { type: 'divider', content: {} };
    }

    if (block.type === 'todo') {
      return {
        type: 'todo',
        content: {
          text: block.text.trim(),
          checked: block.checked ?? false
        }
      };
    }

    return {
      type: block.type,
      content: {
        text: block.text.trim()
      }
    };
  });

export const buildSearchText = (title: string, blocks: NormalizedBlock[]) => {
  const parts = [title.trim()];

  blocks.forEach((block) => {
    if (block.content.text) {
      parts.push(block.content.text);
    }
  });

  return parts
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
};
