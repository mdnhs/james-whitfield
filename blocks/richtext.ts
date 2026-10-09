// blocks/richtext.ts
import * as z from "zod"

import { defineBlock } from "./define-block"
import { RichTextDoc } from "./rich-text"

export const richtext = defineBlock({
  type: "richtext",
  label: "Rich text",
  icon: "Pilcrow",
  schema: z.object({ doc: RichTextDoc, width: z.enum(["narrow", "wide"]) }),
  allowedOn: ["custom"],
  uses: [],
})
