'use client';

import {
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  MessageSquare,
  MessagesSquare,
  Target,
  GraduationCap,
  CreditCard,
  ListTree,
  Users,
  UserCheck,
  BellRing,
  DollarSign,
  Wallet,
  Layers3,
  PackagePlus,
  Coins,
  Inbox,
  LifeBuoy,
} from 'lucide-react';
import type { NavItem } from '@/lib/types';

export const navItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'My Learning', href: '/my-learning', icon: BookOpen },
  { title: 'My Practice', href: '/my-practice', icon: Target },
  { title: 'My Batch', href: '/my-batch', icon: Layers3 },
  { title: 'Offers', href: '/offers', icon: PackagePlus },
  { title: 'Your Curriculum', href: '/curriculum', icon: ListTree },
  { title: 'Your Purchases', href: '/teacher/question-purchases', icon: PackagePlus },
  { title: 'User Management', href: '/admin/students', icon: Users },
  { title: 'Teacher Approvals', href: '/admin/teacher-approvals', icon: UserCheck },
  { title: 'Enquiries', href: '/admin/enquiries', icon: Inbox },
  { title: 'Course Management', href: '/admin/course-management', icon: BookOpen },
  { title: 'DCAM Staff Performance', href: '/admin/staff-performance', icon: ClipboardCheck },
  { title: 'Live Batch Management', href: '/admin/live-batch-management', icon: Layers3 },
  { title: 'Custom Mock Test Management', href: '/admin/custom-mock-test-management', icon: ClipboardList },
  { title: 'Practice Session Management', href: '/admin/practice-session-management', icon: Target },
  { title: 'Teacher Question Management', href: '/admin/teacher-question-management', icon: Coins },
  { title: 'Revenue Management', href: '/admin/revenue', icon: DollarSign },
  { title: 'DCAM Question Bank', href: '/practice', icon: ClipboardList },
  {
    title: 'Course',
    href: '/courses/create',
    icon: GraduationCap,
    children: [
      { title: 'Create Course', href: '/courses/create' },
      { title: 'Draft', href: '/courses?view=draft' },
      { title: 'Your Course', href: '/courses?view=your' },
      { title: 'Waiting for Subscription', href: '/courses?view=waiting-subscription' },
    ],
  },
  {
    title: 'DCAM Mock Tests',
    href: '/mock-tests/create',
    icon: Target,
    children: [
      { title: 'Create DCAM Mock Test', href: '/mock-tests/create' },
      { title: 'Draft', href: '/mock-tests?view=draft' },
      { title: 'Your DCAM Mock Tests', href: '/mock-tests?view=your' },
      { title: 'Waiting for Subscription', href: '/mock-tests?view=waiting-subscription' },
    ],
  },
  {
    title: 'Live Batches',
    href: '/live-batches?view=your',
    icon: Layers3,
    children: [
      { title: 'Create Live Batch', href: '/live-batches/create' },
      { title: 'Your Live Batches', href: '/live-batches?view=your' },
      { title: 'Waiting for Subscription', href: '/live-batches?view=waiting-subscription' },
    ],
  },
  { title: 'Chat', href: '/chat', icon: MessagesSquare },
  { title: 'Doubts', href: '/doubts', icon: MessageSquare },
  { title: 'Exam Bulletin', href: '/notice-board', icon: BellRing },
  { title: 'Help', href: '/help', icon: LifeBuoy },
  { title: 'Wallet', href: '/wallet', icon: Wallet },
  { title: 'Subscription', href: '/subscription', icon: CreditCard },
];

export const mobileStudentNavItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'My Learning', href: '/my-learning', icon: BookOpen },
  { title: 'My Practice', href: '/my-practice', icon: Target },
  { title: 'Help', href: '/help', icon: LifeBuoy },
  { title: 'Chat', href: '/chat', icon: MessagesSquare },
];

export const mobileTeacherNavItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Your Content', href: '/content', icon: BookOpen },
  { title: 'DCAM Question Bank', href: '/practice', icon: ClipboardList },
  { title: 'Chat', href: '/chat', icon: MessagesSquare },
];

export const mobileQuestionUploadNavItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Question Bank', href: '/practice', icon: ClipboardList },
];
