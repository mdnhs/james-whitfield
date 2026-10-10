# Content QA sheet

For the client. These are the content issues found in the launch content (brief §4.6). We list them; we never change copy automatically. The admin dashboard's **Content health** panel shows the automatically detected ones live, with a link to each place.

Automated scan: the dashboard scanner (`lib/content/qa.ts`, rules `rebrand`, `placeholder-contact`, `placeholder-copy`, `online-reach`, `legal-unpublished`) was run against the freshly seeded content. It reported 10 findings:

- `rebrand`: Contact & clinic settings, Home page (the "About" story block), 3 testimonial rows (2 distinct quotes: the seed repeats one quote twice).
- `placeholder-contact`: Footer settings.
- `online-reach`: Contact & clinic, Footer, About page.
- `legal-unpublished`: Privacy Policy, Terms, Disclaimer.

Everything else below is not machine-detectable and needs a human check.

| Finding                                                                                                                             | Where in the admin                                                    | Detected automatically?    | Suggested fix                                                                                                                       | Client decision | Done |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---- |
| Rebrand: the About story says "James works with…" and "His practice…" (the story block renders on the Home page and the About page) | Pages ▸ Home / About ▸ story section                                  | Yes: `rebrand`             | Rewrite in the practitioner's name and pronouns                                                                                     |                 |      |
| Rebrand: testimonial "James helped me move from feeling overwhelmed…"                                                               | Collections ▸ Testimonials                                            | Yes: `rebrand`             | Replace "James" with the practitioner's name, or use the client's original wording if it is a genuine quote that names someone else |                 |      |
| Rebrand: testimonial "Working with James has been an incredibly valuable experience. He took…"                                      | Collections ▸ Testimonials                                            | Yes: `rebrand`             | As above, including "He"                                                                                                            |                 |      |
| Contact email is `hello@jameswhitfield.ie`                                                                                          | Settings ▸ Contact & clinic                                           | Yes: `rebrand`             | Replace with the practice's real address (also drives the enquiry notification and the footer)                                      |                 |      |
| Footer shows `[email]`                                                                                                              | Settings ▸ Footer                                                     | Yes: `placeholder-contact` | Enter the real email                                                                                                                |                 |      |
| Footer shows `[phone]`                                                                                                              | Settings ▸ Footer                                                     | Yes: `placeholder-contact` | Enter the real phone number, or remove the line                                                                                     |                 |      |
| Footer shows `[Dublin, Ireland]`                                                                                                    | Settings ▸ Footer                                                     | Yes: `placeholder-contact` | Enter the real address                                                                                                              |                 |      |
| Online sessions are "worldwide" in some places and "Ireland, UK & USA" in others                                                    | Settings ▸ Contact & clinic, Settings ▸ Footer, Pages ▸ About ▸ stats | Yes: `online-reach`        | Pick one statement and use it everywhere                                                                                            |                 |      |
| FAQ #4 ("Can hypnotherapy work online?") duplicates FAQ #7 ("Do you offer online sessions?")                                        | Collections ▸ FAQs                                                    | Manual                     | Merge into one answer, delete the other                                                                                             |                 |      |
| Seven different wordings of "Book a discovery call" (list below)                                                                    | Several, see list                                                     | Manual                     | Choose one label ("Book a Discovery Call") and use it for every button; keep prose mentions in sentence case                        |                 |      |
| `story.png` is the same image as `step-2.png`                                                                                       | Media (About story photo, How it works step 2)                        | Manual                     | Supply a distinct photo for one of them, then swap it in the page                                                                   |                 |      |
| Approach subtitle has a stray colon                                                                                                 | Pages ▸ About ▸ approach section                                      | Manual                     | Reword without the colon                                                                                                            |                 |      |
| Clinic address has a stray comma                                                                                                    | Settings ▸ Contact & clinic                                           | Manual                     | Fix the punctuation                                                                                                                 |                 |      |
| Privacy Policy is placeholder copy and unpublished (footer link 404s)                                                               | Pages ▸ Privacy Policy                                                | Yes: `legal-unpublished`   | Practice or its adviser supplies the text; an editor pastes it and publishes                                                        |                 |      |
| Terms is placeholder copy and unpublished                                                                                           | Pages ▸ Terms                                                         | Yes: `legal-unpublished`   | As above                                                                                                                            |                 |      |
| Disclaimer is placeholder copy and unpublished                                                                                      | Pages ▸ Disclaimer                                                    | Yes: `legal-unpublished`   | As above                                                                                                                            |                 |      |

## "Discovery call" wordings found in the launch content

From `grep -rn -i "discovery call" server/db/seed` (file and the text used):

| Where                                                             | Wording                                                              |
| ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| Home hero button (`hero-content.ts`)                              | "Book a Discovery Call"                                              |
| About page CTA, two places (`about-page-content.ts`)              | "Book a Discovery Call →" (two spaces) and "Book a Discovery Call →" |
| How it works CTA (`steps.ts`)                                     | "Book a Discovery Call"; step title "Discovery Call"                 |
| Services card (`services-content.ts`)                             | name "Discovery Call"                                                |
| Contact reassurance / microcopy (`microcopy.ts`)                  | button "Book a discovery call →" (lower case)                        |
| Contact intro (`contact-content.ts`) and microcopy body           | "the free discovery call" in prose                                   |
| FAQ answers (`faqs.ts`) and an article body (`article-bodies.ts`) | "the (free) discovery call" in prose                                 |

## Sign-off

Legal copy must come from the practice or its adviser; we publish it as provided.

After the client has gone through the table, the dashboard's Content health list must be empty, or every remaining row is an accepted decision.

Name: ______________________ Date: ______________

I approve the content above for launch.

Signature: ______________________
