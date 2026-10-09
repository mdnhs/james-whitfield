"use client"

import { toast } from "sonner"
import * as z from "zod"

import { ui } from "@/admin/components/schema-form/registry"
import { SchemaForm } from "@/admin/components/schema-form/schema-form"

// One field per widget, for reviews and visual tests.
const DemoSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Add a title")
    .max(60)
    .register(ui, { label: "Title", placeholder: "Finding calm at work" }),
  excerpt: z.string().max(200).register(ui, {
    label: "Excerpt",
    widget: "textarea",
    description: "Shown on cards and in search results.",
  }),
  readingTime: z
    .number()
    .int()
    .min(1)
    .max(60)
    .register(ui, { label: "Reading time (minutes)" }),
  featured: z
    .boolean()
    .default(false)
    .register(ui, { label: "Feature on the home page" }),
  category: z
    .enum(["stress", "sleep", "work"])
    .register(ui, { label: "Category" }),
  format: z.enum(["online", "in-person"]).register(ui, {
    label: "Session format",
    widget: "radio",
    options: [
      { value: "online", label: "Online" },
      { value: "in-person", label: "In person" },
    ],
  }),
  keyPoints: z
    .array(z.string().max(80))
    .min(1)
    .max(4)
    .register(ui, { label: "Key points" }),
  cta: z
    .object({
      label: z.string().max(30).register(ui, { label: "Button label" }),
      href: z
        .string()
        .max(200)
        .register(ui, { label: "Link", inputType: "url" }),
    })
    .register(ui, { label: "Call to action" }),
})

export function DemoForm() {
  return (
    <SchemaForm
      schema={DemoSchema}
      defaultValues={{
        title: "",
        excerpt: "",
        readingTime: 5,
        featured: false,
        category: "stress",
        format: "online",
        keyPoints: ["Notice the first signs"],
        cta: { label: "Book a session", href: "/contact" },
      }}
      submitLabel="Validate"
      onSubmit={() => {
        toast.success("Looks good")
      }}
    />
  )
}
