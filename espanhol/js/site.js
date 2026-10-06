/* ¡Ven a hablar conmigo! — movimento pela base RC (js/motion.js).
   O CSS já é o estado final: se o GSAP falhar, tudo continua visível e clicável. */
(function () {
  'use strict';
  var RC = window.RC = window.RC || {};
  var raiz = document.documentElement;
  var registrar = function (nome, fn) {
    if (typeof RC.registrar === 'function') RC.registrar(nome, fn);
    else (RC.fila = RC.fila || []).push([nome, fn]);
  };

  // Cabeçalho ganha a linha de baixo depois que a página rola.
  var cab = document.querySelector('.cab');
  if (cab) {
    var marcar = function () { cab.classList.toggle('is-rolado', window.scrollY > 8); };
    window.addEventListener('scroll', marcar, { passive: true });
    marcar();
  }

  // Capa: texto sobe em sequência.
  registrar('capa', function (c) {
    if (c.perfil === 'estatico') return;
    var itens = c.el.querySelectorAll('.selo-topo, .capa__titulo .l, .capa__sub, .capa__acoes, .capa__linha, .capa__tags li');
    c.gsap.from(itens, { y: 26, opacity: 0, duration: .9, stagger: .06, ease: 'power3.out' });
    var parc = c.el.querySelectorAll('.parceiros__lista li');
    c.gsap.from(parc, {
      y: 18, opacity: 0, duration: .7, stagger: .07, ease: 'power3.out',
      scrollTrigger: { trigger: c.el.querySelector('.parceiros'), start: 'top 92%', once: true }
    });
    // No computador, os cartões flutuantes acompanham a rolagem em velocidades diferentes.
    if (c.perfil === 'completo') {
      [['.flut--aulas', -40], ['.flut--cartao', -70], ['.flut--fala', -25], ['.flut--bandeira', -55]].forEach(function (p) {
        var el = c.el.querySelector(p[0]);
        if (el) c.gsap.to(el, { y: p[1], ease: 'none', scrollTrigger: { trigger: c.el, start: 'top top', end: 'bottom top', scrub: .6 } });
      });
    }
  });

  // Cartões flutuantes da capa e fotos menores: sobem com um leve atraso.
  registrar('sobe', function (c) {
    if (c.perfil === 'estatico') return;
    var naCapa = !!c.el.closest('.capa');
    var cfg = { y: 30, opacity: 0, duration: .9, delay: (naCapa ? .45 : .15) + ((c.opts && c.opts.atraso) || 0), ease: 'power3.out' };
    if (!naCapa) cfg.scrollTrigger = { trigger: c.el, start: 'top 92%', once: true };
    c.gsap.from(c.el, cfg);
  });

  // Frase do método: as palavras acendem com a rolagem.
  function dividir(el) {
    Array.prototype.slice.call(el.childNodes).forEach(function (n) {
      if (n.nodeType === 3) {
        var frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(function (tok) {
          if (!tok) return;
          if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(tok)); return; }
          var s = document.createElement('span'); s.className = 'pal'; s.textContent = tok; frag.appendChild(s);
        });
        n.parentNode.replaceChild(frag, n);
      } else if (n.nodeType === 1) {
        dividir(n);
      }
    });
  }
  registrar('palavras', function (c) {
    if (c.perfil === 'estatico') return;
    if (!c.el.dataset.dividido) { dividir(c.el); c.el.dataset.dividido = '1'; }
    c.gsap.fromTo(c.el.querySelectorAll('.pal'), { opacity: .15 }, {
      opacity: 1, ease: 'none', stagger: .1,
      scrollTrigger: { trigger: c.el, start: 'top 80%', end: 'bottom 50%', scrub: .5 }
    });
  });

  // Blocos: sobem saindo do desfoque (desfoque só no computador).
  registrar('surgir', function (c) {
    if (c.perfil === 'estatico') return;
    var de = { y: c.perfil === 'completo' ? 40 : 20, opacity: 0 };
    if (c.perfil === 'completo') de.filter = 'blur(8px)';
    c.gsap.fromTo(c.el, de, {
      y: 0, opacity: 1, filter: 'blur(0px)', duration: .95, delay: (c.opts && c.opts.atraso) || 0, ease: 'power3.out',
      scrollTrigger: { trigger: c.el, start: 'top 90%', once: true },
      onComplete: function () { c.el.style.filter = ''; }
    });
  });

  // Fotos que assentam dentro do quadro enquanto entram na tela.
  registrar('zoom', function (c) {
    if (c.perfil === 'estatico') return;
    var img = c.el.querySelector('img');
    if (!img) return;
    c.gsap.fromTo(img, { scale: 1.16 }, {
      scale: 1, ease: 'none',
      scrollTrigger: { trigger: c.el, start: 'top bottom', end: 'center 55%', scrub: .6 }
    });
  });

  // Chamada final: a Priscila sobe por trás da borda do cartão.
  registrar('sobe-final', function (c) {
    if (c.perfil === 'estatico') return;
    c.gsap.fromTo(c.el, { yPercent: 24 }, {
      yPercent: 0, ease: 'none',
      scrollTrigger: { trigger: c.el.closest('.final'), start: 'top bottom', end: 'top 30%', scrub: .6 }
    });
  });

  // Marca do rodapé: as letras sobem uma a uma.
  registrar('letras', function (c) {
    if (c.perfil === 'estatico') return;
    if (!c.el.dataset.dividido) {
      var txt = c.el.textContent;
      c.el.setAttribute('aria-label', txt);
      c.el.textContent = '';
      txt.split('').forEach(function (ch) {
        var s = document.createElement('span'); s.className = 'let'; s.setAttribute('aria-hidden', 'true');
        s.textContent = ch === ' ' ? ' ' : ch; c.el.appendChild(s);
      });
      c.el.dataset.dividido = '1';
    }
    c.gsap.from(c.el.querySelectorAll('.let'), {
      yPercent: 110, opacity: 0, duration: .9, stagger: .03, ease: 'power4.out',
      scrollTrigger: { trigger: c.el, start: 'top 95%', once: true }
    });
  });

  // Vídeo: o botão por cima dá o play com som e liga os controles nativos.
  var vsl = document.querySelector('.vsl');
  var video = document.getElementById('vsl-video');
  function tocarVideo() {
    if (!vsl || !video) return;
    vsl.classList.add('is-tocando');
    video.controls = true;
    var p = video.play();
    if (p && p.catch) p.catch(function () { /* navegador bloqueou: os controles ficam visíveis */ });
  }
  if (vsl && video) {
    var botao = vsl.querySelector('.vsl__play');
    if (botao) botao.addEventListener('click', tocarVideo);
    video.addEventListener('ended', function () {
      vsl.classList.remove('is-tocando');
      video.controls = false;
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-tocar-vsl]'), function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (RC.lenis) RC.lenis.scrollTo(vsl, { offset: -90 });
        else vsl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        tocarVideo();
      });
    });
  }

  // Depoimentos: no começo mostra só um trecho do mural; o botão abre o resto.
  var mural = document.getElementById('mural');
  var verMais = document.getElementById('ver-mais');
  if (mural && verMais) {
    mural.classList.add('is-curto');
    verMais.addEventListener('click', function () {
      mural.classList.remove('is-curto');
      verMais.setAttribute('aria-expanded', 'true');
      verMais.parentNode.classList.add('is-aberto');
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    });
  }

  // Perguntas: abrir uma fecha as outras.
  var itens = document.querySelectorAll('.faq__item');
  Array.prototype.forEach.call(itens, function (d) {
    d.addEventListener('toggle', function () {
      if (!d.open) return;
      Array.prototype.forEach.call(itens, function (o) { if (o !== d) o.open = false; });
      if (window.ScrollTrigger) setTimeout(function () { window.ScrollTrigger.refresh(); }, 50);
    });
  });

  // Sem motion, a abertura em CSS também sai.
  if (RC.pronto && RC.pronto.then) {
    RC.pronto.then(function (info) { if (!info || info.falhou || info.perfil === 'estatico') raiz.classList.remove('capa-viva'); });
  }
})();
