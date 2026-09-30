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

  /** Remove campos internos. Mantém ids da trilha e das lições para o progresso do aluno sobreviver a atualizações. */
  function strip(course) {
    const { updatedAt, sharedFrom, createdAt, ...rest } = course;
    return { ...rest, lessons: course.lessons.map(l => ({ ...l, questions: l.questions.map(({ id, ...q }) => q) })) };
  }

  /** Prefixo "z" = comprimido (deflate), "j" = JSON puro (navegadores antigos). */
  async function encode(course) {
    const bytes = new TextEncoder().encode(JSON.stringify(strip(course)));
    if (typeof CompressionStream !== 'undefined') {
      return 'z' + toB64Url(await pipe(bytes, new CompressionStream('deflate-raw')));
    }
    return 'j' + toB64Url(bytes);
  }

  async function decode(code) {
    let bytes = fromB64Url(code.slice(1));
    if (code[0] === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    return withIds(JSON.parse(new TextDecoder().decode(bytes)));
  }

  /** Garante a estrutura esperada em trilhas vindas de fora (link ou arquivo). */
  function withIds(course) {
    if (!course || !Array.isArray(course.lessons)) throw new Error('Arquivo não é uma trilha válida.');
    return {
      id: course.id || Duo.uid(),
      title: String(course.title || 'Trilha sem nome'),
      discipline: String(course.discipline || ''),
      level: String(course.level || ''),
      description: String(course.description || ''),
      lessons: course.lessons.map(l => ({
        id: l.id || Duo.uid(),
        title: String(l.title || 'Lição'),
        questions: (l.questions || []).filter(q => Duo.Exercises.TYPES[q.type]).map(q => ({ ...q, id: Duo.uid() })),
      })),
    };
  }

  async function linkFor(course) {
    const base = location.href.split('#')[0];
    return `${base}#/l/${await encode(course)}`;
  }

  function downloadJson(course) {
    const blob = new Blob([JSON.stringify(strip(course), null, 2)], { type: 'application/json' });
    const a = Duo.h('a', { href: URL.createObjectURL(blob), download: `${course.title || 'trilha'}.trilha.json`.replace(/[\\/:*?"<>|]/g, '-') });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  Duo.Share = { encode, decode, withIds, linkFor, downloadJson };
})();
