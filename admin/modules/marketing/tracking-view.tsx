"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useId, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"

import {
  PageHeader,
  FORM_ACTION,
} from "@/admin/components/dashboard/page-header"
import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
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

import { trackingQuery, type TrackingAdminDoc } from "./queries"
import { TrackingStatus } from "./tracking-status"

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
        description="IDs and switches go live as soon as you save. Nothing loads until a visitor consents."
      />
      {doc.isError ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p>{doc.error.message}</p>
          <Button variant="outline" onClick={() => void doc.refetch()}>
            Try again
          </Button>
        </div>
      ) : !doc.data ? (
        <CardSkeleton />
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
    <section aria-label="Test event" className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Test the Conversions API</h2>
      <p className="text-sm text-muted-foreground">
        Sends one test event with your test event code. Check it in Meta Events
        Manager under Test events.
      </p>
      <Button
        type="button"
        variant="outline"
        className={`${FORM_ACTION} self-start`}
        disabled={!canUpdate || test.isPending}
        onClick={() => test.mutate()}
      >
        {test.isPending ? <Spinner data-icon="inline-start" /> : null}
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
      <FieldLabel htmlFor={`${ids}-${name}`}>{label}</FieldLabel>
      <Input
        id={`${ids}-${name}`}
        placeholder={placeholder}
        autoComplete="off"
        aria-invalid={Boolean(errors[name]) || undefined}
        {...register(name)}
      />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
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
      <fieldset disabled={!canUpdate} className="min-w-0">
        <FieldGroup>
          {text("gtmId", "GTM container ID", "GTM-XXXXXXX")}
          {toggle("gtm", "Load Google Tag Manager")}
          {text("ga4Id", "GA4 measurement ID", "G-XXXXXXXXXX")}
          {toggle("ga4", "Send GA4 through GTM")}
          {text("metaPixelId", "Meta Pixel ID", "1234567890")}
          {toggle("meta", "Load the Meta Pixel")}
          {toggle("capi", "Send leads with the Conversions API")}
          {text(
            "testEventCode",
            "Test event code",
            "TEST12345",
            "From Events Manager, Test events. Only used by the test button below."
          )}

          <Field data-invalid={Boolean(errors.capiToken) || undefined}>
            <FieldLabel htmlFor={`${ids}-capiToken`}>
              Conversions API access token
            </FieldLabel>
            {!doc.keyAvailable ? (
              <FieldDescription role="note">
                The server has no APP_ENCRYPTION_KEY, so a token can&apos;t be
                stored safely. Ask your developer to set it.
              </FieldDescription>
            ) : null}
            {configured && mode !== "replace" ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium">
                  {mode === "remove"
                    ? "Will be removed when you save"
                    : "Configured ✓"}
                </span>
                {mode === "keep" ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!doc.keyAvailable}
                      onClick={() => setMode("replace")}
                    >
                      Replace token
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setMode("remove")}
                    >
                      Remove token
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setMode("keep")}
                  >
                    Keep token
                  </Button>
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
                  className="max-w-md"
                  aria-invalid={Boolean(errors.capiToken) || undefined}
                  {...register("capiToken")}
                />
                {configured ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      form.setValue("capiToken", "")
                      form.clearErrors("capiToken")
                      setMode("keep")
                    }}
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            ) : null}
            <FieldDescription>
              Write-only: it is encrypted when saved and never shown again.
            </FieldDescription>
            {error("capiToken")}
          </Field>

          {isOwner ? (
            <section
              aria-labelledby={`${ids}-matching`}
              className="flex flex-col gap-3 rounded-xl border p-4"
            >
              <h2 id={`${ids}-matching`} className="text-lg font-semibold">
                Enhanced matching
              </h2>
              <p className="text-sm text-muted-foreground">
                Sends a hashed email and phone number with the lead to Meta.
                Only an owner can change this, and the choice is recorded.
              </p>
              {saved.enhancedMatching.enabled ? (
                <p className="text-sm">
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
          {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
          Save tracking
        </Button>
      ) : null}
    </form>
  )
}
