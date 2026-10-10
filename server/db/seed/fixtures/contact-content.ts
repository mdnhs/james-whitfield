import type { GlobalValue } from "@/lib/content/globals"

export const CONTACT_HERO = {
  title: "Contact",
  subtitle:
    "Start with a free 25-minute call, or send a message — I reply personally.",
  image: "/images/contact/contact-hero.png",
  focal: { x: 0.5, y: 0.38 },
  tint: 0.32,
  mirror: false,
}

// Details from the design; confirm before launch.

// The `contact.details` block data.
export const CONTACT_INFO = {
  eyebrow: "Get in Touch",
  title: "However you reach out, you’ll hear back from me personally.",
  subtitle:
    "All enquiries are completely confidential. If you are unsure where to start, the free discovery call is the easiest first step.",
}

// Seed input for the `contact` global. The clinic photo is the
// `contact.clinic` block's (CLINIC.photo); the global keeps none.
export const CONTACT: GlobalValue<"contact"> = {
  email: "hello@jameswhitfield.ie",
  phone: { display: "+353 1 234 5678", e164: "+35312345678" },
  address: {
    lines: ["28 Merrion Square", "Dublin 2"],
    city: "Dublin",
    eircode: "D02 X285",
    country: "Ireland",
  },
  hours: {
    weekly: [
      { days: [1, 2, 3, 4], opens: "08:00", closes: "19:00" },
      { days: [5], opens: "08:00", closes: "14:00" },
    ],
    summary: "Mon – Thu 8am–7pm  •  Fri 8am–2pm",
    note: "",
  },
  clinic: {
    name: "Merrion Square Clinic",
    description: "",
    photo: null,
    onlineNote: "Online sessions available worldwide via secure Zoom.",
    geo: null,
  },
}

// Seed input for the `contactForm` global.
export const CONTACT_FORM: GlobalValue<"contactForm"> = {
  title: "Send a message",
  labels: {
    name: "Full name",
    email: "Email",
    phone: "Phone",
    topic: "I’d like help with",
    format: "Preferred format",
    message: "Message",
  },
  placeholders: {
    name: "Your name",
    email: "you@example.com",
    phone: "+353",
    topic: "Choose a topic",
    message: "Tell me a little about what is bringing you here…",
  },
  extraTopics: ["Something else"],
  formats: ["In person, Dublin", "Online", "Not sure yet"],
  consent: "I agree to my details being used to respond to this enquiry.",
  button: "Send Message  →",
  sendAnother: "Send another message",
  success: {
    title: "Thank you — your message is on its way.",
    body: "I read every enquiry myself and will reply within one working day.",
  },
  errors: {
    name: "Please add your name.",
    email: "Please add a valid email address.",
    phone: "Please check the phone number.",
    message: "Your message is too long.",
    rateLimited:
      "You've sent a few messages already. Please try again in a few minutes, or email us directly.",
    generic: "Something went wrong sending your message. Please try again.",
    topic: "Please choose a topic.",
    consent: "Please confirm so I can reply to you.",
  },
  planMessage: "I’d like to ask about the {name} ({price} {unit}).",
}

// The `contact.clinic` block data.
export const CLINIC = {
  eyebrow: "Visit the Clinic",
  title: "A quiet room in the heart of Georgian Dublin.",
  subtitle:
    "Two minutes from Merrion Square park, with on-street parking and the DART at Pearse Station a short walk away.",
  photo: "/images/insights/post-host-podcast.png",
}
