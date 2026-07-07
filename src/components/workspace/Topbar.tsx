import { useNavigate } from "@tanstack/react-router";
import { Search, Moon, Sun, LogOut, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/lib/theme";
import { useAuth, initials, ROLE_LABELS } from "@/lib/auth";

export function Topbar() {
  const { theme, toggleTheme } = useTheme();
  const { profile, user, roles, signOut } = useAuth();
  const navigate = useNavigate();

  const name = profile?.full_name || user?.email || "User";
  const primaryRole = roles[0];

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
      <SidebarTrigger className="text-muted-foreground" />
      <div className="relative hidden max-w-md flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search candidates, expenses, dashboards…"
          className="h-10 rounded-xl border-transparent bg-muted pl-9 focus-visible:bg-background"
        />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
          className="rounded-xl transition-transform active:scale-90"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-xl px-1.5 py-1 transition-colors hover:bg-accent">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                  {initials(name)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left leading-tight sm:block">
                <p className="max-w-[140px] truncate text-sm font-medium">{name}</p>
                {primaryRole && (
                  <p className="text-[11px] text-muted-foreground">{ROLE_LABELS[primaryRole]}</p>
                )}
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-1">
              <span className="truncate">{name}</span>
              <span className="flex flex-wrap gap-1">
                {roles.length ? (
                  roles.map((r) => (
                    <Badge key={r} variant="secondary" className="rounded-md text-[10px]">
                      {ROLE_LABELS[r]}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">No role assigned</span>
                )}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
              <UserIcon className="mr-2 h-4 w-4" /> Profile & settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}