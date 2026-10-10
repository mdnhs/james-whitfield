"use client"

import dynamic from "next/dynamic"

// Every CMS page's bundle holds every block's client code, so imported
// directly the form (and Zod with it) shipped on all public pages. Behind
// next/dynamic it loads only where a contact block renders; SSR still
// renders it, so the markup is unchanged.
export const ContactFormLazy = dynamic(() =>
  import("./contact-form").then((m) => m.ContactForm)
)
