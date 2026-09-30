// "Criar com IA": o professor envia a folhinha (foto/PDF) ou cola o texto e a IA monta a trilha.
// A chamada vai para a função do servidor (Duo.Config.aiEndpoint), que guarda a chave da API.
(function () {
  const { h, Store, Share, Exercises, toast, shrinkImage } = Duo;
  const MAX_FILES = 6;
  const MAX_PDF_BYTES = 12 * 1024 * 1024;

  const configured = () => !!(Duo.Config && Duo.Config.aiEndpoint);

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1]);
      r.onerror = () => reject(new Error(`Não foi possível ler ${file.name}.`));
      r.readAsDataURL(file);
    });
  }

  /** Prepara um arquivo para envio: imagens são reduzidas (fotos de celular são enormes); PDFs vão como estão. */
  async function prepare(file) {
    if (file.type === 'application/pdf') {
      if (file.size > MAX_PDF_BYTES) throw new Error(`${file.name}: PDF maior que 12 MB.`);
      return { name: file.name, mediaType: 'application/pdf', data: await fileToBase64(file) };
    }
    if (!file.type.startsWith('image/')) throw new Error(`${file.name}: envie imagem (JPG, PNG) ou PDF.`);
    let url;
    try { url = await shrinkImage(file, 1600, 0.85); } catch {
      throw new Error(`${file.name}: formato de imagem não suportado. Tire um print ou salve como JPG.`);
    }
    const [head, data] = url.split(',');
    return { name: file.name, mediaType: head.slice(5, head.indexOf(';')), data };
  }

  async function generate(payload, signal) {
    const headers = { 'Content-Type': 'application/json' };
    if (Duo.Config.aiPublicKey) {
      headers.apikey = Duo.Config.aiPublicKey;
      headers.Authorization = `Bearer ${Duo.Config.aiPublicKey}`;
    }
    const res = await fetch(Duo.Config.aiEndpoint, { method: 'POST', headers, body: JSON.stringify(payload), signal });
    let body = null;
    try { body = await res.json(); } catch { /* resposta não-JSON */ }
    if (!res.ok) throw new Error((body && body.error) || `Erro ${res.status} no servidor de IA.`);
    return body;
  }

  /** Abre a janela. Com `course`, as lições geradas são adicionadas a uma trilha existente. */
  function open(course) {
    if (!configured()) {
      Duo.modal('Criar com IA',
        h('p', null, 'A IA ainda não está ativada neste site.'),
        h('p', { class: 'muted small' }, 'Quem publica o site precisa configurar a função "gerar-trilha" no servidor e preencher js/config.js. Veja a seção "IA" do README.'));
      return;
    }

    const files = [];
    const fileList = h('div', { class: 'file-list' });
    const picker = h('input', { type: 'file', accept: 'image/*,application/pdf', multiple: true, hidden: true });
    const drop = h('button', { class: 'dropzone', type: 'button', onClick: () => picker.click() },
      h('span', { class: 'drop-icon' }, '📄'),
      h('strong', null, 'Enviar folhinha'),
      h('span', { class: 'muted small' }, 'Foto, print ou PDF da lista de exercícios ou do texto da aula (até 6 arquivos)'));

    function drawFiles() {
      fileList.replaceChildren(...files.map((f, i) => h('div', { class: 'file-chip' },
        h('span', null, f.type === 'application/pdf' ? '📕 ' : '🖼 ', f.name),
        h('button', { class: 'icon-btn', title: 'Remover', onClick: () => { files.splice(i, 1); drawFiles(); } }, '✕'))));
    }
    function addFiles(list) {
      for (const f of list) {
        if (files.length >= MAX_FILES) { toast(`Máximo de ${MAX_FILES} arquivos.`); break; }
        files.push(f);
      }
      drawFiles();
    }
    picker.addEventListener('change', () => { addFiles(picker.files); picker.value = ''; });
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); });

    const text = h('textarea', { class: 'input', rows: 4, placeholder: 'Ou cole aqui o texto da aula, um resumo ou a lista de exercícios' });
    const discipline = h('input', { class: 'input', value: course ? course.discipline : '', placeholder: 'Ex.: Biologia (opcional)' });
    const level = h('input', { class: 'input', value: course ? course.level : '', placeholder: 'Ex.: 8º ano (opcional)' });
    const lessons = h('select', { class: 'input' }, [1, 2, 3, 4, 5, 6].map(n => h('option', { value: n, selected: n === (course ? 1 : 2) }, n)));
    const perLesson = h('select', { class: 'input' }, [4, 5, 6, 8, 10, 12].map(n => h('option', { value: n, selected: n === 6 }, n)));
    const typeBoxes = Object.entries(Exercises.TYPES).map(([type, t]) => {
      const box = h('input', { type: 'checkbox', value: type, checked: type !== 'ditado' });
      return h('label', { class: 'check' }, box, ` ${t.icon} ${t.label}`);
    });
    const instructions = h('input', { class: 'input', placeholder: 'Ex.: foque em verbos irregulares; linguagem simples (opcional)' });

    const status = h('div', { class: 'ai-status', role: 'status' });
    const goBtn = h('button', { class: 'btn primary' }, '✨ Gerar trilha');
    let controller = null;

    const close = Duo.modal(course ? 'Adicionar lições com IA' : 'Criar trilha com IA',
      drop, picker, fileList, text,
      h('div', { class: 'cols' },
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Disciplina'), discipline),
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Nível / série'), level)),
      h('div', { class: 'cols' },
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Lições'), lessons),
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Exercícios por lição'), perLesson)),
      h('details', { class: 'types-box' },
        h('summary', null, 'Tipos de exercício'),
        h('div', { class: 'check-grid' }, typeBoxes)),
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Pedidos para a IA'), instructions),
      status,
      h('div', { class: 'row' }, goBtn),
      h('p', { class: 'muted small' }, 'A IA pode errar: revise a trilha antes de enviar aos alunos. Não envie dados pessoais de alunos.'));

    // Cancela a geração se a janela for fechada
    const overlays = document.querySelectorAll('.overlay');
    const overlay = overlays[overlays.length - 1];
    new MutationObserver((_, obs) => { if (!overlay.isConnected) { controller && controller.abort(); obs.disconnect(); } })
      .observe(document.body, { childList: true });

    goBtn.addEventListener('click', async () => {
      const types = typeBoxes.map(l => l.querySelector('input')).filter(b => b.checked).map(b => b.value);
      if (!files.length && text.value.trim().length < 20) { toast('Envie uma folhinha ou cole o conteúdo da aula.'); return; }
      if (!types.length) { toast('Escolha pelo menos um tipo de exercício.'); return; }

      goBtn.disabled = true;
      controller = new AbortController();
      const start = Date.now();
      const steps = ['Lendo a folhinha…', 'Entendendo o conteúdo…', 'Criando os exercícios…', 'Conferindo as respostas…'];
      const tick = () => {
        const s = Math.round((Date.now() - start) / 1000);
        status.replaceChildren(h('span', { class: 'spinner' }), h('span', null, `${steps[Math.min(steps.length - 1, Math.floor(s / 12))]} (${s}s)`));
      };
      tick();
      const timer = setInterval(tick, 1000);
      try {
        const prepared = await Promise.all(files.map(prepare));
        const result = await generate({
          files: prepared,
          text: text.value,
          discipline: discipline.value,
          level: level.value,
          lessons: Number(lessons.value),
          perLesson: Number(perLesson.value),
          types,
          instructions: instructions.value,
        }, controller.signal);
        const generated = Share.withIds(result.course);
        let target;
        if (course) {
          const fresh = Store.get(course.id);
          fresh.lessons.push(...generated.lessons.map(l => ({ ...l, id: Duo.uid() })));
          target = Store.save(fresh);
        } else {
          target = Store.duplicate(generated);
        }
        close();
        const dest = `#/editar/${target.id}`;
        // Mesmo endereço (lições adicionadas à trilha aberta) não dispara hashchange: recarrega a tela.
        if (location.hash === dest) Duo.route(); else location.hash = dest;
        const notes = [
          result.notes,
          result.dropped ? `${result.dropped} exercício(s) com problema foram descartados.` : '',
        ].filter(Boolean).join(' ');
        setTimeout(() => Duo.modal('Trilha criada! ✨',
          h('p', null, 'Revise as lições e os exercícios antes de compartilhar com os alunos.'),
          notes && h('p', { class: 'muted small' }, notes)), 50);
      } catch (e) {
        if (e.name === 'AbortError') return;
        status.replaceChildren(h('span', { class: 'warn' }, '⚠ ', e.message || 'Falha ao gerar.'));
      } finally {
        clearInterval(timer);
        goBtn.disabled = false;
      }
    });
  }

  Duo.AI = { open, configured };
})();
