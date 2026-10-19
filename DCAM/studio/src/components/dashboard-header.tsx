'use client';

import { useMemo, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, BellRing, CalendarClock, CheckCheck, ChevronRight, LogOut, Sparkles, User } from 'lucide-react';
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { Skeleton } from './ui/skeleton';
import { signOut } from 'firebase/auth';
import Link from 'next/link';
import { doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { formatNotificationAbsoluteTime, formatNotificationRelativeTime } from '@/lib/notifications';
import { resetAppSessionStateInApp, syncBellNotificationsToApp } from '@/lib/app-bridge';
import { useBellNotifications } from '@/hooks/useBellNotifications';

type DashboardHeaderProps = {
  title: string;
};

type UserProfile = {
  id: string;
  firstName?: string;
  lastName?: string;
  photoURL?: string;
};

function NotificationsDropdown() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    isLoading,
    markNotificationRead,
    markAllNotificationsRead,
  } = useBellNotifications();

  const hasNotifications = notifications.length > 0;
  const unreadLabel = unreadCount > 99 ? '99+' : String(unreadCount);
  const handleNotificationClick = async (notificationId: string, href?: string) => {
    await markNotificationRead(notificationId);
    if (href) {
      router.push(href);
    }
  };
  const handleMarkAllReadClick = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    await markAllNotificationsRead();
  };

  const notificationIcon = useMemo(() => {
    if (unreadCount > 0) return BellRing;
    return Bell;
  }, [unreadCount]);
  const TriggerIcon = notificationIcon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full border border-sidebar-border/60 bg-sidebar-accent/30 hover:bg-sidebar-accent/60 md:h-10 md:w-10"
        >
          <TriggerIcon className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-w-[1.2rem] items-center justify-center rounded-full bg-cyan-400 px-1.5 py-0.5 text-[10px] font-semibold text-slate-950">
              {unreadLabel}
            </span>
          ) : null}
          <span className="sr-only">Toggle notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[24rem] overflow-hidden border border-sidebar-border/60 bg-gradient-to-br from-background via-background to-sidebar-accent/20 p-0 md:w-[26rem]"
      >
        <div className="flex items-center justify-between border-b border-sidebar-border/60 px-4 py-3">
          <DropdownMenuLabel className="p-0 text-base font-semibold">Notifications</DropdownMenuLabel>
          {unreadCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-full px-3 text-xs"
              onClick={(event) => {
                void handleMarkAllReadClick(event);
              }}
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
              Mark all read
            </Button>
          ) : null}
        </div>
        {isLoading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        ) : !hasNotifications ? (
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
            <Bell className="h-5 w-5 text-muted-foreground/70" />
            <p className="text-sm font-medium">No notifications yet</p>
            <p className="text-xs text-muted-foreground">
              Course unlocks, teacher publishes, and class reminders will show up here.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[26rem]">
            <div className="space-y-2 p-3">
              {notifications.map((notification) => {
                const isReminder = !notification.isPersistent;
                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => {
                      void handleNotificationClick(notification.id, notification.href);
                    }}
                    className={cn(
                      'w-full rounded-2xl border p-3 text-left transition hover:border-cyan-300/35 hover:bg-cyan-500/5',
                      notification.isRead
                        ? 'border-border/60 bg-background/30'
                        : 'border-cyan-300/25 bg-cyan-500/[0.08]'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border',
                          isReminder
                            ? 'border-amber-300/35 bg-amber-500/10 text-amber-100'
                            : 'border-cyan-300/35 bg-cyan-500/10 text-cyan-100'
                        )}
                      >
                        {isReminder ? <CalendarClock className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{notification.title}</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">{notification.message}</p>
                          </div>
                          {!notification.isRead ? (
                            <span className="mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-400" />
                          ) : null}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <p
                            className="truncate text-[11px] text-muted-foreground"
                            title={formatNotificationAbsoluteTime(notification.createdAtMs)}
                          >
                            {formatNotificationRelativeTime(notification.createdAtMs)}
                          </p>
                          {notification.href ? (
                            <span className="inline-flex items-center text-[11px] font-medium text-cyan-100">
                              Open
                              <ChevronRight className="ml-1 h-3.5 w-3.5" />
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function DashboardHeader({ title }: DashboardHeaderProps) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!user?.uid || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  const handleLogout = async () => {
    syncBellNotificationsToApp({
      userId: null,
      notifications: [],
    });
    resetAppSessionStateInApp();
    await signOut(auth);
  };

  const getInitials = (name?: string | null) => {
    if (!name) return '';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('');
  };

  const profileImageUrl = userProfile?.photoURL || user?.photoURL || undefined;
  const profileDisplayName = useMemo(() => {
    return `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim() || user?.displayName || 'User';
  }, [user?.displayName, userProfile?.firstName, userProfile?.lastName]);

  return (
    <header className="sticky top-0 z-10 flex min-h-16 items-center gap-2 border-b border-sidebar-border/60 bg-gradient-to-r from-background/95 via-background/90 to-background/85 px-3 py-2 backdrop-blur-md sm:px-4 md:gap-4 md:px-6">
      <SidebarTrigger className="h-9 w-9 shrink-0 md:hidden" data-student-tour="sidebar-trigger" />
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3" data-student-tour="dashboard-header">
        <div className="hidden h-10 w-1 rounded-full bg-gradient-to-b from-cyan-400 via-blue-500 to-indigo-500 md:block" />
        <div className="min-w-0 leading-tight">
          <h1 className="truncate font-headline text-lg font-semibold tracking-tight sm:text-xl md:text-2xl">{title}</h1>
          <p className="hidden text-xs text-muted-foreground md:block">Focused workspace</p>
        </div>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-4">
        <NotificationsDropdown />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-9 w-9 rounded-full border border-sidebar-border/60 bg-sidebar-accent/30 hover:bg-sidebar-accent/60 md:h-10 md:w-10"
            >
              {isUserLoading ? (
                <Skeleton className="h-9 w-9 rounded-full md:h-10 md:w-10" />
              ) : user ? (
                <Avatar className="h-9 w-9 md:h-10 md:w-10">
                  {profileImageUrl ? <AvatarImage src={profileImageUrl} alt={profileDisplayName} /> : null}
                  <AvatarFallback>{getInitials(profileDisplayName)}</AvatarFallback>
                </Avatar>
              ) : (
                <Avatar className="h-9 w-9 md:h-10 md:w-10">
                  <AvatarFallback>
                    <User className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {user ? (
              <>
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{profileDisplayName}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem asChild>
                <Link href="/login">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log in</span>
                </Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
