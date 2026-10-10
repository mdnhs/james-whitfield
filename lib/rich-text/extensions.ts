import type { Extensions } from "@tiptap/core"
import Image from "@tiptap/extension-image"
import StarterKit from "@tiptap/starter-kit"

// Only what blocks/rich-text.ts accepts: paragraphs, h2/h3, bullet lists,
// quotes, bold, italic and links (docs/brief.md §15: rendered statically,
// never as HTML). Shared by the admin editors and the site's renderer, so
// both read the same schema.
export const richTextStarterKit = StarterKit.configure({
  heading: { levels: [2, 3] },
  code: false,
  codeBlock: false,
  strike: false,
  underline: false,
  horizontalRule: false,
  orderedList: false,
  hardBreak: false,
  link: { openOnClick: false, autolink: false },
})

// Images from the media library (Ruling R8): the library id travels in attrs.
export const ArticleImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      mediaId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-media-id"),
        renderHTML: (attrs: { mediaId?: string | null }) =>
          attrs.mediaId ? { "data-media-id": attrs.mediaId } : {},
      },
    }
  },
}).configure({ inline: false, allowBase64: false })

export const articleExtensions: Extensions = [richTextStarterKit, ArticleImage]
