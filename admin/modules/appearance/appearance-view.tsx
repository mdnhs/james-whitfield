"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useState } from "react"
import { toast } from "sonner"

import {
  FORM_ACTION,
  PageHeader,
} from "@/admin/components/dashboard/page-header"
import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { usePermission } from "@/admin/lib/actor-context"
import { ApiError } from "@/admin/lib/api-error"
import { parseResponse, themeApi } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import { ConflictDialog } from "@/admin/modules/pages/conflict-dialog"
import { previewSrc, PreviewPane } from "@/admin/modules/pages/preview-pane"
import {
  conflictOf,
  useAutosave,
  type AutosaveState,
} from "@/admin/modules/pages/use-autosave"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { buildAdminTokens, presetAdminColours } from "@/lib/theme/admin"
import { formatOklch } from "@/lib/theme/color"
import { checkTheme, describeIssue, tokenLabel } from "@/lib/theme/checks"
import { PRESET_IDS, PRESETS, type PresetId } from "@/lib/theme/presets"
import {
  ADMIN_RADII,
  type AdminThemeConfig,
  type ThemeConfigValue,
} from "@/lib/theme/schema"
import { presetSiteTheme, resolveSiteTokens } from "@/lib/theme/site"
import { SITE_TOKENS } from "@/lib/theme/tokens"

import { AdminPreview, useLiveAdmin } from "./admin-preview"
import { BrandAssets } from "./brand-assets"
import { ColourField } from "./colour-field"
import { ContrastPanel } from "./contrast-panel"
import { PresetGallery } from "./preset-gallery"
import { themeQuery, type ThemeAdminDoc } from "./queries"
import { ThemeHistory } from "./theme-history"

// Widened: the picks are values, not literals.
const RADII: readonly number[] = ADMIN_RADII
const CARD = "rounded-card flex flex-col gap-4 bg-card p-5"
const BLOCKED = "Publishing is blocked until every pair passes."

// The loader hands the editor a copy fetched for this mount; Review and a
// stale publish remount it on the server's version.
export function AppearanceView({
  autosaveDelay,
}: {
  // Test-only: the debounce before a draft is saved.
  autosaveDelay?: number
}) {
  const query = useQuery(themeQuery())
  const [generation, setGeneration] = useState(0)
  const { refetch } = query
  const reload = useCallback(async () => {
    await refetch()
    setGeneration((g) => g + 1)
  }, [refetch])
  if (query.isPending || (query.isSuccess && !query.isFetchedAfterMount))
    return <CardSkeleton />
  if (query.isError)
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p>{query.error.message}</p>
        <Button variant="outline" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    )
  return (
    <Editor
      key={generation}
      doc={query.data}
      reload={reload}
      delay={autosaveDelay}
    />
  )
}

function statusText(state: AutosaveState, hasDraft: boolean) {
  switch (state.status) {
    case "saving":
      return "Saving…"
    case "pending":
      return "Unsaved changes"
    case "error":
      return "Couldn't save"
    case "conflict":
      return "Changed by someone else"
    case "saved":
      return "Draft saved"
    default:
      return hasDraft ? "Draft saved" : "No draft changes"
  }
}

