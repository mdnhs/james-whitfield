// Fills "{name}" placeholders in editable copy (microcopy, form messages).
export const fill = (
  template: string,
  values: Record<string, string | number>
) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : match
  )
