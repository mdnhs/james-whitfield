import type { FieldOverrides } from "@/admin/components/schema-form/to-fields"
import type { EditableGlobalKey } from "@/lib/content/global-access"

export const GLOBAL_FIELD_UI: Partial<
  Record<EditableGlobalKey, FieldOverrides>
> = {
  site: {
    logo: { label: "Logo" },
    icon: { label: "Favicon" },
    social: { label: "Social profiles" },
  },
  contact: {
    "phone.e164": {
      label: "Phone for links (E.164)",
      placeholder: "+35312345678",
    },
    "hours.weekly": { label: "Opening hours" },
    "hours.weekly.$.days": { label: "Days (1 = Monday … 7 = Sunday)" },
    "hours.summary": { description: "How the site prints the hours." },
    // Phase 3 ruling: the Clinic block's own photo is the single source.
    "clinic.photo": {
      description: "Not shown on the site: the Clinic block's photo is used.",
    },
  },
  footer: {
    "columns.$.source": {
      label: "Links",
      description: '"Navigation" appends the header links (auto sitemap).',
    },
  },
  contactForm: {
    planMessage: {
      description:
        '"{name}", "{price}" and "{unit}" come from the chosen plan.',
    },
  },
  microcopy: {
    readTime: { description: '"{minutes}" is replaced.' },
    showing: { description: '"{shown}" and "{total}" are replaced.' },
  },
  notifications: {
    recipients: { label: "Recipients" },
    includeMessage: {
      label: "Include the message in notification emails",
      description:
        "Off by default: enquiries can contain health information, and email copies leave the admin.",
    },
  },
  consent: {
    version: {
      description:
        "Raise this to ask every visitor again (for example after adding a new tool)",
    },
    reconsentMonths: {
      description: "Ask again after this many months (6 at most)",
    },
  },
  scripts: {
    "snippets.$.src": {
      label: "Script address",
      description:
        "https only, on an allowed host. Leave empty when you paste code below.",
    },
    "snippets.$.inline": { label: "Inline code", widget: "textarea" },
    "snippets.$.placement": {
      label: "When it loads",
      options: [
        { value: "head", label: "Early: as soon as the page is interactive" },
        { value: "body", label: "Late: when the browser is idle" },
      ],
    },
    "snippets.$.category": {
      label: "Needs consent for",
      options: [
        { value: "necessary", label: "Nothing (strictly necessary)" },
        { value: "analytics", label: "Analytics" },
        { value: "marketing", label: "Marketing" },
      ],
    },
    "snippets.$.routes": {
      label: "Pages",
      description:
        'Leave empty for every page. "/insights/*" matches every article.',
    },
    "snippets.$.enabled": { label: "Enabled" },
  },
}
