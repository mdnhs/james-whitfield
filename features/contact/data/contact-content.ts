import { SERVICES } from "@/features/services/data/services-content"

export const CONTACT_HERO = {
  title: "Contact",
  subtitle:
    "Start with a free 25-minute call, or send a message — I reply personally.",
}

// Details from the design; confirm before launch.
const ADDRESS = "28 Merrion Square, Dublin 2, D02 X285"

export const CONTACT_INFO = {
  eyebrow: "Get in Touch",
  title: "However you reach out, you’ll hear back from me personally.",
  subtitle:
    "All enquiries are completely confidential. If you are unsure where to start, the free discovery call is the easiest first step.",
  items: [
    {
      icon: "/images/contact/icon-email.svg",
      label: "Email",
      value: "hello@jameswhitfield.ie",
      href: "mailto:hello@jameswhitfield.ie",
    },
    {
      icon: "/images/contact/icon-phone.svg",
      label: "Phone",
      value: "+353 1 234 5678",
      href: "tel:+35312345678",
    },
    {
      icon: "/images/contact/icon-clinic.svg",
      label: "Clinic",
      value: ADDRESS,
      href: "#clinic",
    },
    {
      icon: "/images/contact/icon-hours.svg",
      label: "Hours",
      value: "Mon – Thu 8am–7pm  •  Fri 8am–2pm",
    },
  ],
}

export const CONTACT_FORM = {
  title: "Send a message",
  topics: [...SERVICES.items.map((service) => service.title), "Something else"],
  formats: ["In person, Dublin", "Online", "Not sure yet"],
  consent: "I agree to my details being used to respond to this enquiry.",
  submit: "Send Message  →",
  success: {
    title: "Thank you — your message is on its way.",
    body: "I read every enquiry myself and will reply within one working day.",
  },
}

export const CLINIC = {
  eyebrow: "Visit the Clinic",
  title: "A quiet room in the heart of Georgian Dublin.",
  subtitle:
    "Two minutes from Merrion Square park, with on-street parking and the DART at Pearse Station a short walk away.",
  name: "Merrion Square Clinic",
  address: `${ADDRESS} Ireland`,
  online: "Online sessions available worldwide via secure Zoom.",
  directions: {
    label: "Get Directions  ↗",
    href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS)}`,
  },
}
