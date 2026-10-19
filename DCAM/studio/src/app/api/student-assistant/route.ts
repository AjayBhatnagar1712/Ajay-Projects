import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import {
  getStudentAssistantFallbackResponse,
  getStudentAssistantKnowledgeText,
  getStudentAssistantPageContext,
  getSuggestedStudentAssistantActions,
  getStudentAssistantActionsByIds,
  getStudentAssistantWorkflowResponse,
  getStudentAssistantWorkflowText,
  getStudentAssistantTopicRedirectResponse,
  isLikelyDcamSupportRequest,
  isAcademicExamHelpRequest,
} from '@/lib/student-assistant';

const ConversationMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(800),
});

const StudentAssistantRequestSchema = z.object({
  message: z.string().trim().min(1).max(1200),
  pathname: z.string().trim().max(200).optional(),
  conversation: z.array(ConversationMessageSchema).max(8).optional(),
  userContext: z
    .object({
      firstName: z.string().trim().max(80).optional(),
      roleId: z.string().trim().max(30).optional(),
      subscriptionStatus: z.string().trim().max(40).optional(),
      accountStatus: z.string().trim().max(40).optional(),
      completedGuide: z.boolean().optional(),
    })
    .optional(),
});

const StudentAssistantOutputSchema = z.object({
  answer: z.string().trim().min(1).max(900),
  suggestedActionIds: z.array(z.string().trim().max(40)).max(3).default([]),
});

const ACADEMIC_REDIRECT_ACTION_IDS = ['mock-tests', 'custom-mock', 'practice-session'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = StudentAssistantRequestSchema.parse(body);
    const pageContext = getStudentAssistantPageContext(parsed.pathname);

    if (parsed.userContext?.roleId && parsed.userContext.roleId !== 'student') {
      return NextResponse.json(
        {
          answer: 'This DCAM assistant is currently set up for student accounts only.',
          suggestedActions: [],
        },
        { headers: { 'cache-control': 'no-store' } }
      );
    }

    if (isAcademicExamHelpRequest(parsed.message)) {
      return NextResponse.json(
        {
          answer:
            'I can help you use DCAM Classes, but I cannot solve exam questions or teach academic topics here. I can still guide you to the right DCAM practice or mock-test area.',
          suggestedActions: getStudentAssistantActionsByIds(ACADEMIC_REDIRECT_ACTION_IDS),
        },
        { headers: { 'cache-control': 'no-store' } }
      );
    }

    if (
      !isLikelyDcamSupportRequest({
        message: parsed.message,
        conversation: parsed.conversation,
      })
    ) {
      return NextResponse.json(getStudentAssistantTopicRedirectResponse({ pathname: parsed.pathname }), {
        headers: { 'cache-control': 'no-store' },
      });
    }

    const workflowResponse = getStudentAssistantWorkflowResponse({
      message: parsed.message,
    });

    if (workflowResponse) {
      return NextResponse.json(workflowResponse, {
        headers: { 'cache-control': 'no-store' },
      });
    }

    if (!process.env.GOOGLE_API_KEY) {
      const fallback = getStudentAssistantFallbackResponse({
        message: parsed.message,
        pathname: parsed.pathname,
      });

      return NextResponse.json(fallback, {
        headers: { 'cache-control': 'no-store' },
      });
    }

    const transcript = (parsed.conversation || [])
      .slice(-6)
      .map((entry) => `${entry.role === 'user' ? 'Student' : 'Assistant'}: ${entry.content}`)
      .join('\n');

    const prompt = `You are DCAM Guide, a friendly in-product assistant inside dcamclasses.in for signed-in students.

Allowed scope:
- Help students understand how to use DCAM Classes.
- Answer questions about account navigation, profile, subscription, payments, offers, teachers, live batches, courses, mock-test pages, reports, chat, doubts, notices, and platform updates.
- Explain what a page does and what the student should try next.
- If the student asks how to do something in DCAM, give direct in-app guidance using the real route names below.
- Keep replies concise, practical, and grounded in the actual DCAM routes listed below.

Blocked scope:
- Do not solve academic or exam questions.
- Do not explain syllabus, formulas, concepts, or answer keys.
- If the request slips toward academic help, politely redirect to DCAM platform features.
- If the request is off-topic for DCAM Classes, redirect the student back to DCAM-related help.
- Do not invent routes, policies, or pricing.

Student context:
- First name: ${parsed.userContext?.firstName || 'Student'}
- Role: ${parsed.userContext?.roleId || 'student'}
- Subscription status: ${parsed.userContext?.subscriptionStatus || 'unknown'}
- Account status: ${parsed.userContext?.accountStatus || 'active'}
- Guide completed: ${parsed.userContext?.completedGuide === true ? 'yes' : 'no'}

Current page:
- ${pageContext.label}
- ${pageContext.summary}

DCAM route map:
${getStudentAssistantKnowledgeText()}

Known student workflows:
${getStudentAssistantWorkflowText()}

Recent conversation:
${transcript || 'No earlier messages in this session.'}

Student message:
${parsed.message}

Return:
- answer: a short, helpful reply focused on DCAM usage.
- Prefer 2 to 4 short sentences. Use simple step-by-step wording when the student asks how to do something.
- suggestedActionIds: up to 3 action ids that match the real routes above.`;

    const { output } = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
      prompt,
      output: { schema: StudentAssistantOutputSchema },
    });

    const answer = output?.answer?.trim();
    const suggestedActionIds = output?.suggestedActionIds || [];

    if (!answer) {
      const fallback = getStudentAssistantFallbackResponse({
        message: parsed.message,
        pathname: parsed.pathname,
      });

      return NextResponse.json(fallback, {
        headers: { 'cache-control': 'no-store' },
      });
    }

    const suggestedActions = getStudentAssistantActionsByIds(suggestedActionIds);
    const ensuredActions =
      suggestedActions.length > 0
        ? suggestedActions
        : getSuggestedStudentAssistantActions({
            message: parsed.message,
            pathname: parsed.pathname,
            limit: 3,
          });

    return NextResponse.json(
      {
        answer,
        suggestedActions: ensuredActions,
      },
      {
        headers: { 'cache-control': 'no-store' },
      }
    );
  } catch {
    return NextResponse.json(
      {
        answer:
          'I hit a temporary issue, but I can still guide you around DCAM. Try asking about subscriptions, teachers, batches, courses, doubts, or your profile.',
        suggestedActions: getSuggestedStudentAssistantActions({
          message: '',
          pathname: '/dashboard',
          limit: 3,
        }),
      },
      {
        status: 200,
        headers: { 'cache-control': 'no-store' },
      }
    );
  }
}
