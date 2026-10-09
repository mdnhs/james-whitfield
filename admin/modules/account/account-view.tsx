"use client"

import { ShieldCheckIcon } from "lucide-react"
import Link from "next/link"
import { parseAsStringLiteral, useQueryState } from "nuqs"

import { DashboardCard } from "@/admin/components/dashboard/dashboard-card"
import { PageHeader } from "@/admin/components/dashboard/page-header"
import { StatusPill } from "@/admin/components/dashboard/status-pill"
import { useActor } from "@/admin/lib/actor-context"
import { buttonVariants } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

import { PasswordForm } from "./password-form"
import { ProfileForm } from "./profile-form"
import { SessionsList } from "./sessions-list"
import { ThemePreference } from "./theme-preference"

const TABS = ["profile", "security", "sessions"] as const

export function AccountView() {
  const { user, twoFactorEnabled } = useActor()
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(TABS).withDefault("profile")
  )
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Account" description={user.email} />
      <Tabs
        value={tab}
        onValueChange={(value) => void setTab(value as (typeof TABS)[number])}
      >
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="sessions">Devices</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-4 grid gap-4 xl:grid-cols-2">
          <DashboardCard title="Profile">
            <ProfileForm />
          </DashboardCard>
          <DashboardCard title="Appearance">
            <ThemePreference />
          </DashboardCard>
        </TabsContent>
        <TabsContent
          value="security"
          className="mt-4 grid gap-4 xl:grid-cols-2"
        >
          <DashboardCard title="Password">
            <p className="text-sm text-muted-foreground">
              You stay signed in here. Every other device is signed out.
            </p>
            <PasswordForm />
          </DashboardCard>
          <DashboardCard title="Two-factor authentication">
            <div className="flex flex-col items-start gap-4">
              {twoFactorEnabled ? (
                <StatusPill tone="success">On</StatusPill>
              ) : (
                <StatusPill tone="warning">Off</StatusPill>
              )}
              <p className="text-sm text-muted-foreground">
                A code from an authenticator app is asked for when you sign in
                on a new device.
              </p>
              {twoFactorEnabled ? null : (
                <Link
                  href="/admin/two-factor-setup"
                  data-slot="button"
                  className={cn(
                    buttonVariants(),
                    "h-11 rounded-xl px-5 font-semibold"
                  )}
                >
                  <ShieldCheckIcon data-icon="inline-start" />
                  Set up two-factor
                </Link>
              )}
            </div>
          </DashboardCard>
        </TabsContent>
        <TabsContent value="sessions" className="mt-4">
          <DashboardCard title="Signed-in devices">
            <SessionsList />
          </DashboardCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}
