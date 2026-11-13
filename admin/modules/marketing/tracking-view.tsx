"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CheckIcon,
  FlaskConicalIcon,
  KeyRoundIcon,
  RefreshCwIcon,
  SaveIcon,
  SendIcon,
  ShieldCheckIcon,
  Trash2Icon,
  Undo2Icon,
  XIcon,
  type LucideIcon,
} from "lucide-react"
import { useId, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"

import { IconTip, InfoHint } from "@/admin/components/actions/icon-tip"
import {
  PageHeader,
  FORM_ACTION,
} from "@/admin/components/dashboard/page-header"
import { subnavIcon } from "@/admin/components/shell/nav-icons"
import { useActor, usePermission } from "@/admin/lib/actor-context"
import { parseResponse, trackingApi } from "@/admin/lib/api"
import { ApiError } from "@/admin/lib/api-error"
import { queryKeys } from "@/admin/lib/query-keys"
import { conflictOf } from "@/admin/modules/pages/use-autosave"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { GA4_ID, GTM_ID, PIXEL_ID } from "@/lib/tracking/ids"
import { cn } from "@/lib/utils"

import { trackingQuery, type TrackingAdminDoc } from "./queries"
import { TrackingStatus } from "./tracking-status"
import { FormCardSkeleton } from "@/admin/components/dashboard/skeletons"

const idField = (pattern: RegExp, message: string) =>
  z
    .string()
    .trim()
    .max(30)
    .refine((v) => v === "" || pattern.test(v), message)

// A client copy of the server's TrackingUpdate["value"] (same ID patterns).
const FormSchema = z.object({
  gtmId: idField(GTM_ID, "Use the GTM-XXXXXXX format"),
  ga4Id: idField(GA4_ID, "Use the G-XXXXXXXXXX format"),
  metaPixelId: idField(PIXEL_ID, "Use the 10–20 digit Pixel ID"),
  testEventCode: z
    .string()
    .trim()
    .max(40)
    .regex(
      /^[A-Z0-9]*$/,
      "Use the code from Events Manager (letters and digits)"
    ),
  enabled: z.object({
    gtm: z.boolean(),
    ga4: z.boolean(),
    meta: z.boolean(),
    capi: z.boolean(),
  }),
  // Write-only: never prefilled.
  capiToken: z
    .string()
    .trim()
    .max(500)
    .refine(
      (v) => v === "" || v.length >= 20,
      "Access tokens are longer than this"
    ),
  matching: z.boolean(),
  acknowledge: z.boolean(),
})
type FormValues = z.infer<typeof FormSchema>

const ACK_TEXT =
  "I confirm the practice's DPO or legal adviser approved sending hashed email and phone numbers to Meta"

const CONFLICT_TEXT =
  "Someone else saved this a moment ago. Their version is loaded; make your change again."

export function TrackingView() {
  const doc = useQuery(trackingQuery())
  const queryClient = useQueryClient()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tracking"
        icon={subnavIcon("marketing-tracking")}
        description="Live on save. Nothing loads before consent."
      />
      {doc.isError ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p>{doc.error.message}</p>
          <Button variant="outline" onClick={() => void doc.refetch()}>
            Try again
          </Button>
        </div>
      ) : !doc.data ? (
        <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <FormCardSkeleton fields={5} />
          <FormCardSkeleton fields={2} />
        </div>
      ) : (
        <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <TrackingForm
            key={doc.data.version}
            doc={doc.data}
            reload={() =>
              queryClient.invalidateQueries({
                queryKey: queryKeys.tracking.detail,
              })
            }
          />
          <div className="flex flex-col gap-6">
            <TrackingStatus doc={doc.data} />
            <TestEvent />
          </div>
        </div>
      )}
    </div>
  )
}

