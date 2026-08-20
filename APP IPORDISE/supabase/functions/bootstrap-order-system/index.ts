// Kept as an explicit tombstone so an existing deployed function cannot retain
// the former database-bootstrap behavior during a rolling deployment.
const headers = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

Deno.serve(request => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  return new Response(JSON.stringify({ error: 'Endpoint retired', code: 'ENDPOINT_RETIRED' }), {
    status: 410,
    headers,
  });
});