function Editor({
  doc,
  reload,
  delay,
}: {
  doc: ThemeAdminDoc
  reload(): Promise<void>
  delay?: number
}) {
  const queryClient = useQueryClient()
  const canUpdate = usePermission({ appearance: ["update"] })
  const canPublish = usePermission({ appearance: ["publish"] })
  const [draft, setDraft] = useState(doc.draft as ThemeConfigValue)
  const [tab, setTab] = useState("site")
  const [serverError, setServerError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<object | null>(null)
  const [resetOpen, setResetOpen] = useState(false)

  const autosave = useAutosave<ThemeConfigValue>({
    version: doc.version,
    delay,
    save: async (value, version, options) => {
      const next = await parseResponse(
        themeApi.draft.$put(
          { json: { version, draft: value } },
          options?.keepalive ? { init: { keepalive: true } } : undefined
        )
      )
      queryClient.setQueryData(queryKeys.theme.detail, next)
      return next
    },
  })
  const { state, exclusive } = autosave
  useLiveAdmin(draft.admin)

  const update = (next: ThemeConfigValue) => {
    if (!canUpdate) return
    setDraft(next)
    setServerError(null)
    autosave.schedule(next)
  }

  // Discard, reset and restore answer with the new draft.
  const adopt = (res: ThemeAdminDoc) => {
    queryClient.setQueryData(queryKeys.theme.detail, res)
    autosave.reset(res.version)
    setDraft(res.draft as ThemeConfigValue)
    setServerError(null)
  }
  const replaceWithServer = () => {
    autosave.reset(autosave.getVersion())
    void reload()
  }
  const onError = (error: Error) => {
    if (conflictOf(error)) {
      toast.error("Changed by someone else. Their version is loaded.")
      return replaceWithServer()
    }
    if (error instanceof ApiError && error.code === "VALIDATION_FAILED")
      return setServerError(error.message)
    toast.error(error.message)
  }

  const publish = useMutation({
    mutationFn: () =>
      exclusive((version) =>
        parseResponse(themeApi.publish.$post({ json: { version } }))
      ),
    onSuccess: (res) => {
      queryClient.setQueryData(queryKeys.theme.detail, res)
      void queryClient.invalidateQueries({
        queryKey: queryKeys.theme.revisions,
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.theme.colors })
      setServerError(null)
      toast.success("Theme published")
    },
    onError,
  })
  const discard = useMutation({
    mutationFn: () =>
      exclusive((version) =>
        parseResponse(themeApi.discard.$post({ json: { version } }))
      ),
    onSuccess: adopt,
    onError,
  })
  const reset = useMutation({
    mutationFn: (input: {
      preset: PresetId
      scope: "site" | "admin" | "both"
    }) =>
      exclusive((version) =>
        parseResponse(themeApi.reset.$post({ json: { version, ...input } }))
      ),
    onSuccess: (res) => {
      adopt(res)
      setResetOpen(false)
    },
    onError,
  })
  const restore = useMutation({
    mutationFn: (rev: string) =>
      exclusive((version) =>
        parseResponse(
          themeApi.revisions[":rev"].restore.$post({
            param: { rev },
            json: { version },
          })
        )
      ),
    onSuccess: (res) => {
      adopt(res)
      toast.success("Loaded into the draft")
    },
    onError,
  })

  const previewOnSite = async () => {
    await autosave.flush()
    window.open(previewSrc("/"), "_blank", "noopener")
  }

  const issues = checkTheme(draft)
  const conflictOpen =
    state.status === "conflict" &&
    state.conflict !== null &&
    state.conflict !== dismissed
  const busy =
    publish.isPending ||
    discard.isPending ||
    reset.isPending ||
    restore.isPending

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Appearance"
        description={
          <span role="status" aria-live="polite">
            {statusText(state, doc.hasDraft)}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              className={FORM_ACTION}
              onClick={() => void previewOnSite()}
            >
              Preview on site
            </Button>
            <Button
              variant="outline"
              className={FORM_ACTION}
              disabled={!canUpdate || !doc.hasDraft || busy}
              onClick={() => discard.mutate()}
            >
              Discard draft
            </Button>
            <Button
              variant="outline"
              className={FORM_ACTION}
              disabled={!canUpdate || busy}
              onClick={() => setResetOpen(true)}
            >
              Reset to preset…
            </Button>
            {canPublish ? (
              <Button
                className={FORM_ACTION}
                disabled={
                  busy || state.status === "saving" || issues.length > 0
                }
                onClick={() => publish.mutate()}
              >
                {publish.isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : null}
                Publish
              </Button>
            ) : null}
          </div>
        }
      />

      {issues.length > 0 || serverError ? (
        <div
          role="status"
          className="bg-danger-soft text-danger flex flex-col gap-1 rounded-xl p-4 text-sm"
        >
          <p className="font-semibold">{BLOCKED}</p>
          <p>{serverError ?? describeIssue(issues[0]!)}</p>
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={(next) => setTab(String(next))}>
        <TabsList>
          <TabsTrigger value="site">Site</TabsTrigger>
          <TabsTrigger value="admin">Admin</TabsTrigger>
        </TabsList>
        <TabsContent value="site">
          <div className="grid gap-5 xl:grid-cols-2">
            <fieldset
              disabled={!canUpdate}
              className="flex min-w-0 flex-col gap-5"
            >
              <SiteControls draft={draft} update={update} />
              <ContrastPanel config={draft} scope="site" onChange={update} />
            </fieldset>
            <PreviewPane path="/" refreshKey={state.savedAt} />
          </div>
        </TabsContent>
        <TabsContent value="admin">
          <div className="grid gap-5 xl:grid-cols-2">
            <fieldset
              disabled={!canUpdate}
              className="flex min-w-0 flex-col gap-5"
            >
              <AdminControls draft={draft} update={update} />
              <ContrastPanel config={draft} scope="admin" onChange={update} />
            </fieldset>
            <AdminPreview />
          </div>
        </TabsContent>
      </Tabs>

      <div className="grid gap-5 xl:grid-cols-2">
        <BrandAssets />
        <ThemeHistory
          canRestore={canUpdate && !busy}
          onLoad={(rev) => restore.mutate(rev)}
        />
      </div>

      <ResetDialog
        open={resetOpen}
        pending={reset.isPending}
        onOpenChange={setResetOpen}
        onConfirm={(input) => reset.mutate(input)}
      />
      <ConflictDialog
        conflict={conflictOpen ? state.conflict : null}
        onDismiss={() => setDismissed(state.conflict)}
        onReview={replaceWithServer}
        onOverwrite={() => void autosave.overwrite()}
      />
    </div>
  )
}

function SiteControls({
  draft,
  update,
}: {
  draft: ThemeConfigValue
  update(next: ThemeConfigValue): void
}) {
  const [open, setOpen] = useState(false)
  const { site } = draft
  const resolved = resolveSiteTokens(site)
  const setToken = (
    token: (typeof SITE_TOKENS)[number],
    value: string | null
  ) => {
    const tokens = { ...site.tokens }
    if (value) tokens[token] = value
    else delete tokens[token]
    update({ ...draft, site: { ...site, tokens } })
  }
  return (
    <section aria-label="Site colours" className={CARD}>
      <h2 className="text-card-title">Site colours</h2>
      <PresetGallery
        scope="site"
        value={site.preset}
        onPick={(id) => update({ ...draft, site: presetSiteTheme(id) })}
      />
      <ColourField
        label="Brand"
        value={site.brand}
        fallback={resolved.brand}
        onChange={(brand) => update({ ...draft, site: { ...site, brand } })}
      />
      <details onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary className="cursor-pointer text-sm font-medium">
          Advanced tokens
        </summary>
        {open ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {SITE_TOKENS.map((token) => {
              const label = tokenLabel("site", token)
              const locked = token in site.tokens
              return (
                <ColourField
                  key={token}
                  label={label}
                  value={site.tokens[token] ?? null}
                  fallback={resolved[token]}
                  onChange={(value) => setToken(token, value)}
                  lock={{
                    locked,
                    onToggle: () =>
                      setToken(
                        token,
                        locked ? null : formatOklch(resolved[token])
                      ),
                  }}
                />
              )
            })}
          </div>
        ) : null}
      </details>
    </section>
  )
}

const TINTS = [
  ["preset", "Preset"],
  ["none", "None"],
  ["primary", "Primary"],
] as const
const MODES = [
  ["system", "System"],
  ["light", "Light"],
  ["dark", "Dark"],
] as const

function AdminControls({
  draft,
  update,
}: {
  draft: ThemeConfigValue
  update(next: ThemeConfigValue): void
}) {
  const { admin } = draft
  const set = (patch: Partial<AdminThemeConfig>) =>
    update({ ...draft, admin: { ...admin, ...patch } })
  const tokens = buildAdminTokens(admin, "light")
  const nearest = RADII.reduce(
    (best, r, i) =>
      Math.abs(r - admin.radius) < Math.abs(RADII[best]! - admin.radius)
        ? i
        : best,
    0
  )
  return (
    <section aria-label="Admin colours" className={CARD}>
      <h2 className="text-card-title">Admin colours</h2>
      <PresetGallery
        scope="admin"
        value={admin.preset}
        onPick={(id) => set(presetAdminColours(id))}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <ColourField
          label="Primary"
          value={admin.primary}
          fallback={tokens.primary}
          onChange={(primary) => set({ primary })}
        />
        <ColourField
          label="Accent"
          value={admin.accent}
          fallback={tokens.accent}
          clearable
          onChange={(accent) => set({ accent })}
        />
      </div>
      <Field>
        <FieldLabel id="tint-label">Neutral tint</FieldLabel>
        <RadioGroup
          aria-labelledby="tint-label"
          value={admin.tint}
          onValueChange={(tint) =>
            set({ tint: tint as AdminThemeConfig["tint"] })
          }
          className="flex flex-wrap gap-4"
        >
          {TINTS.map(([value, text]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <RadioGroupItem value={value} /> {text}
            </label>
          ))}
        </RadioGroup>
      </Field>
      <Field>
        <FieldLabel htmlFor="radius">Corner radius</FieldLabel>
        <div className="flex items-center gap-3">
          <input
            id="radius"
            type="range"
            min={0}
            max={RADII.length - 1}
            step={1}
            value={nearest}
            aria-valuetext={`${RADII[nearest]}rem`}
            onChange={(event) =>
              set({ radius: RADII[Number(event.target.value)]! })
            }
            className="w-full max-w-xs accent-primary"
          />
          <output htmlFor="radius" className="text-sm tabular-nums">
            {RADII[nearest]}rem
          </output>
        </div>
      </Field>
      <Field>
        <FieldLabel id="mode-label">Default mode</FieldLabel>
        <RadioGroup
          aria-labelledby="mode-label"
          value={admin.mode}
          onValueChange={(mode) =>
            set({ mode: mode as AdminThemeConfig["mode"] })
          }
          className="flex flex-wrap gap-4"
        >
          {MODES.map(([value, text]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <RadioGroupItem value={value} /> {text}
            </label>
          ))}
        </RadioGroup>
      </Field>
    </section>
  )
}

const PRESET_ITEMS = PRESET_IDS.map((id) => ({
  value: id,
  label: PRESETS[id].label,
}))

function ResetDialog({
  open,
  pending,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  pending: boolean
  onOpenChange(open: boolean): void
  onConfirm(input: { preset: PresetId; scope: "site" | "admin" | "both" }): void
}) {
  const [preset, setPreset] = useState<PresetId>("teal-sage")
  const [scope, setScope] = useState<"site" | "admin" | "both">("both")
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset to preset</DialogTitle>
          <DialogDescription>
            Replaces the draft colours with a preset. Corner radius and default
            mode stay. Nothing goes live until you publish.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="reset-preset">Preset</FieldLabel>
          <Select
            items={PRESET_ITEMS}
            value={preset}
            onValueChange={(next) => setPreset(next as PresetId)}
          >
            <SelectTrigger id="reset-preset" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESET_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel id="reset-scope">Scope</FieldLabel>
          <RadioGroup
            aria-labelledby="reset-scope"
            value={scope}
            onValueChange={(next) => setScope(next as typeof scope)}
            className="flex gap-4"
          >
            {(
              [
                ["site", "Site"],
                ["admin", "Admin"],
                ["both", "Both"],
              ] as const
            ).map(([value, text]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <RadioGroupItem value={value} /> {text}
              </label>
            ))}
          </RadioGroup>
        </Field>
        <DialogFooter>
          <Button
            variant="outline"
            className={FORM_ACTION}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className={FORM_ACTION}
            disabled={pending}
            onClick={() => onConfirm({ preset, scope })}
          >
            Reset draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
