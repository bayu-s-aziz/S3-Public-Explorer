export interface Env {
  FOLDER_LABELS_KV: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const kv = context.env.FOLDER_LABELS_KV;
    if (!kv) {
        return new Response(JSON.stringify({}), { headers: { 'Content-Type': 'application/json' } });
    }
    const labelsStr = await kv.get('labels_data');
    const labels = labelsStr ? JSON.parse(labelsStr) : {};
    
    return new Response(JSON.stringify(labels), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
    });
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const kv = context.env.FOLDER_LABELS_KV;
    if (!kv) {
        return new Response(JSON.stringify({ error: "KV Namespace not bound" }), { status: 500 });
    }
    const body: any = await context.request.json();
    const { prefix, label } = body;
    
    if (typeof prefix !== 'string' || typeof label !== 'string') {
        return new Response(JSON.stringify({ error: 'Invalid input' }), { status: 400 });
    }

    let labelsStr = await kv.get('labels_data');
    let labels = labelsStr ? JSON.parse(labelsStr) : {};
    
    if (!label.trim()) {
      delete labels[prefix];
    } else {
      labels[prefix] = label.trim();
    }
    
    await kv.put('labels_data', JSON.stringify(labels));
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
    });
  }
}
