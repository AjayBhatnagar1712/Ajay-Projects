'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { CheckCircle2, LoaderCircle, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/icons';
import { GoogleAuthHandler } from '@/components/auth/google-auth-handler';

const formSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phoneNumber: z.string().min(10, 'A valid phone number is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export default function StudentRegistrationPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const inputClassName =
    'h-12 rounded-xl border-slate-600/55 bg-slate-950/55 text-slate-100 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-sky-400/45 focus-visible:ring-offset-0';
  const primaryButtonClassName =
    'h-12 w-full rounded-xl bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 font-semibold text-white shadow-[0_14px_30px_-18px_rgba(59,130,246,0.9)] transition-all hover:-translate-y-0.5 hover:from-blue-600 hover:via-blue-500 hover:to-indigo-500';

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: `${values.firstName} ${values.lastName}`
      });

      const userRef = doc(firestore, 'users', user.uid);
      const userData = {
        id: user.uid,
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phoneNumber: values.phoneNumber,
        roleId: 'student',
        status: 'active',
      };
      
      await setDoc(userRef, userData, { merge: false });

      toast({
        title: 'Registration Successful',
        description: 'Your student account has been created.',
      });
      router.push('/dashboard');
    } catch (error: any) {
      toast({
          variant: 'destructive',
          title: 'Registration Failed',
          description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_52%),_linear-gradient(180deg,_#080d14_0%,_#0b1220_48%,_#0d1524_100%)] text-white">
      <div className="relative overflow-hidden">
        <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute top-40 -right-24 h-72 w-72 rounded-full bg-slate-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:28px_28px] opacity-10" />

        <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-6 py-12">
          <div className="grid w-full gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="hidden lg:flex flex-col justify-between rounded-3xl border border-white/10 bg-[linear-gradient(165deg,rgba(15,23,42,0.88),rgba(30,41,59,0.58))] p-10 shadow-2xl shadow-black/45 backdrop-blur-xl">
              <div>
                <Link href="/dashboard" className="flex items-center gap-3">
                  <Logo className="h-10 w-10 text-sky-300" />
                  <div>
                    <p className="text-sm uppercase tracking-[0.35em] text-sky-200/70">DCAM</p>
                    <p className="font-headline text-2xl font-semibold text-white">Classes</p>
                  </div>
                </Link>
                <p className="mt-8 inline-flex items-center gap-2 rounded-full border border-sky-300/35 bg-sky-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-sky-100">
                  <Sparkles className="h-3.5 w-3.5" />
                  Student Access
                </p>
                <h1 className="mt-5 text-5xl font-semibold leading-tight text-white">
                  Start your learning journey with clarity.
                </h1>
                <p className="mt-4 text-lg leading-relaxed text-slate-200/80">
                  Register as a student and get access to structured content, live classes, and exam-focused practice.
                </p>
              </div>
              <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/40 p-5 text-sm text-slate-200/80">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-sky-300" />
                  Personalized learning paths.
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-sky-300" />
                  Access to curated study materials.
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-sky-300" />
                  Exam-ready practice sessions.
                </div>
              </div>
            </div>

            <Card className="w-full max-w-md justify-self-center rounded-3xl border-white/10 bg-[linear-gradient(165deg,rgba(15,23,42,0.9),rgba(30,41,59,0.62))] text-white shadow-2xl shadow-black/45 backdrop-blur-xl">
              <CardHeader className="text-center">
                <Link href="/dashboard" className="flex items-center gap-2 justify-center mb-4">
                  <Logo className="w-8 h-8 text-sky-300" />
                  <span className="font-headline text-2xl font-semibold text-white">
                    DCAM Classes
                  </span>
                </Link>
                <CardTitle className="text-3xl text-white">Student Registration</CardTitle>
                <CardDescription className="text-base text-slate-200/80">Create your student account to get started.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel className="text-slate-200">First Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Anjali" {...field} className={inputClassName} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel className="text-slate-200">Last Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Patel" {...field} className={inputClassName} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-200">Email</FormLabel>
                          <FormControl>
                            <Input placeholder="student@example.com" {...field} className={inputClassName} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-200">Phone Number</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 9876543210" {...field} className={inputClassName} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-200">Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="********" {...field} className={inputClassName} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className={primaryButtonClassName} disabled={isLoading}>
                      {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                      Create Student Account
                    </Button>
                  </form>
                </Form>

                <div className="mt-6">
                  <GoogleAuthHandler ctaMode="signup" />
                </div>

                <div className="mt-6 space-y-2 rounded-xl border border-white/10 bg-slate-900/40 p-4 text-center text-sm text-slate-300/85">
                  <p>
                    Already have an account?{' '}
                    <Link href="/login" className="font-medium text-sky-200 hover:underline">
                      Log in
                    </Link>
                  </p>
                  <p>
                    Are you a teacher?{' '}
                    <Link href="/teacher-registration" className="font-medium text-sky-200 hover:underline">
                      Register here
                    </Link>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
