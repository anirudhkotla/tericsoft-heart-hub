import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, ROLE_LABELS } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Tericsoft HR OS" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, profile, roles, refresh } = useAuth();
  const { theme, setTheme } = useTheme();
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setDepartment(profile?.department ?? "");
    setJobTitle(profile?.job_title ?? "");
  }, [profile]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, department, job_title: jobTitle })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
    toast.success("Profile updated");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile and workspace preferences.</p>
      </div>

      <Card className="rounded-2xl shadow-soft">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your details across the HR workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} className="rounded-xl" maxLength={100} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="department">Department</Label>
              <Input id="department" value={department} onChange={(e) => setDepartment(e.target.value)} className="rounded-xl" placeholder="e.g. Engineering" maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jobTitle">Job title</Label>
              <Input id="jobTitle" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="rounded-xl" placeholder="e.g. HR Manager" maxLength={80} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled className="rounded-xl" />
          </div>
          <Button onClick={save} disabled={saving} className="rounded-xl active:scale-95">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-soft">
        <CardHeader>
          <CardTitle>Roles & access</CardTitle>
          <CardDescription>Roles control what you can see and do. Admins manage assignments.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {roles.length ? (
            roles.map((r) => (
              <Badge key={r} className="rounded-lg bg-primary/10 text-primary hover:bg-primary/15">
                {ROLE_LABELS[r]}
              </Badge>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No roles assigned yet.</p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-soft">
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Dark mode is saved to this device.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Dark mode</p>
            <p className="text-sm text-muted-foreground">Switch between light and dark themes.</p>
          </div>
          <Switch checked={theme === "dark"} onCheckedChange={(v) => setTheme(v ? "dark" : "light")} />
        </CardContent>
      </Card>
    </div>
  );
}