import { buildWebsiteChatWidgetScript } from "@/lib/websiteChatWidget.mjs";

export const dynamic = "force-static";

export function GET() {
  return new Response(buildWebsiteChatWidgetScript(), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300, must-revalidate",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
