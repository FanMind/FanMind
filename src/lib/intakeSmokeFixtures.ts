import { extractMetaWebhookEvents } from "@/lib/metaWebhook";
import { extractTikTokCommentIntakeEvents } from "@/lib/tiktokCommentIntake";
import { extractTikTokMessageIntakeEvents } from "@/lib/tiktokMessageIntake";
import { extractWhatsAppWebhookEvents } from "@/lib/whatsappWebhook";

export const intakeSmokeFixtures = {
  facebookMessage: {
    object: "page",
    entry: [
      {
        id: "page_1",
        messaging: [
          {
            sender: { id: "fan_fb_1" },
            recipient: { id: "page_1" },
            timestamp: 1710000000000,
            message: { mid: "fb_mid_1", text: "Hallo FanMind" },
          },
        ],
      },
    ],
  },
  instagramMessage: {
    object: "instagram",
    entry: [
      {
        id: "ig_1",
        messaging: [
          {
            sender: { id: "ig_fan_1" },
            recipient: { id: "ig_business_1" },
            timestamp: 1710000001000,
            message: { mid: "ig_mid_1", text: "Habt ihr noch Tickets?" },
          },
        ],
      },
    ],
  },
  instagramComment: {
    object: "instagram",
    entry: [
      {
        id: "ig_1",
        changes: [
          {
            field: "comments",
            value: {
              id: "ig_comment_1",
              media_id: "ig_media_1",
              text: "Mega Post!",
              username: "ig_fan",
              permalink_url: "https://www.instagram.com/p/demo/",
            },
          },
        ],
      },
    ],
  },
  whatsappMessage: {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "123456789012345",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "109876543210987" },
              contacts: [{ wa_id: "491700000000", profile: { name: "WA Fan" } }],
              messages: [{ id: "wamid.demo1", from: "491700000000", timestamp: "1710000002", text: { body: "Ist noch ein Platz frei?" } }],
            },
          },
        ],
      },
    ],
  },
  tiktokComment: {
    comments: [
      {
        comment_id: "tt_comment_1",
        video_id: "tt_video_1",
        username: "tt_fan",
        text: "Kann ich dabei sein?",
        video_url: "https://www.tiktok.com/@demo/video/1",
        create_time: "2024-03-09T12:00:00.000Z",
      },
    ],
  },
  tiktokMessage: {
    messages: [
      {
        conversation_id: "tt_thread_1",
        message_id: "tt_message_1",
        sender_username: "tt_fan",
        text: "Danke für die Info!",
        created_at: "2024-03-09T12:01:00.000Z",
      },
    ],
  },
} as const;

export function runLocalIntakeSmokeNormalization() {
  if (process.env.NODE_ENV === "production") {
    return { enabled: false, reason: "Smoke-Fixtures sind in production deaktiviert." };
  }

  return {
    enabled: true,
    facebookMessages: extractMetaWebhookEvents(intakeSmokeFixtures.facebookMessage).length,
    instagramMessages: extractMetaWebhookEvents(intakeSmokeFixtures.instagramMessage).length,
    instagramComments: extractMetaWebhookEvents(intakeSmokeFixtures.instagramComment).length,
    whatsappMessages: extractWhatsAppWebhookEvents(intakeSmokeFixtures.whatsappMessage).length,
    tiktokComments: extractTikTokCommentIntakeEvents(intakeSmokeFixtures.tiktokComment).length,
    tiktokMessages: extractTikTokMessageIntakeEvents(intakeSmokeFixtures.tiktokMessage).length,
  };
}
