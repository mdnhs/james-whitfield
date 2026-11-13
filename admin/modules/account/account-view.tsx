"use client"

import {
  CircleUserRoundIcon,
  EyeIcon,
  LockKeyholeIcon,
  MonitorSmartphoneIcon,
  UserRoundIcon,
} from "lucide-react"
import { parseAsStringLiteral, useQueryState } from "nuqs"

import { DashboardCard } from "@/admin/components/dashboard/dashboard-card"
import { EmptyState } from "@/admin/components/dashboard/empty-state"
import { InfoHint } from "@/admin/components/actions/icon-tip"
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
        <PageHeader
          title="Account"
          icon={<CircleUserRoundIcon />}
          description={user.email}
        />
        <EmptyState
          icon={EyeIcon}
          title={`You're viewing as ${user.name}`}
          description="Only they can change their account. Stop viewing as them to manage yours."
        />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Account"
        icon={<CircleUserRoundIcon />}
        description={user.email}
      />
      <Tabs
        value={tab}
        onValueChange={(value) => void setTab(value as (typeof TABS)[number])}
      >
        <TabsList>
          <TabsTrigger value="profile">
            <UserRoundIcon aria-hidden />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security">
            <LockKeyholeIcon aria-hidden />
            Security
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <MonitorSmartphoneIcon aria-hidden />
            Devices
          </TabsTrigger>
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
          <DashboardCard
            title="Password"
            action={
              <InfoHint id="account-password-help">
                You stay signed in here. Every other device is signed out.
              </InfoHint>
            }
          >
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