function TestEvent() {
  const canUpdate = usePermission({ tracking: ["update"] })
  const test = useMutation({
    mutationFn: () => parseResponse(trackingApi["test-capi"].$post()),
    onSuccess: (result) =>
      result.ok ? toast.success(result.message) : toast.error(result.message),
    onError: (error) => {
      const first =
        error instanceof ApiError
          ? Object.values(error.fieldErrors ?? {})[0]?.[0]
          : undefined
      toast.error(first ?? error.message)
    },
  })
  return (
    <section
      aria-label="Test event"
      className="rounded-card flex flex-col gap-3 bg-card p-5 sm:p-6"
    >
      <div className="flex items-center gap-1">
        <h2 className="text-card-title flex items-center gap-2">
          <FlaskConicalIcon
            aria-hidden
            className="size-4 text-muted-foreground"
          />
          Test the Conversions API
        </h2>
        <InfoHint id="tracking-test-event-hint">
          Sends one test event with your test event code. Check it in Meta
          Events Manager under Test events.
        </InfoHint>
      </div>
      <Button
        type="button"
        variant="outline"
        className={`${FORM_ACTION} self-start`}
        disabled={!canUpdate || test.isPending}
        onClick={() => test.mutate()}
      >
        {test.isPending ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <SendIcon aria-hidden data-icon="inline-start" />
        )}
        Send test event
      </Button>
    </section>
  )
}

type TokenMode = "keep" | "replace" | "remove"

