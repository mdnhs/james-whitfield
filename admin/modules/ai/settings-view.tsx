// admin/modules/ai/settings-view.tsx
"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useId, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import {
  FORM_ACTION,
  PageHeader,
} from "@/admin/components/dashboard/page-header"
import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { useActor } from "@/admin/lib/actor-context"
import { aiApi, parseResponse } from "@/admin/lib/api"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ROLE_LABELS } from "@/lib/auth/role-labels"
import {
  AI_PROVIDERS,
  baseUrlProblem,
  DEFAULT_MODEL,
  GATED_ROLES,
  GEMINI_FREE_TIER_WARNING,
  ModelId,
  normaliseBaseUrl,
  OUTPUT_TOKENS,
  PROVIDER_LABELS,
  type AiProvider,
} from "@/lib/ai/schema"
import type { RoleName } from "@/lib/auth/permissions"
import type { AiAdmin } from "@/server/modules/ai/service"

type KeyMode = "keep" | "replace" | "remove"
type Values = {
  enabled: boolean
  provider: AiProvider
  model: string
  baseUrl: string
  apiKey: string
  allowedRoles: RoleName[]
  share: boolean
  acknowledge: boolean
  systemPrompt: string
  maxOutputTokens: number
}
// Ruling R15: the acknowledgement names the retention consequence too.
const SHARE_ACK =
  "I confirm the practice's DPO or legal adviser approved sending enquirers' first names, topics and messages to the AI provider. I understand conversations may then contain enquiry details and are kept for up to 90 days."

export function AiSettingsView() {
  const doc = useQuery({
    queryKey: queryKeys.ai.settings,
    queryFn: () => parseResponse(aiApi.settings.$get()),
    staleTime: 0,
  })
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="AI assistant"
        description="Choose the provider and model, add your own API key, and decide who can use it. The assistant can read the site but never changes it."
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
        <SettingsForm key={doc.data.version} doc={doc.data} />
      )}
    </div>
  )
}

