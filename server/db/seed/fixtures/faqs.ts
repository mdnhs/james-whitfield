export type Faq = { question: string; answer: string }

export const FAQ_HEADER = {
  title: "Frequently Asked Questions",
  subtitle: "Everything you need to know before booking a session.",
}

// Only the first answer comes from the design; the rest are placeholders
// to be confirmed by James before launch.
export const FAQS: Faq[] = [
  {
    question: "Is hypnotherapy safe?",
    answer:
      "Yes. Clinical hypnotherapy is a guided, collaborative state of focused relaxation — you stay aware and in control the whole way through, and can stop at any point.",
  },
  {
    question: "Will I lose control?",
    answer:
      "No. You remain aware of where you are and what is being said throughout. Nothing happens without your agreement, and you can open your eyes and end the session whenever you choose.",
  },
  {
    question: "How many sessions will I need?",
    answer:
      "It depends on what you would like to change. We agree a plan together after the discovery call, and review progress as we go rather than committing you to a fixed number up front.",
  },
  {
    question: "Can hypnotherapy work online?",
    answer:
      "Yes. Online sessions follow the same structure as in-person work. All you need is a quiet, private space, a stable connection and headphones.",
  },
  {
    question: "Is this suitable for anxiety and stress?",
    answer:
      "Anxiety and stress are among the most common reasons people get in touch. We discuss your situation on the discovery call so you can decide whether this approach is right for you.",
  },
  {
    question: "What does it cost?",
    answer:
      "Fees depend on the type and length of programme. Current pricing is shared on the free discovery call, before you commit to anything.",
  },
  {
    question: "Do you offer online sessions?",
    answer:
      "Yes. Sessions run in person from Dublin and online with clients across Ireland, the UK and the USA.",
  },
]
