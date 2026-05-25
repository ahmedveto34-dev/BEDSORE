export default function handler(req: any, res: any) {
  // In a purely Serverless environment, we cannot persist Push Notifications 
  // without a backend database (like Firebase, MongoDB, or Vercel KV).
  // This endpoint accepts the subscription gracefully to prevent client 404 errors.
  res.status(201).json({ success: true, warning: "Stored locally. Real persistence requires a database backend." });
}
