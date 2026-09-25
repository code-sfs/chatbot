export const QUICK_ACTIONS = [

  {

    id: "voice",

    icon: "mic" as const,

    label: "Voice Chat AI",

    description: "Hold mic and speak naturally",

    screen: "voice" as const,

  },

  {

    id: "chat",

    icon: "chat" as const,

    label: "Chat with AI",

    description: "Type or tap suggestions",

    screen: "chat" as const,

  },

];



export type PersonaGroup =

  | "teacher"

  | "student"

  | "management"

  | "principal"

  | "admin"

  | "hr";



export const SUGGESTED_PROMPTS_BY_PERSONA: Record<PersonaGroup, string[]> = {

  teacher: [

    "Show my profile summary",

    "Show my attendance for the last 7 days",

    "What is my attendance this month?",

    "show my today timetable",

    "which is my substitute period for today",

    "Show pending assignments for my class",

    "What are the school holidays this month?",

    "name of students of my class having birthday this month",

    "Show all students in my class along with parent phone number",

    "When did I join this school?",

  ],

  student: [

    "Show my profile summary",

    "What is my attendance this month?",

    "What are the school holidays this month?",

    "Show my class timetable",

    "What homework is due this week?",

    "Who is my class teacher?",

  ],

  management: [

    "Outstanding fee pending across the school",

    "Show me our top vendor spend this year",
    
    "Show fee collection summary this month",

    "projected cash flow for the next 90 days",
    
    "What percentage of revenue goes to staff cost?",

    "What's our enquiry-to-admission conversion rate?",

    "Compare current strength to sanctioned capacity by class.",

    "Can you share the list of teachers along with their work load",
  
    "Show monthly revenue lost to concessions, scholarships, and write-offs.",

  ],

  principal: [

    "show my profile summary",

    "when was my joining date",
    
    "Number of teachers subject wise",

    "show name of the hindi teachers",

    "Maximum staff absentees and late comers",

    "Teachers due for retirement next three years",

    "Show fee collection summary this month",

    "Show top performing classes this term",

    "Can you share the list of teachers along with their work load",

  ],

  admin: [

    "Show total student count",

    "List staff on leave today",

    "What are the school holidays this month?",

    "Show class-wise student strength",

    "List pending admission applications",

    "Show employee count by department",

  ],

  hr: [

    "Show my profile summary",

    "List employees on leave today",

    "Show staff joining this month",

    "List pending leave approvals",

    "Show employee count by department",

    "When did I join this school?",

  ],

};



/** @deprecated Use getSuggestedPrompts(roles) from utils/resolvePersona */

export const SUGGESTED_PROMPTS = SUGGESTED_PROMPTS_BY_PERSONA.teacher;



export type ChatbotScreen = "home" | "chat" | "voice";

