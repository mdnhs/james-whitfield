// blocks/rich-text.ts
import * as z from "zod"

import { Href } from "./fields"

// The subset of TipTap/ProseMirror JSON the site renders (article bodies and
// the richtext block). Phase 5's editor produces exactly these nodes.
const Mark = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }),
  z.object({ type: z.literal("italic") }),
  z.object({ type: z.literal("link"), attrs: z.object({ href: Href }) }),
])
const TextNode = z.object({
  type: z.literal("text"),
  text: z.string().min(1).max(5000),
  marks: z.array(Mark).max(3).optional(),
})
export const Paragraph = z.object({
  type: z.literal("paragraph"),
  content: z.array(TextNode).max(50).optional(),
})
export const Heading = z.object({
  type: z.literal("heading"),
  attrs: z.object({ level: z.union([z.literal(2), z.literal(3)]) }),
  content: z.array(TextNode).max(20).optional(),
})
export const ListItem = z.object({
  type: z.literal("listItem"),
  content: z.array(Paragraph).min(1).max(5),
})
export const BulletList = z.object({
  type: z.literal("bulletList"),
  content: z.array(ListItem).min(1).max(30),
})
export const Blockquote = z.object({
  type: z.literal("blockquote"),
  content: z.array(Paragraph).min(1).max(5),
})

export const RichTextDoc = z.object({
  type: z.literal("doc"),
  content: z
    .array(
      z.discriminatedUnion("type", [Paragraph, Heading, BulletList, Blockquote])
    )
    .max(400),
})

export type RichTextDoc = z.infer<typeof RichTextDoc>
export type RichTextNode = RichTextDoc["content"][number]
export type RichTextInline = z.infer<typeof TextNode>

// Article bodies only (Phase 5): an image from the media library, stored as
// { mediaId } inside attrs so the media usage scan and delete guard see it.
// src/alt are the editor's display copy; the site renders the library asset.
// Other TipTap image attrs (title, width, height) are stripped.
export const ImageNode = z.object({
  type: z.literal("image"),
  attrs: z.object({
    mediaId: z.uuid(),
    src: z.string().max(2048).nullish(),
    alt: z.string().max(300).nullish(),
  }),
})
export const ArticleBodyDoc = z.object({
  type: z.literal("doc"),
  content: z
    .array(
      z.discriminatedUnion("type", [
        Paragraph,
        Heading,
        BulletList,
        Blockquote,
        ImageNode,
      ])
    )
    .max(400),
})
export type ArticleBodyDoc = z.infer<typeof ArticleBodyDoc>
export type ArticleBodyNode = ArticleBodyDoc["content"][number]
