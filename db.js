// Capa de datos sobre Supabase: imita la API de documentos que usa el panel
window.createSupabaseDb = function (url, key) {
  const sb = window.supabase.createClient(url, key);
  const T = "docs";
  const subs = new Set();
  const split = p => { const i = p.lastIndexOf("/"); return { coll: p.slice(0, i), id: p.slice(i + 1) }; };
  const meta = { fromCache: false, hasPendingWrites: false };
  const snapDoc = (id, data) => ({ id, exists: data !== undefined, data: () => data, metadata: meta });
  const err = e => ({ code: "unavailable", message: (e && e.message) || String(e) });
  let timers = {};
  function notify(coll) { clearTimeout(timers[coll]); timers[coll] = setTimeout(() => subs.forEach(s => { if (s.coll === coll) s.run(); }), 150); }
  function merge(a, b) {
    const o = { ...a };
    for (const k in b) {
      const v = b[k];
      if (v && typeof v === "object" && !Array.isArray(v) && o[k] && typeof o[k] === "object" && !Array.isArray(o[k])) o[k] = merge(o[k], v);
      else o[k] = v;
    }
    return o;
  }
  async function readDoc(path) {
    const { coll, id } = split(path);
    const { data, error } = await sb.from(T).select("data").eq("coll", coll).eq("id", id).maybeSingle();
    if (error) throw err(error);
    return data ? data.data : undefined;
  }
  function docRef(path) {
    const { coll, id } = split(path);
    const ref = {
      id, path,
      get: async () => snapDoc(id, await readDoc(path)),
      set: async d => {
        const { error } = await sb.from(T).upsert({ coll, id, data: d, updated_at: new Date().toISOString() });
        if (error) throw err(error);
        notify(coll);
      },
      update: async d => {
        const cur = await readDoc(path);
        if (cur === undefined) throw { code: "invalid_argument", message: "El documento no existe" };
        return ref.set(merge(cur, d));
      },
      delete: async () => {
        const { error } = await sb.from(T).delete().eq("coll", coll).eq("id", id);
        if (error) throw err(error);
        notify(coll);
      },
      onSnapshot: (next) => {
        const s = { coll, run: async () => { try { next(snapDoc(id, await readDoc(path))); } catch (e) {} } };
        subs.add(s); s.run();
        return () => subs.delete(s);
      },
      collection: p => collRef(path + "/" + p)
    };
    return ref;
  }
  function collRef(path, opts = {}) {
    const q = {
      path,
      where: () => q,
      orderBy: (f, dir = "asc") => collRef(path, { ...opts, order: [f, dir] }),
      limit: n => collRef(path, { ...opts, limit: n }),
      get: async () => {
        let r = sb.from(T).select("id,data").eq("coll", path);
        if (opts.order) r = r.order("data->>" + opts.order[0], { ascending: opts.order[1] === "asc", nullsFirst: false });
        r = r.limit(opts.limit || 1000);
        const { data, error } = await r;
        if (error) throw err(error);
        const docs = data.map(x => snapDoc(x.id, x.data));
        return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: meta };
      },
      onSnapshot: (next) => {
        const s = { coll: path, run: async () => { try { next(await q.get()); } catch (e) {} } };
        subs.add(s); s.run();
        return () => subs.delete(s);
      },
      doc: id => docRef(path + "/" + (id || Math.random().toString(36).slice(2, 12))),
      add: async d => { const r = q.doc(); await r.set(d); return r; }
    };
    return q;
  }
  // Cambios en vivo de otros cajeros + refresco de respaldo
  sb.channel("docs-cambios")
    .on("postgres_changes", { event: "*", schema: "public", table: T }, p => {
      const c = (p.new && p.new.coll) || (p.old && p.old.coll);
      if (c) notify(c); else subs.forEach(s => s.run());
    })
    .subscribe();
  setInterval(() => { if (!document.hidden) subs.forEach(s => s.run()); }, 30000);
  return { doc: docRef, collection: collRef };
};