function TrackingForm({
  doc,
  reload,
}: {
  doc: TrackingAdminDoc
  reload: () => Promise<unknown>
}) {
  const ids = useId()
  const actor = useActor()
  const canUpdate = usePermission({ tracking: ["update"] })
  const isOwner = actor.roles.includes("owner")
  const [mode, setMode] = useState<TokenMode>("keep")
  const [formError, setFormError] = useState<string | null>(null)
  const saved = doc.value
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    mode: "onTouched",
    defaultValues: {
      gtmId: saved.gtmId,
      ga4Id: saved.ga4Id,
      metaPixelId: saved.metaPixelId,
      testEventCode: saved.testEventCode,
      enabled: saved.enabled,
      capiToken: "",
      matching: saved.enhancedMatching.enabled,
      acknowledge: false,
    },
  })
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form
  const matching = useWatch({ control, name: "matching" })
  const acknowledged = useWatch({ control, name: "acknowledge" })
  const configured = doc.capiToken.configured
  const showTokenInput = !configured || mode === "replace"

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    if (showTokenInput && configured && values.capiToken === "") {
      setError("capiToken", { message: "Paste the new token, or cancel" })
      return
    }
    const capiToken =
      mode === "remove" ? null : values.capiToken ? values.capiToken : undefined
    const matchingChanged =
      isOwner && values.matching !== saved.enhancedMatching.enabled
    try {
      await parseResponse(
        trackingApi.index.$put({
          json: {
            version: doc.version,
            value: {
              gtmId: values.gtmId,
              ga4Id: values.ga4Id,
              metaPixelId: values.metaPixelId,
              testEventCode: values.testEventCode,
              enabled: values.enabled,
            },
            ...(capiToken !== undefined ? { capiToken } : {}),
            ...(matchingChanged
              ? {
                  enhancedMatching: {
                    enabled: values.matching,
                    acknowledge: values.acknowledge,
                  },
                }
              : {}),
          },
        })
      )
      toast.success("Tracking saved")
      await reload()
    } catch (error) {
      if (conflictOf(error)) {
        await reload()
        toast.error(CONFLICT_TEXT)
        return
      }
      if (!(error instanceof ApiError)) throw error
      setFormError(error.message)
      for (const [name, messages] of Object.entries(error.fieldErrors ?? {})) {
        const field =
          name === "enhancedMatching.acknowledge"
            ? "acknowledge"
            : (name as keyof FormValues)
        if (messages[0] && field in values)
          setError(field, { message: messages[0] })
      }
    }
  })

  const error = (name: keyof FormValues) => {
    const message = errors[name]?.message
    return message ? <FieldError>{message}</FieldError> : null
  }
  const text = (
    name: "gtmId" | "ga4Id" | "metaPixelId" | "testEventCode",
    label: string,
    placeholder: string,
    description?: string
  ) => (
    <Field data-invalid={Boolean(errors[name]) || undefined}>
      {description ? (
        <LabelWithHint
          htmlFor={`${ids}-${name}`}
          hintId={`${ids}-${name}-hint`}
          hint={description}
        >
          {label}
        </LabelWithHint>
      ) : (
        <FieldLabel htmlFor={`${ids}-${name}`}>{label}</FieldLabel>
      )}
      <Input
        id={`${ids}-${name}`}
        placeholder={placeholder}
        autoComplete="off"
        aria-invalid={Boolean(errors[name]) || undefined}
        aria-describedby={description ? `${ids}-${name}-hint` : undefined}
        {...register(name)}
      />
      {error(name)}
    </Field>
  )
  const toggle = (name: keyof FormValues["enabled"], label: string) => (
    <Controller
      control={control}
      name={`enabled.${name}`}
      render={({ field }) => (
        <Field orientation="horizontal">
          <Switch
            id={`${ids}-${name}`}
            checked={field.value}
            onCheckedChange={field.onChange}
          />
          <FieldLabel htmlFor={`${ids}-${name}`}>{label}</FieldLabel>
        </Field>
      )}
    />
  )

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <fieldset
        disabled={!canUpdate}
        className="rounded-card min-w-0 bg-card p-5 sm:p-6"
      >
        <FieldGroup>
          {/* Each ID beside its own switch once the form is wide enough. */}
          <div className="@container/track">
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 @xl/track:grid-cols-2 @xl/track:items-end">
              {text("gtmId", "GTM container ID", "GTM-XXXXXXX")}
              {toggle("gtm", "Load Google Tag Manager")}
              {text("ga4Id", "GA4 measurement ID", "G-XXXXXXXXXX")}
              {toggle("ga4", "Send GA4 through GTM")}
              {text("metaPixelId", "Meta Pixel ID", "1234567890")}
              {toggle("meta", "Load the Meta Pixel")}
              {text(
                "testEventCode",
                "Test event code",
                "TEST12345",
                "From Events Manager, Test events. Only used by the test button."
              )}
              {toggle("capi", "Send leads with the Conversions API")}
            </div>
          </div>

          <Field data-invalid={Boolean(errors.capiToken) || undefined}>
            <LabelWithHint
              htmlFor={`${ids}-capiToken`}
              hintId={`${ids}-capiToken-hint`}
              hint="Write-only: it is encrypted when saved and never shown again."
            >
              Conversions API access token
            </LabelWithHint>
            {!doc.keyAvailable ? (
              <FieldDescription role="note">
                The server has no APP_ENCRYPTION_KEY, so a token can&apos;t be
                stored safely. Ask your developer to set it.
              </FieldDescription>
            ) : null}
            {configured && mode !== "replace" ? (
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 text-sm font-medium",
                    mode === "remove" ? "text-danger" : "text-success"
                  )}
                >
                  {mode === "remove" ? (
                    <Trash2Icon aria-hidden className="size-4" />
                  ) : (
                    <KeyRoundIcon aria-hidden className="size-4" />
                  )}
                  {mode === "remove"
                    ? "Will be removed when you save"
                    : "Configured ✓"}
                </span>
                {mode === "keep" ? (
                  <>
                    <TokenAction
                      label="Replace token"
                      icon={RefreshCwIcon}
                      disabled={!doc.keyAvailable}
                      onClick={() => setMode("replace")}
                    />
                    <TokenAction
                      label="Remove token"
                      icon={Trash2Icon}
                      danger
                      onClick={() => setMode("remove")}
                    />
                  </>
                ) : (
                  <TokenAction
                    label="Keep token"
                    icon={Undo2Icon}
                    onClick={() => setMode("keep")}
                  />
                )}
              </div>
            ) : null}
            {showTokenInput ? (
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  id={`${ids}-capiToken`}
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={!doc.keyAvailable}
                  className="max-w-md flex-1"
                  aria-invalid={Boolean(errors.capiToken) || undefined}
                  aria-describedby={`${ids}-capiToken-hint`}
                  {...register("capiToken")}
                />
                {configured ? (
                  <TokenAction
                    label="Cancel"
                    icon={XIcon}
                    onClick={() => {
                      form.setValue("capiToken", "")
                      form.clearErrors("capiToken")
                      setMode("keep")
                    }}
                  />
                ) : null}
              </div>
            ) : null}
            {error("capiToken")}
          </Field>

          {isOwner ? (
            <section
              aria-labelledby={`${ids}-matching`}
              className="flex flex-col gap-3 rounded-xl border p-4"
            >
              <div className="flex items-center gap-1">
                <h2
                  id={`${ids}-matching`}
                  className="text-card-title flex items-center gap-2"
                >
                  <ShieldCheckIcon
                    aria-hidden
                    className="size-4 text-muted-foreground"
                  />
                  Enhanced matching
                </h2>
                <InfoHint id={`${ids}-matching-hint`}>
                  Sends a hashed email and phone number with the lead to Meta.
                  Only an owner can change this, and the choice is recorded.
                </InfoHint>
              </div>
              {saved.enhancedMatching.enabled ? (
                <p className="flex items-center gap-1.5 text-sm">
                  <CheckIcon aria-hidden className="text-success size-4" />
                  Approved by {saved.enhancedMatching.acknowledgedBy}
                </p>
              ) : null}
              <Controller
                control={control}
                name="acknowledge"
                render={({ field }) => (
                  <Field orientation="horizontal">
                    <Checkbox
                      id={`${ids}-ack`}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                    <FieldLabel htmlFor={`${ids}-ack`}>{ACK_TEXT}</FieldLabel>
                  </Field>
                )}
              />
              {error("acknowledge")}
              <Controller
                control={control}
                name="matching"
                render={({ field }) => (
                  <Field orientation="horizontal">
                    <Switch
                      id={`${ids}-matching-switch`}
                      checked={field.value}
                      disabled={!matching && !acknowledged}
                      onCheckedChange={field.onChange}
                    />
                    <FieldContent>
                      <FieldLabel htmlFor={`${ids}-matching-switch`}>
                        Send hashed email and phone numbers with leads
                      </FieldLabel>
                    </FieldContent>
                  </Field>
                )}
              />
            </section>
          ) : null}
        </FieldGroup>
      </fieldset>
      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      {canUpdate ? (
        <Button
          type="submit"
          className={`${FORM_ACTION} self-start`}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <SaveIcon aria-hidden data-icon="inline-start" />
          )}
          Save tracking
        </Button>
      ) : null}
    </form>
  )
}

// The token's Replace / Remove / Keep / Cancel as icon buttons; the label is
// the accessible name and the tooltip.
function TokenAction({
  label,
  icon: Icon,
  danger,
  disabled,
  onClick,
}: {
  label: string
  icon: LucideIcon
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <IconTip label={label}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={label}
        disabled={disabled}
        className={cn(
          danger &&
            "hover:bg-danger-soft hover:text-danger text-muted-foreground"
        )}
        onClick={onClick}
      >
        <Icon aria-hidden />
      </Button>
    </IconTip>
  )
}

// A label with its help behind an info icon (as the schema forms).
function LabelWithHint({
  htmlFor,
  hintId,
  hint,
  children,
}: {
  htmlFor: string
  hintId: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-1">
      <FieldLabel htmlFor={htmlFor}>{children}</FieldLabel>
      <InfoHint id={hintId}>{hint}</InfoHint>
    </div>
  )
}
