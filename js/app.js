// Roteador por hash:
//   #/                     início
//   #/trilha/:id           mapa da trilha
//   #/editar/:id[/:lição]  editor do professor
//   #/jogar/:id/:lição     modo aluno (?teste = sem registrar progresso)
//   #/l/:código            trilha recebida por link
(function () {
  const { h, Store, Share } = Duo;
  const root = document.getElementById('app');

  Duo.notFound = function (el) {
    el.replaceChildren(Duo.Home.topbar(), h('main', { class: 'page narrow empty' },
      h('h1', null, 'Não encontrado'),
      h('p', { class: 'muted' }, 'Esta trilha ou lição não existe neste navegador.'),
      h('a', { class: 'btn primary', href: '#/' }, 'Ir para o início')));
  };

  async function openShared(code) {
    root.replaceChildren(h('main', { class: 'page narrow empty' }, h('p', null, 'Abrindo trilha…')));
    try {
      const saved = Store.saveShared(await Share.decode(code));
      location.replace(`#/trilha/${saved.id}`);
    } catch {
      root.replaceChildren(Duo.Home.topbar(), h('main', { class: 'page narrow empty' },
        h('h1', null, 'Link inválido'),
        h('p', { class: 'muted' }, 'Este link está incompleto ou corrompido. Peça ao professor para enviar de novo.'),
        h('a', { class: 'btn primary', href: '#/' }, 'Ir para o início')));
    }
  }

  function route() {
    Duo.Player.cleanup();
    const [path, query] = location.hash.replace(/^#/, '').split('?');
    const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
    const [page, a, b] = parts;
    window.scrollTo(0, 0);
    switch (page) {
      case undefined: return Duo.Home.render(root);
      case 'trilha': return Duo.Course.render(root, a);
      case 'editar': return Duo.Editor.render(root, a, b);
      case 'jogar': return Duo.Player.render(root, a, b, query === 'teste');
      case 'l': return openShared(a);
      default: return Duo.notFound(root);
    }
  }

  Duo.route = route;
  window.addEventListener('hashchange', route);
  route();
})();