function SettingsForm({ doc }: { doc: AiAdmin }) {
  const ids = useId()
  const actor = useActor()
  const isOwner = actor.roles.includes("owner")
  const queryClient = useQueryClient()
  const [keyMode, setKeyMode] = useState<KeyMode>(
    doc.apiKey.hasKey ? "keep" : "replace"
  )
  const [models, setModels] = useState<string[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const saved = doc.value
  const form = useForm<Values>({
    mode: "onTouched",
    defaultValues: {
      enabled: saved.enabled,
      provider: saved.provider,
      model: saved.model,
      baseUrl: saved.baseUrl,
      apiKey: "",
      allowedRoles: saved.allowedRoles,
      share: saved.shareEnquiryDetails.enabled,
      acknowledge: false,
      systemPrompt: saved.systemPrompt,
      maxOutputTokens: saved.maxOutputTokens,
    },
  })
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = form
  const provider = useWatch({ control, name: "provider" })
  const share = useWatch({ control, name: "share" })
  const baseUrl = useWatch({ control, name: "baseUrl" })
  const newKey = useWatch({ control, name: "apiKey" })
  const oac = provider === "openai-compatible"
  // Ruling R3: a different provider or host never inherits the saved key.
  const keyFollows =
    provider === saved.provider &&
    (!oac || normaliseBaseUrl(baseUrl) === saved.baseUrl)
  const showKeyInput =
    !doc.apiKey.hasKey || !keyFollows || keyMode === "replace"
  const losesKey =
    doc.apiKey.hasKey && !keyFollows && keyMode !== "remove" && !newKey.trim()

  const listModels = useMutation({
    mutationFn: () => {
      const v = form.getValues()
      return parseResponse(
        aiApi.settings.models.$post({
          json: {
            provider: v.provider,
            baseUrl: v.baseUrl,
            ...(v.apiKey.trim() ? { apiKey: v.apiKey.trim() } : {}),
          },
        })
      )
    },
    onSuccess: (r) =>
      r.ok
        ? (setModels(r.models),
          toast.success(`${r.models.length} models found`))
        : toast.error(r.message),
    onError: (e) =>
      toast.error(
        e instanceof ApiError
          ? (Object.values(e.fieldErrors ?? {})[0]?.[0] ?? e.message)
          : e.message
      ),
  })
  const test = useMutation({
    mutationFn: () => parseResponse(aiApi.settings.test.$post()),
    onSuccess: (r) =>
      r.ok ? toast.success(r.message) : toast.error(r.message),
    onError: (e) => toast.error(e.message),
  })

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null)
    const key = v.apiKey.trim()
    try {
      await parseResponse(
        aiApi.settings.$put({
          json: {
            version: doc.version,
            enabled: v.enabled,
            provider: v.provider,
            model: v.model.trim(),
            baseUrl: oac ? v.baseUrl.trim() : "",
            ...(showKeyInput && key
              ? { apiKey: key }
              : keyMode === "remove"
                ? { apiKey: null }
                : {}),
            allowedRoles: v.allowedRoles,
            ...(v.share !== saved.shareEnquiryDetails.enabled
              ? {
                  shareEnquiryDetails: {
                    enabled: v.share,
                    acknowledge: v.acknowledge,
                  },
                }
              : {}),
            systemPrompt: v.systemPrompt,
            maxOutputTokens: Number(v.maxOutputTokens),
          },
        })
      )
      toast.success("Saved")
      // The prefix refreshes status (topbar), settings and the history list.
      await queryClient.invalidateQueries({ queryKey: ["ai"] })
    } catch (e) {
      if (conflictOf(e))
        return setFormError(
          "Someone else saved these settings. Reload to see their changes."
        )
      if (e instanceof ApiError && e.fieldErrors) {
        for (const [field, messages] of Object.entries(e.fieldErrors)) {
          const name =
            field === "shareEnquiryDetails.acknowledge" ? "acknowledge" : field
          setError(name as keyof Values, { message: messages[0] })
        }
      }
      setFormError(e instanceof Error ? e.message : "Couldn't save")
    }
  })

  return (
    <form
      onSubmit={onSubmit}
      className="flex max-w-2xl flex-col gap-8"
      noValidate
    >
      <FieldGroup>
        <Controller
          control={control}
          name="enabled"
          render={({ field }) => (
            <Field orientation="horizontal">
              <Switch
                id={`${ids}-enabled`}
                checked={field.value}
                onCheckedChange={field.onChange}
                aria-describedby={`${ids}-enabled-e`}
              />
              <FieldLabel htmlFor={`${ids}-enabled`}>
                Turn on the AI assistant
              </FieldLabel>
              <FieldError id={`${ids}-enabled-e`}>
                {errors.enabled?.message}
              </FieldError>
            </Field>
          )}
        />

        <Controller
          control={control}
          name="provider"
          render={({ field }) => (
            <Field>
              <FieldLabel id={`${ids}-provider`}>Provider</FieldLabel>
              <RadioGroup
                aria-labelledby={`${ids}-provider`}
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value)
                  setValue("model", DEFAULT_MODEL[value as AiProvider], {
                    shouldDirty: true,
                  })
                  setModels([])
                }}
              >
                {AI_PROVIDERS.map((p) => (
                  <label key={p} className="flex items-center gap-2">
                    <RadioGroupItem value={p} />
                    {PROVIDER_LABELS[p]}
                  </label>
                ))}
              </RadioGroup>
            </Field>
          )}
        />
        {provider === "google" ? (
          <p role="note" className="text-sm text-muted-foreground">
            {GEMINI_FREE_TIER_WARNING}
          </p>
        ) : null}

        {oac ? (
          <Field>
            <FieldLabel htmlFor={`${ids}-base`}>Base URL</FieldLabel>
            <Input
              id={`${ids}-base`}
              placeholder="https://api.groq.com/openai/v1"
              {...register("baseUrl", {
                validate: (v) =>
                  baseUrlProblem(v, doc.localHttpAllowed) ?? true,
              })}
            />
            <FieldDescription>
              OpenAI, Groq, OpenRouter, DeepSeek, Mistral, Together, Ollama or
              LM Studio. Use the address that ends before /chat/completions.
            </FieldDescription>
            <FieldError>{errors.baseUrl?.message}</FieldError>
          </Field>
        ) : null}

        <Field>
          <FieldLabel htmlFor={`${ids}-key`}>API key</FieldLabel>
          {doc.apiKey.hasKey && keyFollows ? (
            <FieldDescription>
              Saved key ending ••••{doc.apiKey.last4}.
              {doc.apiKey.readable === false
                ? " It can't be read with the server's current encryption key; replace it."
                : ""}
            </FieldDescription>
          ) : null}
          {doc.apiKey.hasKey && keyFollows ? (
            <div className="flex gap-2">
              <Button
                type="button"
                variant={keyMode === "replace" ? "default" : "outline"}
                onClick={() => setKeyMode("replace")}
              >
                Replace key
              </Button>
              <Button
                type="button"
                variant={keyMode === "remove" ? "default" : "outline"}
                onClick={() => setKeyMode("remove")}
              >
                Remove key
              </Button>
            </div>
          ) : null}
          {showKeyInput ? (
            <Input
              id={`${ids}-key`}
              type="password"
              autoComplete="off"
              spellCheck={false}
              {...register("apiKey")}
            />
          ) : null}
          {losesKey ? (
            <p role="note" className="text-sm text-destructive">
              Changing the provider or address removes the saved key. Enter a
              new key for this provider or the assistant won&apos;t work.
            </p>
          ) : null}
          {!doc.keyAvailable ? (
            <FieldDescription>
              The server has no APP_ENCRYPTION_KEY, so a key can&apos;t be saved
              yet.
            </FieldDescription>
          ) : null}
          <FieldError>{errors.apiKey?.message}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor={`${ids}-model`}>Model</FieldLabel>
          <div className="flex gap-2">
            <Input
              id={`${ids}-model`}
              list={`${ids}-models`}
              {...register("model", {
                validate: (v) =>
                  ModelId.safeParse(v).success ||
                  "Use the model's ID, like gemini-flash-latest",
              })}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => listModels.mutate()}
              disabled={listModels.isPending}
            >
              {listModels.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : null}
              List models
            </Button>
          </div>
          <datalist id={`${ids}-models`}>
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <FieldError>{errors.model?.message}</FieldError>
        </Field>

        <Field>
          <FieldLabel id={`${ids}-roles`}>Who can use it</FieldLabel>
          <FieldDescription>
            Owners and admins can always use it.
          </FieldDescription>
          <Controller
            control={control}
            name="allowedRoles"
            render={({ field }) => (
              <div
                role="group"
                aria-labelledby={`${ids}-roles`}
                className="flex flex-col gap-2"
              >
                {GATED_ROLES.map((role) => (
                  <label key={role} className="flex items-center gap-2">
                    <Checkbox
                      checked={field.value.includes(role)}
                      onCheckedChange={(on) =>
                        field.onChange(
                          on
                            ? [...field.value, role]
                            : field.value.filter((r) => r !== role)
                        )
                      }
                    />
                    {ROLE_LABELS[role]}
                  </label>
                ))}
              </div>
            )}
          />
        </Field>

        <Controller
          control={control}
          name="share"
          render={({ field }) => (
            <Field orientation="horizontal">
              <Switch
                id={`${ids}-share`}
                checked={field.value}
                disabled={!isOwner}
                onCheckedChange={field.onChange}
              />
              <FieldContent>
                <FieldLabel htmlFor={`${ids}-share`}>
                  Let the assistant read enquiry details
                </FieldLabel>
                <FieldDescription>
                  {isOwner
                    ? "Off by default. When on, people who can read enquiries get first names, topics and messages (500 characters, newest 20) in answers."
                    : "Only an owner can change this."}
                </FieldDescription>
              </FieldContent>
            </Field>
          )}
        />
        {isOwner && share && !saved.shareEnquiryDetails.enabled ? (
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
                <FieldLabel htmlFor={`${ids}-ack`}>{SHARE_ACK}</FieldLabel>
                <FieldError>{errors.acknowledge?.message}</FieldError>
              </Field>
            )}
          />
        ) : null}

        <Field>
          <FieldLabel htmlFor={`${ids}-prompt`}>Extra instructions</FieldLabel>
          <Textarea
            id={`${ids}-prompt`}
            rows={4}
            maxLength={2000}
            placeholder="Tone, the practice name, words to avoid…"
            {...register("systemPrompt")}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${ids}-max`}>
            Longest answer (tokens)
          </FieldLabel>
          <Input
            id={`${ids}-max`}
            type="number"
            min={OUTPUT_TOKENS.min}
            max={OUTPUT_TOKENS.max}
            {...register("maxOutputTokens", {
              valueAsNumber: true,
              min: {
                value: OUTPUT_TOKENS.min,
                message: `At least ${OUTPUT_TOKENS.min}`,
              },
              max: {
                value: OUTPUT_TOKENS.max,
                message: `At most ${OUTPUT_TOKENS.max}`,
              },
            })}
          />
          <FieldError>{errors.maxOutputTokens?.message}</FieldError>
        </Field>
      </FieldGroup>

      {formError ? (
        <p role="alert" className="text-destructive">
          {formError}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" className={FORM_ACTION} disabled={isSubmitting}>
          {isSubmitting ? <Spinner data-icon="inline-start" /> : null}Save
        </Button>
        <Button
          type="button"
          variant="outline"
          className={FORM_ACTION}
          disabled={isDirty || test.isPending}
          title={isDirty ? "Save first" : undefined}
          onClick={() => test.mutate()}
        >
          {test.isPending ? <Spinner data-icon="inline-start" /> : null}Test
          connection
        </Button>
      </div>
    </form>
  )
}
