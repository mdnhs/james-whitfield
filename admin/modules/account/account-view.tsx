"use client"

import { EyeIcon } from "lucide-react"
import { parseAsStringLiteral, useQueryState } from "nuqs"

import { DashboardCard } from "@/admin/components/dashboard/dashboard-card"
import { EmptyState } from "@/admin/components/dashboard/empty-state"
import { PageHeader } from "@/admin/components/dashboard/page-header"
import { useActor } from "@/admin/lib/actor-context"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { PasswordForm } from "./password-form"
import { ProfileForm } from "./profile-form"
import { SessionsList } from "./sessions-list"
import { ThemePreference } from "./theme-preference"
import { TwoFactorCard } from "./two-factor-card"

const TABS = ["profile", "security", "sessions"] as const

export function AccountView() {
  const { user, impersonatedBy } = useActor()
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(TABS).withDefault("profile")
  )
  // The server refuses account changes during View-as too (403
  // IMPERSONATION_READ_ONLY); this spares the admin forms that cannot work.
  if (impersonatedBy) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Account" description={user.email} />
        <EmptyState
          icon={EyeIcon}
          title={`You're viewing as ${user.name}`}
          description="Their profile, password and devices can only be changed by them. Stop viewing as them to manage your own account."
        />
      </div>
    )
  }
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
            <TwoFactorCard />
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
