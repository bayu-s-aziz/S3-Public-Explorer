export interface Env {
  // Bindings can be declared here if needed
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const prefix = url.searchParams.get('prefix') || '';
  
  try {
    const targetUrl = `https://aws3.unigal.ac.id/ftgenk-storage/?list-type=2&prefix=${encodeURIComponent(prefix)}&delimiter=/`;
    const response = await fetch(targetUrl);
    
    if (!response.ok) {
      return new Response(await response.text(), { status: response.status });
    }
    
    const xml = await response.text();
    return new Response(xml, {
      headers: {
        'Content-Type': 'text/xml',
      }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Failed to fetch directory contents' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
