import { z } from "zod";

export const blockTypes = [
  "paragraph",
  "heading",
  "bulleted_list",
  "numbered_list",
  "todo",
  "toggle",
  "quote",
  "divider",
  "callout",
  "image",
] as const;

export type BlockType = (typeof blockTypes)[number];

export const textBlockTypes = [
  "paragraph",
  "heading",
  "bulleted_list",
  "numbered_list",
  "todo",
  "toggle",
  "quote",
  "callout",
] as const;

export type TextBlockType = (typeof textBlockTypes)[number];

export const paragraphContentSchema = z
  .object({
    text: z.string(),
  })
  .strict();

export const headingContentSchema = z
  .object({
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    text: z.string(),
  })
  .strict();

export const listContentSchema = z
  .object({
    text: z.string(),
  })
  .strict();

export const todoContentSchema = z
  .object({
    text: z.string(),
    checked: z.boolean(),
  })
  .strict();

export const toggleContentSchema = z
  .object({
    text: z.string(),
  })
  .strict();

export const quoteContentSchema = z
  .object({
    text: z.string(),
  })
  .strict();

export const dividerContentSchema = z.object({}).strict();

export const calloutContentSchema = z
  .object({
    text: z.string(),
    emoji: z.string().optional(),
  })
  .strict();

export const imageContentSchema = z
  .object({
    url: z.string(),
    alt: z.string().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  })
  .strict();

export const blockContentSchemaByType = {
  paragraph: paragraphContentSchema,
  heading: headingContentSchema,
  bulleted_list: listContentSchema,
  numbered_list: listContentSchema,
  todo: todoContentSchema,
  toggle: toggleContentSchema,
  quote: quoteContentSchema,
  divider: dividerContentSchema,
  callout: calloutContentSchema,
  image: imageContentSchema,
} as const satisfies Record<BlockType, z.ZodTypeAny>;

const baseBlockSchema = z
  .object({
    id: z.string().uuid(),
    pageId: z.string().uuid(),
    parentBlockId: z.string().uuid().nullable(),
    type: z.enum(blockTypes),
    indent: z.number().int().min(0).max(10),
    orderIndex: z.number().int().min(0),
  })
  .strict();

export const flatBlockSchema = z.discriminatedUnion("type", [
  baseBlockSchema.extend({
    type: z.literal("paragraph"),
    content: paragraphContentSchema,
  }),
  baseBlockSchema.extend({
    type: z.literal("heading"),
    content: headingContentSchema,
  }),
  baseBlockSchema.extend({
    type: z.literal("bulleted_list"),
    content: listContentSchema,
  }),
  baseBlockSchema.extend({
    type: z.literal("numbered_list"),
    content: listContentSchema,
  }),
  baseBlockSchema.extend({
    type: z.literal("todo"),
    content: todoContentSchema,
  }),
  baseBlockSchema.extend({
    type: z.literal("toggle"),
    content: toggleContentSchema,
  }),
  baseBlockSchema.extend({
    type: z.literal("quote"),
    content: quoteContentSchema,
  }),
  baseBlockSchema.extend({
    type: z.literal("divider"),
    content: dividerContentSchema,
  }),
  baseBlockSchema.extend({
    type: z.literal("callout"),
    content: calloutContentSchema,
  }),
  baseBlockSchema.extend({
    type: z.literal("image"),
    content: imageContentSchema,
  }),
]);

export type FlatBlock = z.infer<typeof flatBlockSchema>;

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const toValidParentId = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return uuidRegex.test(trimmed) ? trimmed : null;
};

const clampIndent = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const integer = Math.trunc(value);
  return Math.min(10, Math.max(0, integer));
};

export const normalizeBlocks = (inputBlocks: FlatBlock[]): FlatBlock[] => {
  return inputBlocks.map((block, index) => ({
    ...block,
    indent: clampIndent(block.indent),
    parentBlockId: toValidParentId(block.parentBlockId),
    orderIndex: index,
  }));
};

const MAX_PLAIN_TEXT_LENGTH = 20000;

export const extractPlainText = (blocks: FlatBlock[]): string => {
  const ordered = blocks
    .map((block, index) => ({ block, index }))
    .sort((a, b) => {
      if (a.block.orderIndex !== b.block.orderIndex) {
        return a.block.orderIndex - b.block.orderIndex;
      }
      return a.index - b.index;
    })
    .map(({ block }) => block);

  let output = "";

  for (const block of ordered) {
    if ("text" in block.content) {
      const text = block.content.text.trim();
      if (text) {
        output = output ? `${output}\n${text}` : text;
      }
    }
    if (output.length >= MAX_PLAIN_TEXT_LENGTH) {
      return output.slice(0, MAX_PLAIN_TEXT_LENGTH);
    }
  }

  return output;
};
