import type { MetaMessageTemplate } from "@/lib/server/whatsapp/meta-templates";

export const CAREER_UTTSAV_PRINCIPAL_TEMPLATE: MetaMessageTemplate = {
  name: "career_uttsav_principal",
  language: "en",
  status: "APPROVED",
  category: "MARKETING",
  components: [
    { type: "HEADER", format: "DOCUMENT" },
    {
      type: "BODY",
      text: "Dear {{1}}, please find the attached update from Career Uttsav.",
    },
    {
      type: "BUTTONS",
      buttons: [
        { type: "URL", text: "Register", url: "https://careeruttsav.in/register" },
        {
          type: "URL",
          text: "Learn more",
          url: "https://careeruttsav.in/{{1}}",
        },
      ],
    },
  ],
};