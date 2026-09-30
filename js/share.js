// Compartilhamento: a lição inteira vai dentro do link (comprimida), sem servidor.
(function () {
  function toB64Url(bytes) {
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromB64Url(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return Uint8Array.from(atob(s), c => c.charCodeAt(0));
  }
  async function pipe(bytes, stream) {
    const out = new Blob([bytes]).stream().pipeThrough(stream);
    return new Uint8Array(await new Response(out).arrayBuffer());
  }

  function strip(lesson) {
    const { id, updatedAt, ...rest } = lesson;
    return { ...rest, questions: lesson.questions.map(({ id, ...q }) => q) };
  }

  /** Prefixo "z" = comprimido (deflate), "j" = JSON puro (navegadores antigos). */
  async function encode(lesson) {
    const bytes = new TextEncoder().encode(JSON.stringify(strip(lesson)));
    if (typeof CompressionStream !== 'undefined') {
      return 'z' + toB64Url(await pipe(bytes, new CompressionStream('deflate-raw')));
    }
    return 'j' + toB64Url(bytes);
  }

  async function decode(code) {
    let bytes = fromB64Url(code.slice(1));
    if (code[0] === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    const lesson = JSON.parse(new TextDecoder().decode(bytes));
    lesson.questions = (lesson.questions || []).map(q => ({ ...q, id: Duo.uid() }));
    lesson.id = 'compartilhada';
    return lesson;
  }

  async function linkFor(lesson) {
    const base = location.href.split('#')[0];
    return `${base}#/l/${await encode(lesson)}`;
  }

  function downloadJson(lesson) {
    const blob = new Blob([JSON.stringify(strip(lesson), null, 2)], { type: 'application/json' });
    const a = Duo.h('a', { href: URL.createObjectURL(blob), download: `${lesson.title || 'licao'}.json`.replace(/[\\/:*?"<>|]/g, '-') });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  Duo.Share = { encode, decode, linkFor, downloadJson };
})();
