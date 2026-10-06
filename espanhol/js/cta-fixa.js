/*
 * RC snippet · cta-sticky-mobile
 * Barra de CTA fixa no rodapé do celular. Aparece sempre que o CTA do hero não está na tela
 * (abaixo da dobra ao abrir, ou já rolado por cima) e some quando a oferta final (preço + CTA)
 * entra — nunca cobre o preço nem o botão final. Com {"soDepoisDoHero": true}, só aparece
 * depois que o CTA do hero sai por cima (comportamento antigo; use quando o CTA do hero
 * está garantido na dobra de 664px).
 *
 * - Gatilho: IntersectionObserver (sem scroll listener, sem ScrollTrigger, sem timeline).
 *   O clique nunca depende de progresso de animação (T1).
 * - Transição: CSS transform (translateY) por classe. Não usa GSAP: se o GSAP falhar, a barra
 *   continua funcionando pelo CSS (sem JS ela fica fixa e visível o tempo todo, com reserva
 *   de espaço no fim da página).
 * - Escondida = `inert` (sai do tab e do leitor de tela) + translateY. Mostrada = sem inert.
 * - Desktop (≥ 800px): o CSS esconde e o JS nem observa.
 * - Perfis: 'reduzido' → desliza em 0,32s · 'estatico' → aparece/some sem movimento (o CSS zera
 *   a transição sob reduced-motion) · 'completo' → sai (desktop).
 *
 * data-rc-opts (todos opcionais):
 *   entrada  seletor do CTA do hero (padrão: primeiro [data-rc-cta] fora da barra)
 *   saida    seletor(es) da oferta final; separados por vírgula (padrão: último [data-rc-cta] fora da barra)
 *   margem   px de folga antes de mostrar depois que o CTA do hero sai (padrão 0)
 *   desktop  largura mínima em px em que a barra não existe (padrão 800, casa com o CSS)
 *   soDepoisDoHero  true = só aparece depois que o CTA do hero sai por cima (padrão false)
 */
(function () {
  'use strict';
  window.RC = window.RC || {};

  function montar(ctx) {
    var el = ctx.el, perfil = ctx.perfil, opts = ctx.opts || {};
    var larguraDesk = Number(opts.desktop) || 800;
    if (perfil === 'completo') return;                              // desktop: CSS já esconde
    if (window.matchMedia('(min-width: ' + larguraDesk + 'px)').matches) return; // estatico no desktop
    if (!('IntersectionObserver' in window)) return;                // sem IO: fica o estado CSS (visível)

    var fora = function (n) { return !el.contains(n); };
    var ctas = Array.prototype.filter.call(document.querySelectorAll('[data-rc-cta]'), fora);
    var entrada = opts.entrada ? document.querySelector(opts.entrada) : ctas[0];
    var saidas = opts.saida
      ? Array.prototype.slice.call(document.querySelectorAll(opts.saida))
      : (ctas.length > 1 ? [ctas[ctas.length - 1]] : []);
    if (!entrada) return;

    var root = document.documentElement;
    var passouEntrada = false;   // CTA do hero acima da viewport
    var chegouSaida = false;     // alguma saída visível ou já acima (oferta final na tela / passou)
    var digitando = false;       // campo de formulário focado: teclado virtual aberto
    var estadoSaida = new Map();
    var visivel = null;

    function aplicar() {
      var mostrar = passouEntrada && !chegouSaida && !digitando;
      if (mostrar === visivel) return;
      visivel = mostrar;
      el.classList.toggle('is-visivel', mostrar);
      if (mostrar) el.removeAttribute('inert');
      else {
        // devolve o foco para a página se ele estava na barra que está sumindo
        if (el.contains(document.activeElement)) document.activeElement.blur();
        el.setAttribute('inert', '');
      }
    }

    var margem = Math.max(0, Number(opts.margem) || 0);
    var soDepois = opts.soDepoisDoHero === true;
    var ioEntrada = new IntersectionObserver(function (itens) {
      var it = itens[itens.length - 1];
      // Padrão: o CTA do hero fora da tela (abaixo da dobra no 1º frame, atrás de um VSL, ou já
      // rolado) liga a barra — ciclo 1: CTA do hero a 1,1 tela deixava a dobra sem CTA nenhum.
      passouEntrada = soDepois
        ? !it.isIntersecting && it.boundingClientRect.bottom <= margem
        : !it.isIntersecting;
      aplicar();
    }, { rootMargin: margem + 'px 0px 0px 0px', threshold: 0 });
    ioEntrada.observe(entrada);

    var ioSaida = new IntersectionObserver(function (itens) {
      itens.forEach(function (it) {
        // entrou na tela, ou já está acima dela (usuário rolou além da oferta)
        estadoSaida.set(it.target, it.isIntersecting || it.boundingClientRect.top < 0);
      });
      chegouSaida = false;
      estadoSaida.forEach(function (v) { if (v) chegouSaida = true; });
      aplicar();
    }, { threshold: 0 });
    saidas.forEach(function (s) { ioSaida.observe(s); });

    function aoFocar(e) {
      var t = e.target;
      digitando = !!(t && t.matches && t.matches('input:not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]), textarea, select, [contenteditable="true"]'));
      aplicar();
    }
    function aoSair() { digitando = false; aplicar(); }
    document.addEventListener('focusin', aoFocar);
    document.addEventListener('focusout', aoSair);

    root.classList.add('rc-cta-fixa-ativa');   // liga o modo "esconde até passar do hero"
    el.setAttribute('inert', '');
    visivel = false;
    aplicar();

    return function limpar() {
      ioEntrada.disconnect();
      ioSaida.disconnect();
      document.removeEventListener('focusin', aoFocar);
      document.removeEventListener('focusout', aoSair);
      root.classList.remove('rc-cta-fixa-ativa');  // volta ao estado CSS: barra visível
      el.classList.remove('is-visivel');
      el.removeAttribute('inert');
    };
  }

  if (window.RC && typeof window.RC.registrar === 'function') window.RC.registrar('cta-sticky-mobile', montar);
  else (window.RC.fila = window.RC.fila || []).push(['cta-sticky-mobile', montar]);
})();
