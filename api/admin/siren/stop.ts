import Pusher from "pusher";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const pusher = new Pusher({
      appId: process.env.PUSHER_APP_ID || "mock_id",
      key: process.env.PUSHER_KEY || "mock_key",
      secret: process.env.PUSHER_SECRET || "mock_secret",
      cluster: process.env.PUSHER_CLUSTER || "eu",
      useTLS: true
    });

    await pusher.trigger("bedsore-guardian", "siren-state", { active: false });
    
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to stop siren" });
  }
}
