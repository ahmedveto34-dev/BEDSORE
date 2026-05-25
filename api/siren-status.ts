export default function handler(req: any, res: any) {
  // In a purely serverless environment without a database (KV, Firestore, PostgreSQL), 
  // we do not retain global state across lambda invocations.
  // Returning false ensures a clean fallback, relying entirely on 
  // real-time Pusher events for toggling the siren state in the client.
  res.status(200).json({ active: false });
}
