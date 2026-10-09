import {
  Focal,
  IconField,
  LinkValue,
  MediaRef,
  Selection,
  StatValue,
  Tint,
} from "@/blocks/fields"
import { RichTextDoc } from "@/blocks/rich-text"

import { ui } from "./registry"

// Shared field schemas → widgets, once for every form (blocks, globals,
// collections reuse the same instances). Labels come from the field name.
ui.add(MediaRef, { widget: "media" })
ui.add(LinkValue, { widget: "link" })
ui.add(IconField, { widget: "icon" })
ui.add(StatValue, { widget: "stat" })
ui.add(Focal, { widget: "focal" })
ui.add(RichTextDoc, { widget: "richtext" })
ui.add(Selection, { widget: "collection" })
ui.add(Tint, { widget: "number", step: 0.05 })
