import { startWhatsAppCampaignWorker } from "@/lib/server/whatsapp/campaign-worker";
import { startPostRegistrationGrowthWorker } from "@/lib/server/whatsapp/whatsapp-post-registration-worker";

startPostRegistrationGrowthWorker();
startWhatsAppCampaignWorker();
